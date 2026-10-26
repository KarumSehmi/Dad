@AGENTS.md

# Memorial site for Harvey Sehmi

A Next.js 16 app (Cache Components on) deployed to Vercel, with Vercel Blob as
the only storage. See README.md for features, setup and the storage layout.

- Personal content (name, dates, tribute) lives in `site.config.ts`.
- All writes go through `app/actions.ts` (server actions, which call
  `updateTag`) or `app/api/photos/route.ts` (uploads). Reads go through the
  cached getters in `lib/data.ts`.
- Without `BLOB_READ_WRITE_TOKEN`, storage falls back to the local `.data`
  folder, so `npm run dev` works offline.
- Keep the Vercel Hobby limits in mind (README, "Free plan limits"): avoid
  extra Blob `list`/`put` calls, and keep image widths limited in
  `next.config.ts`.
- Checks: `npx tsc --noEmit`, `npm run lint`, `npm run build`.
