import type { NextConfig } from "next";

// Photos live in a public Vercel Blob store. When the store's read-write token
// is available we can lock image optimization to that exact store; otherwise
// fall back to any public Blob host (only the /photos/ folder either way).
function blobHostname(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN ?? "";
  const storeId = process.env.BLOB_STORE_ID ?? token.match(/^vercel_blob_rw_([a-z0-9]+)_/i)?.[1];
  return storeId
    ? `${storeId.replace(/^store_/, "").toLowerCase()}.public.blob.vercel-storage.com`
    : "*.public.blob.vercel-storage.com";
}

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: blobHostname(), pathname: "/photos/**", search: "" },
    ],
    // /files/** is the local-disk storage used in development; /images/** is
    // for a portrait committed to the repo (see site.config.ts).
    localPatterns: [
      { pathname: "/files/photos/**", search: "" },
      { pathname: "/images/**", search: "" },
    ],
    // A small set of widths keeps the number of image transformations (a
    // metered resource on Vercel's free plan) low.
    deviceSizes: [640, 828, 1080, 1440, 2048],
    imageSizes: [256, 384],
    qualities: [75],
    // Uploaded photos never change (each upload gets a new URL), so optimized
    // copies can be cached for a long time.
    minimumCacheTTL: 2678400,
  },
};

export default nextConfig;
