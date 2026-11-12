import { firebaseEnabled, storedFileMediaUrl } from "./firebase-storage";

// Each shared photo is kept in Firebase Storage as shared (photo-<id>.jpg) and
// as a smaller copy at every width below (photo-<id>.<width>.jpg), all made
// once, when it's shared (lib/photo-storage.ts). Browsers load them straight
// from Firebase, so showing photos uses none of Vercel's allowances.
//
// next/image picks from these widths for each screen (next.config.ts), and the
// loader in lib/image-loader.ts turns each pick into one of those files.
// Every photo already shared has exactly these widths: adding one means making
// that copy of every existing photo first, or those photos will go blank.

/** For photos that fill much of the screen (next/image `deviceSizes`). */
export const SCREEN_WIDTHS = [640, 828, 1080, 1440, 2048];

/** For small photos, such as gallery tiles on a computer (next/image `imageSizes`). */
export const TILE_WIDTHS = [256, 384];

/** Every width a copy of each shared photo is kept at, smallest first. */
export const PHOTO_WIDTHS = [...TILE_WIDTHS, ...SCREEN_WIDTHS];

export function isImageWidth(width: number): boolean {
  return PHOTO_WIDTHS.includes(width);
}

/** The stored width to use when `width` pixels are wanted: that one, or the next one up. */
function storedWidth(width: number): number {
  return PHOTO_WIDTHS.find((w) => w >= width) ?? PHOTO_WIDTHS[PHOTO_WIDTHS.length - 1];
}

/** A shared photo's file name in Firebase Storage: as shared, or the copy `width` pixels wide. */
export function photoFileName(id: string, width?: number): string {
  return width ? `photo-${id}.${width}.jpg` : `photo-${id}.jpg`;
}

// A shared photo's address, as saved with its memory. Photos shared before
// the move to Firebase still carry their old address in Vercel Blob, but every
// one of them was copied to Firebase under the same id, so only the id is used.
const FIREBASE_PHOTO = /\/o\/photo-([\w-]+)\.jpg\?alt=media$/;
const BLOB_PHOTO = /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/photos\/([\w-]+)\/photo\.jpg$/i;
// A photo kept in the local .data folder, when running without Firebase (npm run dev).
const LOCAL_PHOTO = /^\/files\/photos\/([\w-]+)\/photo\.jpg$/;

// A photo committed to the repo's public/images folder, such as the portrait
// in site.config.ts, resized by app/img.
const SITE_IMAGE = /^\/(images\/[\w-]+\.(?:jpe?g|png|webp))$/i;

/** The id of the shared photo at `src`, or null if it isn't one. */
export function photoIdOf(src: string): string | null {
  return src.match(FIREBASE_PHOTO)?.[1] ?? src.match(BLOB_PHOTO)?.[1] ?? src.match(LOCAL_PHOTO)?.[1] ?? null;
}

/**
 * Where to get a copy of `src` that's `width` pixels wide (or the photo's own
 * width, if that's smaller). Anything else is returned as it is.
 */
export function resizedImageUrl(src: string, width: number): string {
  const w = storedWidth(width);
  const id = photoIdOf(src);
  if (id) return firebaseEnabled ? storedFileMediaUrl(photoFileName(id, w)) : `/img/${w}/photos/${id}/photo.jpg`;
  const siteImage = src.match(SITE_IMAGE)?.[1];
  return siteImage ? `/img/${w}/${siteImage}` : src;
}

/** Where the Download button gets a shared photo, as it was shared. */
export function photoDownloadUrl(src: string): string {
  const id = photoIdOf(src);
  // Firebase sends it as a download (lib/photo-storage.ts); app/files does on request.
  if (id && firebaseEnabled) return storedFileMediaUrl(photoFileName(id));
  return `${src}${src.includes("?") ? "&" : "?"}download=1`;
}
