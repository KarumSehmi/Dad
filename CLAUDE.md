@AGENTS.md

# Memorial site for Harvey Sehmi

A Next.js 16 app (Cache Components on) deployed to Vercel, with Vercel Blob
storing photos and memories, and Firebase Storage for videos. See README.md for
features, setup and the storage layout.

- Personal content (name, dates, tribute) lives in `site.config.ts`.
- All writes go through `app/actions.ts` (server actions, which call
  `updateTag`) or `app/api/photos/route.ts` (uploads). Reads go through the
  cached getters in `lib/data.ts`.
- Without `BLOB_READ_WRITE_TOKEN`, storage falls back to the local `.data`
  folder, so `npm run dev` works offline.
- Videos skip Vercel entirely: the browser uploads them to Firebase Storage
  (`lib/video.ts`), and they're off unless `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
  is set. `storage.rules` is what's published in Firebase; keep it in step
  with `LIMITS.videoBytes`.
- Emoji reactions also skip Vercel: the browser reads and bumps counts in
  Firestore over REST (`lib/reactions.ts`, rules in `firestore.rules`), and
  they're off unless `NEXT_PUBLIC_FIREBASE_PROJECT_ID` and
  `NEXT_PUBLIC_FIREBASE_API_KEY` are set. Never store reactions in Blob: every
  tap would cost Blob operations and a page rebuild. Publish rule changes with
  `firebase deploy --only storage,firestore:rules` (`.firebaserc` names the
  project).
- Keep the Vercel Hobby limits in mind (README, "Free plan limits"): avoid
  extra Blob `list`/`put` calls, and keep image widths limited in
  `next.config.ts`.
- Checks: `npx tsc --noEmit`, `npm run lint`, `npm run build`.
