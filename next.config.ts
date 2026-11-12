import type { NextConfig } from "next";
import { SCREEN_WIDTHS, TILE_WIDTHS } from "./lib/image-url";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // Shared photos are kept in Firebase Storage at each of these widths and
    // loaded straight from there (lib/image-url.ts), never through Vercel's
    // image optimizer, which stops on the free plan after 5,000 copies a month.
    loader: "custom",
    loaderFile: "./lib/image-loader.ts",
    deviceSizes: SCREEN_WIDTHS,
    imageSizes: TILE_WIDTHS,
  },
  // Lets app/img resize a photo committed to public/images (see site.config.ts).
  outputFileTracingIncludes: {
    "/img/**": ["./public/images/**/*"],
  },
};

export default nextConfig;
