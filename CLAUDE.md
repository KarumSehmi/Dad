@AGENTS.md

# Memorial site for Harvey Sehmi

A Next.js 16 app (Cache Components on) deployed to Vercel, with Vercel Blob
storing the memories' words and settings, and Firebase Storage storing every
photo and video. See README.md for features, setup and the storage layout.

- Personal content (name, dates, tribute) lives in `site.config.ts`.
- All writes go through `app/actions.ts` (server actions, which call
  `updateTag`) or `app/api/photos/route.ts` (uploads). Reads go through the
  cached getters in `lib/data.ts`.
- Without `BLOB_READ_WRITE_TOKEN` and `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`,
  storage falls back to the local `.data` folder, so `npm run dev` works
  offline.
- Photos and videos never touch Vercel's storage or CDN. In November 2026
  photos used up Vercel Blob's free allowance, Vercel blocked the store for 30
  days, and every photo went blank. Photos are now uploaded to Firebase with a
  copy at each width (`lib/photo-storage.ts`), and `next/image` points straight
  at those files through the loader in `lib/image-loader.ts`
  (`lib/image-url.ts`). Never store or read photos in Vercel Blob, resize
  them on Vercel, or switch to Vercel's image optimizer (the default loader or
  `unoptimized`).
- Every existing photo has exactly the widths in `PHOTO_WIDTHS`
  (`lib/image-url.ts`). Changing them means making the new copies of every
  photo in Firebase first, and updating `storage.rules`.
- Videos go from the browser to Firebase (`lib/upload-video.ts`).
  `storage.rules` is what's published in Firebase; keep it in step with
  `LIMITS.photoBytes`, `LIMITS.videoBytes` and the file names, and tell the
  family to publish it again when it changes.
- Keep the Vercel Hobby limits in mind (README, "Free plan limits"): avoid
  extra Blob `list`/`put` calls.
- Checks: `npx tsc --noEmit`, `npm run lint`, `npm run build`.
