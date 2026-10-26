// Videos are far too big for the site's own storage (Vercel Blob, whose free
// plan holds 1 GB in total), so they go straight from the sharer's browser to
// a Firebase Storage bucket, as video-<id>.<ext>. Each video also gets a still
// frame, uploaded like any other photo, which stands in for it in galleries.
//
// Videos are switched on by setting NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET (see
// the README); the bucket's rules are in storage.rules.
// NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_HOST points everything at a local
// Firebase emulator instead, for testing.

const bucket = (process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "")
  .trim()
  .replace(/^gs:\/\//, "")
  .replace(/\/+$/, "");
const emulatorHost = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_HOST ?? "";

export const videosEnabled = bucket !== "";

export const videoStorage = { bucket, emulatorHost };

const origin = emulatorHost ? `http://${emulatorHost}` : "https://firebasestorage.googleapis.com";

/** The kinds of video people can share, by file extension. */
export const VIDEO_TYPES: Readonly<Record<string, string>> = {
  mp4: "video/mp4",
  m4v: "video/x-m4v",
  mov: "video/quicktime",
  webm: "video/webm",
  "3gp": "video/3gpp",
};

export function isVideoExtension(ext: string): boolean {
  return Object.hasOwn(VIDEO_TYPES, ext);
}

/** New video ids are 32 random hex digits (the storage rules check this). */
export const VIDEO_ID = /^[0-9a-f]{32}$/;

// Kept at the top of the bucket, with no folders: Firebase writes a folder's
// "/" as "%2F" in the file's web address, and some networks rewrite that
// back to "/", which Firebase then refuses, so the video wouldn't play.
export function videoPath(id: string, ext: string): string {
  return `video-${id}.${ext}`;
}

/** Firebase's address for a stored file: its details as JSON, or with ?alt=media, the file itself. */
export function storedFileUrl(path: string): string {
  return `${origin}/v0/b/${bucket}/o/${encodeURIComponent(path)}`;
}
