# In loving memory of Harvey Sehmi

A memorial website where family and friends can share photos of Harvey, read
what others have written, and leave their own memories.

- **Home page**: a portrait, a few words about Harvey, recent photos, and every
  memory people have shared.
- **Photos**: every shared photo in one gallery. Tap any photo to see it full
  screen, swipe through, or download it.
- **Share a memory**: anyone with the link can add their name, a message, and
  up to 30 photos at a time. No account needed.
- **Family admin**: signed-in family members can delete memories or photos,
  and pick which photo appears at the top of the home page.

Photos are resized in the visitor's browser before upload (to at most 2048
pixels on the long side), which keeps uploads quick on a phone and removes the
location data phones embed in photos.

## Making it personal

Edit [`site.config.ts`](site.config.ts) to change:

- `born` and `died`, shown under the name, e.g. `"1952"` and `"2026"`
- `tribute`, the few words under the name (one string per paragraph)
- `timeZone`, used to date each memory

The photo at the top of the home page is `public/images/harvey.jpg` (set by
`portrait` in `site.config.ts`). A family admin can also swap it from the site
itself: sign in at `/admin`, open any shared photo, and press **Use as main
photo**.

## Putting it online (Vercel)

The site is built to run on [Vercel](https://vercel.com)'s free plan, with
photos and messages kept in Vercel Blob storage.

1. In Vercel, **Add New → Project** and import this GitHub repository. Vercel
   deploys it automatically, and again every time the main branch changes.
2. In the project, open **Storage → Create → Blob**, choose **public** access,
   and connect it to the project. This adds `BLOB_READ_WRITE_TOKEN` for you.
3. In **Settings → Environment Variables**, add `ADMIN_PASSWORD` with a long
   password that only the family knows.
4. Redeploy (**Deployments → ⋯ → Redeploy**) so the new settings take effect.

Until storage is connected, the site shows a notice and nothing can be shared.

### Free plan limits

Vercel's free (Hobby) plan includes, each month, 1 GB of Blob storage
(roughly 2,000 photos at the sizes this site uses), 10 GB of Blob downloads,
2,000 "advanced" Blob operations (each uploaded photo, saved memory, or page
refresh after a change uses one) and 5,000 image resizes. The site is designed
to stay well inside these: pages are cached, and photos are shown through
Vercel's image optimizer at the size each screen needs.

On the free plan, going over a Blob limit pauses storage until the 30-day
period resets, and Vercel emails a warning before that happens. If the site is
shared very widely, the Pro plan removes the hard limits.

## Looking after the site

Go to `/admin` (there's a **Family admin** link at the bottom of every page)
and sign in with `ADMIN_PASSWORD`. While signed in on that device you'll see:

- **Delete memory** under each memory
- **Delete** and **Use as main photo** when you open any photo

Changing `ADMIN_PASSWORD` signs everyone out.

Everything shared is visible to anyone with the link, and search engines are
asked not to list the site. Set `allowSearchEngines: true` in `site.config.ts`
if you'd like people to be able to find it by searching.

## Running it on your computer

Requires Node.js 20.9 or later.

```bash
npm install
ADMIN_PASSWORD=choose-one npm run dev
```

Then open http://localhost:3000. Without a Blob token, photos and memories are
saved in a local `.data` folder instead.

## How it works

- [Next.js 16](https://nextjs.org) with Cache Components. Pages are
  prerendered and only rebuilt when something is shared, deleted, or changed
  (`updateTag` in [`app/actions.ts`](app/actions.ts)), plus a daily refresh.
- [Vercel Blob](https://vercel.com/docs/vercel-blob) holds everything as
  files: `photos/<id>/photo.jpg`, one JSON file per memory in
  `memories/<id>/`, and admin settings in `settings/`. See
  [`lib/storage.ts`](lib/storage.ts).
- Uploads go through [`app/api/photos/route.ts`](app/api/photos/route.ts),
  which checks each file is a real JPEG and returns a signed receipt; a memory
  can only include photos with a valid receipt.
- [`components/ShareForm.tsx`](components/ShareForm.tsx) and
  [`lib/prepare-photo.ts`](lib/prepare-photo.ts) prepare photos in the browser.
- [`components/PhotoGrid.tsx`](components/PhotoGrid.tsx) lays photos out in
  justified rows, and [`components/Lightbox.tsx`](components/Lightbox.tsx) is
  the full-screen viewer.

Optional environment variables:

- `SITE_URL`, the site's full address (e.g. `https://harveysehmi.com`), used
  for link previews. Defaults to Vercel's production domain.
- `SESSION_SECRET` (any long random string) signs photo receipts. It isn't
  needed on Vercel, where the Blob token is used.
