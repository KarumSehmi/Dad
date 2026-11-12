@AGENTS.md

# Memorial site for Harvey Sehmi

A Next.js 16 app (Cache Components on) deployed to Vercel, with Firebase
Storage holding everything people share: the memories' words and settings,
photos and videos. See README.md for features, setup and the storage layout.

- Personal content (name, dates, tribute) lives in `site.config.ts`.
- All writes go through `app/actions.ts` (server actions, which call
  `updateTag`) or `app/api/photos/route.ts` (uploads). Reads go through the
  cached getters in `lib/data.ts`.
- Without `FIREBASE_SERVICE_ACCOUNT` and `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`,
  storage falls back to the local `.data` folder, so `npm run dev` works
  offline.
- Nothing is stored on or served through Vercel. In November 2026 photos used
  up Vercel Blob's free allowance, Vercel blocked the store for 30 days, and
  every photo went blank and nothing could be saved. So:
  - The words are files in Firebase that only the site can reach, with its
    service account key (`lib/storage.ts`, `lib/firebase-admin.ts`). Vercel
    Blob is only read once, by `moveFromVercelBlob`, to copy the old files
    across. Never write to it or read from it otherwise.
  - Photos are uploaded to Firebase with a copy at each width
    (`lib/photo-storage.ts`), and `next/image` points straight at those files
    through the loader in `lib/image-loader.ts` (`lib/image-url.ts`). Never
    resize photos on Vercel or switch to Vercel's image optimizer (the default
    loader or `unoptimized`).
- Every existing photo has exactly the widths in `PHOTO_WIDTHS`
  (`lib/image-url.ts`). Changing them means making the new copies of every
  photo in Firebase first, and updating `storage.rules`.
- Videos go from the browser to Firebase (`lib/upload-video.ts`).
  `storage.rules` is what's published in Firebase; keep it in step with
  `LIMITS.photoBytes`, `LIMITS.videoBytes` and the file names, and tell the
  family to publish it again when it changes.
- Checks: `npx tsc --noEmit`, `npm run lint`, `npm run build`.
