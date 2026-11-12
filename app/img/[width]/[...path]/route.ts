import { readFile } from "node:fs/promises";
import path from "node:path";
import { firebaseEnabled, storedFileMediaUrl } from "@/lib/firebase-storage";
import { isImageWidth, photoFileName } from "@/lib/image-url";
import { resizePhoto } from "@/lib/photo-storage";
import { readLocalPhoto } from "@/lib/storage";

// Resized copies of the photos committed to public/images, such as the
// portrait in site.config.ts, e.g. /img/640/images/harvey-pointing.jpg.
// Vercel's CDN keeps each copy for a year, so this only runs the first time
// an image is wanted at a given width (after each deployment).
//
// Shared photos don't come through here: browsers load them straight from
// Firebase Storage, where each is kept at every width (lib/image-url.ts).
// Their old addresses here, /img/<width>/photos/<id>/photo.jpg, which pages
// made before the move still use, now point to the copy in Firebase. Only when
// running without Firebase (npm run dev) are shared photos resized here, from
// the local .data folder.

const ONE_YEAR = 60 * 60 * 24 * 365;

const SHARED_PHOTO = /^photos\/([\w-]+)\/photo\.jpg$/;
// next.config.ts includes public/images with this route when it's deployed.
const SITE_IMAGE = /^images\/[\w-]+\.(?:jpe?g|png|webp)$/i;

const KEEP_FOR_A_YEAR = {
  "cache-control": `public, max-age=${ONE_YEAR}, immutable`,
  "vercel-cdn-cache-control": `max-age=${ONE_YEAR}`,
};

async function readSiteImage(pathname: string): Promise<Buffer | null> {
  try {
    return await readFile(path.join(process.cwd(), "public", pathname));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function fail(status: number, message: string) {
  // Never kept by the CDN, so a passing problem doesn't stick.
  return new Response(message, { status, headers: { "cache-control": "no-store" } });
}

export async function GET(_request: Request, ctx: RouteContext<"/img/[width]/[...path]">) {
  const { width: widthParam, path: segments } = await ctx.params;
  const width = Number(widthParam);
  const pathname = segments.join("/");
  if (!isImageWidth(width)) return fail(404, "Not found");

  const photoId = pathname.match(SHARED_PHOTO)?.[1];
  if (photoId && firebaseEnabled) {
    return new Response(null, {
      status: 308,
      headers: { location: storedFileMediaUrl(photoFileName(photoId, width)), ...KEEP_FOR_A_YEAR },
    });
  }

  let original;
  try {
    if (photoId) original = await readLocalPhoto(photoId);
    else if (SITE_IMAGE.test(pathname)) original = await readSiteImage(pathname);
  } catch (cause) {
    console.error("Reading an image to resize failed", cause);
    return fail(500, "This image couldn't be loaded just now.");
  }
  if (!original) return fail(404, "Not found");

  let image;
  try {
    image = await resizePhoto(original, width);
  } catch (cause) {
    console.error("Resizing an image failed", cause);
    return fail(415, "This image couldn't be resized.");
  }
  return new Response(new Uint8Array(image), { headers: { "content-type": "image/jpeg", ...KEEP_FOR_A_YEAR } });
}
