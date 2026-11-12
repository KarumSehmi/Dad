// Every photo and video shared on the site is kept in a Firebase Storage
// bucket, and visitors' browsers load them straight from there. Vercel only
// serves the pages and keeps the memories' words (lib/storage.ts).
//
// Firebase is pay-as-you-go: past its free allowance it charges a few pence,
// where Vercel Blob's free plan blocks the whole store for 30 days. That
// happened in November 2026 and took every photo off the site, so photos must
// never go back to Vercel Blob or be served through Vercel.
//
// Switched on by NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET (see the README); who may
// read and add files is set by storage.rules.
// NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_HOST points everything at a local
// Firebase emulator instead, for testing.

export const firebaseBucket = (process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "")
  .trim()
  .replace(/^gs:\/\//, "")
  .replace(/\/+$/, "");

export const firebaseEmulatorHost = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_HOST ?? "";

export const firebaseEnabled = firebaseBucket !== "";

const origin = firebaseEmulatorHost ? `http://${firebaseEmulatorHost}` : "https://firebasestorage.googleapis.com";

// Files are kept at the top of the bucket, with no folders: Firebase writes a
// folder's "/" as "%2F" in the file's web address, and some networks rewrite
// that back to "/", which Firebase then refuses, so the file wouldn't load.

/** Firebase's address for a stored file's details, as JSON. */
export function storedFileUrl(name: string): string {
  return `${origin}/v0/b/${firebaseBucket}/o/${encodeURIComponent(name)}`;
}

/** Firebase's address for a stored file itself. */
export function storedFileMediaUrl(name: string): string {
  return `${storedFileUrl(name)}?alt=media`;
}

/** Where to send a new file called `name` (anyone may add files that storage.rules allows). */
export function uploadUrl(name: string): string {
  return `${origin}/v0/b/${firebaseBucket}/o?name=${encodeURIComponent(name)}`;
}
