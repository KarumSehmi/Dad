import { getCache } from "@vercel/functions";
import { after } from "next/server";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { isImageWidth, photoCacheTag } from "@/lib/image-url";
import { readPhotoFile, StorageNotConfiguredError } from "@/lib/storage";

// Makes the resized copies of photos that every page shows (see
// lib/image-url.ts), e.g. /img/640/photos/<id>/photo.jpg. Vercel's CDN keeps
// each copy for a year, so this only runs the first time a photo is wanted at
// a given width. Photos never change (each upload gets a new address), and a
// deleted photo's copies are removed with it (lib/storage.ts).
//
// The CDN starts empty after every deployment, and keeps separate copies per
// region and per browser type. So copies of shared photos are also kept in
// Vercel's Runtime Cache, which survives deployments: a photo's original is
// downloaded from Blob storage (whose free plan allows 10 GB a month) once
// per width, not again after every deploy.

const ONE_YEAR = 60 * 60 * 24 * 365;

const STORED_PHOTO = /^photos\/([\w-]+)\/photo\.jpg$/;
// A photo committed to public/images, such as the portrait in site.config.ts.
// next.config.ts includes that folder with this route when it's deployed.
const SITE_IMAGE = /^images\/[\w-]+\.(?:jpe?g|png|webp)$/i;

// Change the namespace whenever the copies themselves change (size, quality,
// format), so old ones aren't served. On the free plan every project on the
// account shares one Runtime Cache, hence the namespace at all. Keys are hashed
// with SHA-256 because the default hash is short enough to collide.
const keptCopies = getCache({
  namespace: "harvey-sehmi-resized-v1",
  keyHashFunction: (key) => createHash("sha256").update(key).digest("hex"),
});

// Runtime Cache entries can't be larger than 2 MB, base64 included.
const MAX_KEPT_BYTES = 1.4 * 1024 * 1024;

type Source = {
  read(): Promise<Buffer | null>;
  /** Only shared photos are kept in the Runtime Cache; site images are read from disk. */
  photoId?: string;
};

function sourceFor(pathname: string): Source | null {
  const photoId = pathname.match(STORED_PHOTO)?.[1];
  if (photoId) return { read: () => readPhotoFile(photoId), photoId };
  if (SITE_IMAGE.test(pathname)) return { read: () => readSiteImage(pathname) };
  return null;
}

async function readSiteImage(pathname: string): Promise<Buffer | null> {
  try {
    return await readFile(path.join(process.cwd(), "public", pathname));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function keptCopy(key: string): Promise<Buffer | null> {
  try {
    const kept = await keptCopies.get(key);
    return typeof kept === "string" ? Buffer.from(kept, "base64") : null;
  } catch (cause) {
    // Making the copy again is slower, but works.
    console.error("Reading a kept photo copy failed", cause);
    return null;
  }
}

async function keepCopy(key: string, image: Buffer, photoId: string) {
  if (image.length > MAX_KEPT_BYTES) return;
  try {
    await keptCopies.set(key, image.toString("base64"), { ttl: ONE_YEAR, tags: [photoCacheTag(photoId)] });
  } catch (cause) {
    console.error("Keeping a photo copy failed", cause);
  }
}

function resize(original: Buffer, width: number): Promise<Buffer> {
  return (
    sharp(original, { autoOrient: true, failOn: "none" })
      .resize({ width, withoutEnlargement: true })
      // Transparent areas (e.g. in PNGs) would otherwise turn black.
      .flatten({ background: "#ffffff" })
      // JPEG rather than WebP so photos show on older iPhones and iPads too.
      .jpeg({ quality: 75, mozjpeg: true })
      .toBuffer()
  );
}

function fail(status: number, message: string) {
  // Never kept by the CDN, so a passing problem doesn't stick.
  return new Response(message, { status, headers: { "cache-control": "no-store" } });
}

export async function GET(_request: Request, ctx: RouteContext<"/img/[width]/[...path]">) {
  const { width: widthParam, path: segments } = await ctx.params;
  const width = Number(widthParam);
  const pathname = segments.join("/");
  const source = sourceFor(pathname);
  if (!isImageWidth(width) || !source) return fail(404, "Not found");

  const key = `${width}/${pathname}`;
  let image = source.photoId ? await keptCopy(key) : null;
  if (!image) {
    let original;
    try {
      original = await source.read();
    } catch (cause) {
      console.error("Reading a photo to resize failed", cause);
      if (cause instanceof StorageNotConfiguredError) return fail(503, cause.message);
      return fail(502, "This photo couldn't be loaded just now.");
    }
    if (!original) return fail(404, "Not found");

    try {
      image = await resize(original, width);
    } catch (cause) {
      console.error("Resizing a photo failed", cause);
      return fail(415, "This photo couldn't be resized.");
    }
    const { photoId } = source;
    if (photoId) {
      const copy = image;
      after(() => keepCopy(key, copy, photoId));
    }
  }

  const headers = new Headers({
    "content-type": "image/jpeg",
    "cache-control": `public, max-age=${ONE_YEAR}, immutable`,
    "vercel-cdn-cache-control": `max-age=${ONE_YEAR}`,
  });
  if (source.photoId) headers.set("vercel-cache-tag", photoCacheTag(source.photoId));
  return new Response(new Uint8Array(image), { headers });
}
