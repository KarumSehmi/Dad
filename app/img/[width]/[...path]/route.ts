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

const ONE_YEAR = 60 * 60 * 24 * 365;

const STORED_PHOTO = /^photos\/([\w-]+)\/photo\.jpg$/;
// A photo committed to public/images, such as the portrait in site.config.ts.
// next.config.ts includes that folder with this route when it's deployed.
const SITE_IMAGE = /^images\/[\w-]+\.(?:jpe?g|png|webp)$/i;

function fail(status: number, message: string) {
  // Never kept by the CDN, so a passing problem doesn't stick.
  return new Response(message, { status, headers: { "cache-control": "no-store" } });
}

async function readSource(pathname: string): Promise<{ data: Buffer; tag?: string } | null> {
  const photoId = pathname.match(STORED_PHOTO)?.[1];
  if (photoId) {
    const data = await readPhotoFile(photoId);
    return data && { data, tag: photoCacheTag(photoId) };
  }
  if (SITE_IMAGE.test(pathname)) {
    try {
      return { data: await readFile(path.join(process.cwd(), "public", pathname)) };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }
  return null;
}

export async function GET(_request: Request, ctx: RouteContext<"/img/[width]/[...path]">) {
  const { width: widthParam, path: segments } = await ctx.params;
  const width = Number(widthParam);
  if (!isImageWidth(width)) return fail(404, "Not found");

  let source;
  try {
    source = await readSource(segments.join("/"));
  } catch (cause) {
    console.error("Reading a photo to resize failed", cause);
    if (cause instanceof StorageNotConfiguredError) return fail(503, cause.message);
    return fail(502, "This photo couldn't be loaded just now.");
  }
  if (!source) return fail(404, "Not found");

  let resized: Buffer;
  try {
    resized = await sharp(source.data, { autoOrient: true, failOn: "none" })
      .resize({ width, withoutEnlargement: true })
      // Transparent areas (e.g. in PNGs) would otherwise turn black.
      .flatten({ background: "#ffffff" })
      // JPEG rather than WebP so photos show on older iPhones and iPads too.
      .jpeg({ quality: 75, mozjpeg: true })
      .toBuffer();
  } catch (cause) {
    console.error("Resizing a photo failed", cause);
    return fail(415, "This photo couldn't be resized.");
  }

  const headers = new Headers({
    "content-type": "image/jpeg",
    "cache-control": `public, max-age=${ONE_YEAR}, immutable`,
    "vercel-cdn-cache-control": `max-age=${ONE_YEAR}`,
  });
  if (source.tag) headers.set("vercel-cache-tag", source.tag);
  return new Response(new Uint8Array(resized), { headers });
}
