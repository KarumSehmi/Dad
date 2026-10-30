import type { Metadata } from "next";
import Link from "next/link";
import { GalleryByPerson } from "@/components/GalleryByPerson";
import { galleryPhotos, getMemories, peopleOf } from "@/lib/data";
import { joinList, mediaCounts } from "@/lib/format";
import { site } from "@/site.config";

export const metadata: Metadata = {
  title: "Photos",
  description: `Photos of ${site.name} shared by family and friends.`,
};

export default async function PhotosPage() {
  const memories = await getMemories();
  const photos = galleryPhotos(memories);
  const hasVideos = photos.some((photo) => photo.video);

  return (
    <section className="section container page-top" aria-labelledby="photos-title">
      <div className="page-head">
        <div>
          <h1 id="photos-title">Photos of {site.firstName}</h1>
          <p className="page-lede">
            {photos.length > 0
              ? `${joinList(mediaCounts(photos))} shared by family and friends. Tap any photo to see it larger${
                  hasVideos ? ", or a video to play it" : ""
                }.`
              : "Photos shared by family and friends will appear here."}
          </p>
        </div>
        <Link href="/share" className="btn btn-primary">
          Add photos
        </Link>
      </div>

      {photos.length > 0 ? (
        <GalleryByPerson people={peopleOf(memories)} />
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
