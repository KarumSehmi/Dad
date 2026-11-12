# In loving memory of Harvey Sehmi

A memorial website where family and friends can share photos and videos of
Harvey, read what others have written, and leave their own memories.

- **Home page**: a portrait, a few words about Harvey, and every memory people
  have shared, each with its photos as a collage. Very long messages start
  folded, with "Read more".
- **Photos**: every shared photo and video, grouped by who shared them. Tap any
  photo to see it full screen, swipe through them all, or download it; tap a
  video to play it.
- **Share a memory**: anyone with the link can add their name, a message, and
  up to 30 photos and videos at a time. No account needed.
- **Family admin**: signed-in family members can delete memories, photos or
  videos, and pick which photo appears at the top of the home page.

Photos are resized in the visitor's browser before upload (to at most 2048
pixels on the long side), which keeps uploads quick on a phone and removes the
location data phones embed in photos. Videos are uploaded as they are (up to
500 MB each), minus the location phones record in them.

## Making it personal

Edit [`site.config.ts`](site.config.ts) to change:

- `born` and `died`, shown under the name, e.g. `"1952"` and `"2026"`
- `tribute`, the few words under the name (one string per paragraph)
- `timeZone`, used to date each memory
- `relationships`, the choices people pick from for "How you knew Harvey",
  including the Punjabi family titles his children use (e.g. Mamaji for his
  wife's brother). Anything not on this list is ignored.

The photo at the top of the home page, shown square like a polaroid, is
`public/images/harvey-pointing.jpg` (set by `portrait` in `site.config.ts`).
To change it, add the new photo under a new file name, since resized copies
of the old one are kept for up to a year. A family admin can also swap it from
the site itself: sign in at `/admin`, open any shared photo, and press **Use as
main photo**.

The look is set by the colours at the top of [`app/globals.css`](app/globals.css)
(a warm red-orange and marigold) and the Fraunces font in
[`app/layout.tsx`](app/layout.tsx).

## Putting it online (Vercel)

The site is built to run on [Vercel](https://vercel.com)'s free plan, with
the messages kept in Vercel Blob storage and the photos and videos in Firebase
Storage (below).

1. In Vercel, **Add New → Project** and import this GitHub repository. Vercel
   deploys it automatically, and again every time the main branch changes.
2. In the project, open **Storage → Create → Blob**, choose **public** access,
   and connect it to the project. This adds `BLOB_READ_WRITE_TOKEN` for you.
3. In **Settings → Environment Variables**, add `ADMIN_PASSWORD` with a long
   password that only the family knows.
4. Redeploy (**Deployments → ⋯ → Redeploy**) so the new settings take effect.

Until storage is connected, the site shows a notice and nothing can be shared.

### Photos and videos (Firebase Storage)

Photos and videos are kept in a Firebase Storage bucket, and visitors' phones
and computers load them straight from there. Until one is connected, the site
shows a notice and only words can be shared.

1. At [console.firebase.google.com](https://console.firebase.google.com),
   create a project. Analytics isn't needed.
2. Upgrade the project to the **Blaze** plan. Firebase requires it for
   storage, but nothing is charged within the free allowance (below). Set a
   budget alert while you're there.
3. Open **Storage**, click **Get started**, and pick one of the no-cost
   locations (US-CENTRAL1, US-EAST1 or US-WEST1) and production mode.
4. On the **Rules** tab, replace the rules with the contents of
   [`storage.rules`](storage.rules) and click **Publish**. They let anyone
   see the photos and videos and add new ones (photos up to 5 MB, videos up to
   500 MB), but not list, replace or delete them. Publish them again whenever
   `storage.rules` changes.
5. In Vercel, add the environment variable
   `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` with the bucket name shown on the
   **Files** tab (e.g. `harvey-sehmi.firebasestorage.app`), then redeploy.

### Free plan limits

The site is built so that no free allowance running out can take the photos
and videos off it.

- **Vercel** (free Hobby plan) only serves the pages and keeps the messages.
  That's a small part of each monthly allowance: 1 GB of Blob storage, 2,000
  "advanced" Blob operations (each saved memory or page refresh after a change
  uses one or two), 10 GB of Blob downloads, and 100 GB of page downloads.
  Going over a Blob limit blocks the store for 30 days; the pages would still
  show, but nothing new could be shared until it resets.
- **Firebase** holds the photos and videos. Its no-cost allowance (for the US
  locations above) is 5 GB stored and 100 GB of downloads each month. Each
  photo takes 1 to 2 MB with its copies, and the videos shared so far about
  800 MB. Past the allowance it costs a couple of pence per GB stored and
  around ten pence per GB downloaded, and the budget alert lets you know. It
  never blocks anything.

Until November 2026 photos were kept in Vercel Blob and resized on Vercel. A
busy week used up the Blob allowance, Vercel blocked the store, and every photo
went blank for a week. Photos have been in Firebase since, and must never go
back to Vercel Blob or be served through Vercel. The old copies are still in
the Blob store's `photos/` folder; nothing uses them, and they can be deleted.

## Looking after the site

Go to `/admin` (for example `harveysehmi.com/admin`) and sign in with
`ADMIN_PASSWORD`. Nothing on the site links there, so visitors won't come
across it; bookmark it. While signed in on that device you'll see:

- A **Family admin** link at the bottom of every page, back to `/admin`
- **Delete memory** under each memory
- **Delete** and **Use as main photo** when you open any photo (videos can be
  deleted but not used as the main photo)

Changing `ADMIN_PASSWORD` signs everyone out.

Deleting a photo or video takes it off the site, but the site can't remove its
files from Firebase (its rules don't allow deleting), so anyone who already
has a file's exact web address can still open it. If a photo or video must be
gone for good, delete its files in the Firebase console's Storage page. A
video is one file, `video-` plus a long code, shown at the end of the video's
web address. A photo is eight: `photo-` plus the code shown at the end of its
Download link, followed by `.jpg` or by a width and `.jpg`.

Everything shared is visible to anyone with the link, and search engines are
asked not to list the site. Set `allowSearchEngines: true` in `site.config.ts`
if you'd like people to be able to find it by searching.

## Running it on your computer

Requires Node.js 20.9 or later.

```bash
npm install
ADMIN_PASSWORD=choose-one npm run dev
```

Then open http://localhost:3000. Without a Blob token or a Firebase bucket,
photos and memories are saved in a local `.data` folder instead.

## How it works

- [Next.js 16](https://nextjs.org) with Cache Components. Pages are
  prerendered and only rebuilt when something is shared, deleted, or changed
  (`updateTag` in [`app/actions.ts`](app/actions.ts)), plus a daily refresh.
- [Vercel Blob](https://vercel.com/docs/vercel-blob) holds the words as
  files: one JSON file per memory in `memories/<id>/`, and admin settings in
  `settings/`. See [`lib/storage.ts`](lib/storage.ts).
- [Firebase Storage](https://firebase.google.com/docs/storage) holds the
  photos and videos, all at the top of the bucket: `photo-<id>.jpg` as shared,
  `photo-<id>.<width>.jpg` for each width the site shows, and
  `video-<id>.<ext>`. See [`lib/firebase-storage.ts`](lib/firebase-storage.ts).
- Photo uploads go through [`app/api/photos/route.ts`](app/api/photos/route.ts),
  which checks each file is a real JPEG, makes a copy at every width the site
  shows with [sharp](https://sharp.pixelplumbing.com), stores them all in
  Firebase ([`lib/photo-storage.ts`](lib/photo-storage.ts)) and returns a
  signed receipt; a memory can only include photos with a valid receipt.
- [`components/ShareForm.tsx`](components/ShareForm.tsx) and
  [`lib/prepare-photo.ts`](lib/prepare-photo.ts) prepare photos in the browser.
- [`components/PhotoMosaic.tsx`](components/PhotoMosaic.tsx) is a memory's
  collage, [`components/PhotoGrid.tsx`](components/PhotoGrid.tsx) lays the
  photos page out in justified rows, and
  [`components/Lightbox.tsx`](components/Lightbox.tsx) is the full-screen viewer.
- Photos are shown at a few fixed widths ([`lib/image-url.ts`](lib/image-url.ts)),
  loaded straight from Firebase, so they never use Vercel's allowances. Only
  the photos in `public/images` are resized on Vercel, by
  [`app/img/[width]/[...path]/route.ts`](app/img/[width]/[...path]/route.ts).
- Videos go straight from the browser to Firebase Storage
  ([`lib/upload-video.ts`](lib/upload-video.ts)), as
  `video-<id>.<ext>`. Before that, [`lib/prepare-video.ts`](lib/prepare-video.ts)
  takes a still from the video, which is uploaded like a photo and stands in
  for it in galleries, and [`lib/video-location.ts`](lib/video-location.ts)
  blanks the location in its metadata. When the memory is saved, the server
  checks with Firebase that each video really arrived.

Optional environment variables:

- `SITE_URL`, the site's full address (e.g. `https://harveysehmi.com`), used
  for link previews. Defaults to Vercel's production domain.
- `SESSION_SECRET` (any long random string) signs photo receipts. It isn't
  needed on Vercel, where the Blob token is used.
- `NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_HOST` (e.g. `127.0.0.1:9199`) sends
  photos and videos to a local
  [Firebase emulator](https://firebase.google.com/docs/emulator-suite) instead,
  for testing. Run it with `storage.rules` and any bucket name.
