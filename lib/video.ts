// Videos go straight from the sharer's browser to Firebase Storage
// (lib/firebase-storage.ts), as video-<id>.<ext>. Each video also gets a still
// frame, uploaded like any other photo, which stands in for it in galleries.
// Videos can be shared once NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is set.

import { firebaseEnabled } from "./firebase-storage";

export const videosEnabled = firebaseEnabled;

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

export function videoPath(id: string, ext: string): string {
  return `video-${id}.${ext}`;
}
