import "server-only";
import sharp from "sharp";
import { firebaseEnabled, storedFileMediaUrl, storedFileUrl, uploadUrl } from "./firebase-storage";
import { PHOTO_WIDTHS, photoFileName } from "./image-url";
import { savePhotoLocally, storageMode } from "./storage";
import { site } from "@/site.config";

// Shared photos are kept in Firebase Storage (see lib/firebase-storage.ts and
// lib/image-url.ts). When running without Firebase (npm run dev), they go to
// the local .data folder instead, and app/img resizes them as they're shown.

export type PhotoStorageMode = "firebase" | "local" | "missing";

export function photoStorageMode(): PhotoStorageMode {
  if (firebaseEnabled) return "firebase";
  return storageMode() === "local" ? "local" : "missing";
}

export class PhotoStorageNotConfiguredError extends Error {
  constructor() {
    super("Photo storage is not connected. Set NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET (see the README).");
  }
}

const ONE_YEAR = 60 * 60 * 24 * 365;

/** A copy of a photo that's `width` pixels wide, or its own width if that's smaller. */
export function resizePhoto(original: Buffer, width: number): Promise<Buffer> {
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

type FileDetails = { contentType: string; cacheControl: string; contentDisposition?: string };

// The same request the Firebase SDK makes for a small upload: the file's
// details and the file itself in one go. storage.rules decides whether it's
// allowed, and never lets a file be replaced.
async function upload(name: string, data: Buffer, details: FileDetails): Promise<void> {
  const boundary = `photo-${crypto.randomUUID()}`;
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=utf-8\r\n\r\n` +
        JSON.stringify({ name, ...details }) +
        `\r\n--${boundary}\r\nContent-Type: ${details.contentType}\r\n\r\n`,
    ),
    data,
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  for (let attempt = 1; ; attempt++) {
    let status = 0;
    try {
      const res = await fetch(uploadUrl(name), {
        method: "POST",
        headers: {
          "content-type": `multipart/related; boundary=${boundary}`,
          "x-goog-upload-protocol": "multipart",
        },
        body,
        signal: AbortSignal.timeout(30_000),
      });
      if (res.ok) return;
      status = res.status;
    } catch (cause) {
      if (attempt >= 3) throw cause;
    }
    // An earlier attempt may have got through even though its answer didn't.
    if (attempt > 1 && (await storedSize(name)) === data.length) return;
    // Firebase refuses (4xx) what storage.rules doesn't allow; trying again won't help.
    const refused = status >= 400 && status < 500 && status !== 429;
    if (refused || attempt >= 3) throw new Error(`Firebase didn't store ${name} (HTTP ${status || "no answer"})`);
    await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
  }
}

async function storedSize(name: string): Promise<number | null> {
  try {
    const res = await fetch(storedFileUrl(name), { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    return res.ok ? Number((await res.json()).size) : null;
  } catch {
    return null;
  }
}

/** How a downloaded photo is named, e.g. "Harvey Sehmi - photo abc123.jpg". */
function downloadName(id: string): string {
  return `${site.name.replace(/[^\w ()-]+/g, "").trim() || "Photo"} - photo ${id}.jpg`;
}

/**
 * Stores a newly shared photo (a JPEG) and a copy of it at every width the
 * site shows, and returns its address.
 */
export async function savePhoto(id: string, original: Buffer): Promise<string> {
  const mode = photoStorageMode();
  if (mode === "missing") throw new PhotoStorageNotConfiguredError();
  if (mode === "local") return savePhotoLocally(id, original);

  const cacheControl = `public, max-age=${ONE_YEAR}, immutable`;
  await Promise.all([
    ...PHOTO_WIDTHS.map(async (width) =>
      upload(photoFileName(id, width), await resizePhoto(original, width), { contentType: "image/jpeg", cacheControl }),
    ),
    // The photo as shared, for the Download button; browsers save it rather than open it.
    upload(photoFileName(id), original, {
      contentType: "image/jpeg",
      cacheControl,
      contentDisposition: `attachment; filename="${downloadName(id)}"`,
    }),
  ]);
  return storedFileMediaUrl(photoFileName(id));
}
