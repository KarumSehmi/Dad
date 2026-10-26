import { readFile } from "node:fs/promises";
import path from "node:path";
import { localFilePath, storageMode } from "@/lib/storage";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".json": "application/json",
};

// Serves files from the local .data folder. Only used when running without
// Vercel Blob (local development); Blob files are served by Vercel directly.
export async function GET(request: Request, ctx: RouteContext<"/files/[...path]">) {
  const { path: segments } = await ctx.params;
  const file = storageMode() === "local" ? localFilePath(segments.join("/")) : null;
  const type = file ? CONTENT_TYPES[path.extname(file)] : undefined;
  if (!file || !type) return new Response("Not found", { status: 404 });

  let data: Buffer;
  try {
    data = await readFile(file);
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const headers = new Headers({
    "content-type": type,
    "cache-control": "public, max-age=31536000, immutable",
  });
  if (new URL(request.url).searchParams.has("download")) {
    headers.set("content-disposition", `attachment; filename="${path.basename(file)}"`);
  }
  return new Response(new Uint8Array(data), { headers });
}
