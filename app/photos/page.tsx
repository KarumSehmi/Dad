import type { Metadata } from "next";
import Link from "next/link";
import { PhotoGrid } from "@/components/PhotoGrid";
import { galleryPhotos, getMemories } from "@/lib/data";
import { count } from "@/lib/format";
import { site } from "@/site.config";

export const metadata: Metadata = {
  title: "Photos",
  description: `Photos of ${site.name} shared by family and friends.`,
};

export default async function PhotosPage() {
  const photos = galleryPhotos(await getMemories());

  return (
    <section className="section container page-top" aria-labelledby="photos-title">
      <div className="page-head">
        <div>
          <h1 id="photos-title">Photos of {site.firstName}</h1>
          <p className="page-lede">
            {photos.length > 0
              ? `${count(photos.length, "photo", "photos")} shared by family and friends. Tap any photo to see it larger.`
              : "Photos shared by family and friends will appear here."}
          </p>
        </div>
        <Link href="/share" className="btn btn-primary">
          Add photos
        </Link>
      </div>

      {photos.length > 0 ? (
        <PhotoGrid photos={photos} />
      ) : (
        <div className="empty">
          <p>No photos yet.</p>
          <p>If you have a photo of {site.firstName}, it would mean a lot to share it here.</p>
          <Link href="/share" className="btn btn-primary">
            Share a photo
          </Link>
        </div>
      )}
    </section>
  );
}
