// Photos are shown at a few fixed widths. Each copy is made by the site itself
// (app/img/[width]/[...path]/route.ts) the first time it's asked for, then
// kept by Vercel's CDN, so it's only ever made once. The site doesn't use
// Vercel's image optimizer: its free plan stops resizing after 5,000 copies a
// month, which a few hundred photos at these widths use up.
//
// next/image picks from these widths for each screen (next.config.ts). Few
// widths means each copy is shared by more visitors and made less often.

/** For photos that fill much of the screen (next/image `deviceSizes`). */
export const SCREEN_WIDTHS = [640, 828, 1080, 1440, 2048];

/** For small photos, such as gallery tiles on a computer (next/image `imageSizes`). */
export const TILE_WIDTHS = [256, 384];

export function isImageWidth(width: number): boolean {
  return SCREEN_WIDTHS.includes(width) || TILE_WIDTHS.includes(width);
}

// A shared photo, in Vercel Blob (lib/storage.ts) or, during development, in
// the local .data folder. Either way it's photos/<id>/photo.jpg.
const STORED_PHOTO = /^(?:https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com|\/files)\/(photos\/[\w-]+\/photo\.jpg)$/i;

// A photo committed to the repo's public/images folder, such as the portrait
// in site.config.ts.
const SITE_IMAGE = /^\/(images\/[\w-]+\.(?:jpe?g|png|webp))$/i;

/**
 * Where to get a copy of `src` that's `width` pixels wide (or the photo's own
 * width, if that's smaller). Anything else is returned as it is.
 */
export function resizedImageUrl(src: string, width: number): string {
  const path = src.match(STORED_PHOTO)?.[1] ?? src.match(SITE_IMAGE)?.[1];
  return path ? `/img/${width}/${path}` : src;
}

/** Every resized copy of a shared photo carries this tag, so they can all be removed when the photo is. */
export function photoCacheTag(photoId: string): string {
  return `photo-${photoId}`;
}
