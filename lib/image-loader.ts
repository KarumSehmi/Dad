"use client";

import type { ImageLoaderProps } from "next/image";
import { resizedImageUrl } from "./image-url";

// Tells every next/image on the site where to get each size of a photo
// (set as images.loaderFile in next.config.ts).
export default function imageLoader({ src, width }: ImageLoaderProps): string {
  return resizedImageUrl(src, width);
}
