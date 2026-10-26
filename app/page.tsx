import Link from "next/link";
import { Hero } from "@/components/Hero";
import { InviteButton } from "@/components/InviteButton";
import { MemoryCard } from "@/components/MemoryCard";
import { PhotoGrid } from "@/components/PhotoGrid";
import { StorageNotice } from "@/components/StorageNotice";
import { ThankYouToast } from "@/components/ThankYouToast";
import { galleryPhotos, getMemories, getSettings } from "@/lib/data";
import { count, joinList, mediaCounts } from "@/lib/format";
import { site } from "@/site.config";

export default async function HomePage() {
  const [memories, settings] = await Promise.all([getMemories(), getSettings()]);
  const photos = galleryPhotos(memories);
  const hasVideos = photos.some((photo) => photo.video);
  const portrait = settings.portrait ?? (site.portrait ? { url: site.portrait, color: "#d9cfc1" } : undefined);

  return (
    <>
      <StorageNotice />
      <Hero portrait={portrait} memoryCount={memories.length} mediaCounts={mediaCounts(photos)} />

      {photos.length > 0 && (
        <section className="section container" aria-labelledby="recent-photos">
          <div className="section-head">
            <h2 id="recent-photos">{hasVideos ? "Photos and videos" : "Photos"}</h2>
            <Link href="/photos" className="section-link">
              {hasVideos ? `See all ${photos.length.toLocaleString(site.locale)}` : `See all ${joinList(mediaCounts(photos))}`}
            </Link>
          </div>
          <PhotoGrid photos={photos} variant="strip" max={8} />
        </section>
      )}

      <section className="section container narrow" aria-labelledby="memories">
        <div className="section-head">
          <h2 id="memories">Memories</h2>
          {memories.length > 0 && <span className="section-count">{count(memories.length, "memory", "memories")}</span>}
        </div>
        {memories.length > 0 ? (
          <div className="memory-list">
            {memories.map((memory) => (
              <MemoryCard key={memory.id} memory={memory} />
            ))}
          </div>
        ) : (
          <div className="empty">
            <p>Nothing has been shared yet.</p>
            <p>
              Be the first to share a photo or a few words about {site.firstName}.
            </p>
            <Link href="/share" className="btn btn-primary">
              Share a memory
            </Link>
          </div>
        )}
        {memories.length > 2 && (
          <div className="section-foot">
            <Link href="/share" className="btn btn-secondary">
              Add your memory
            </Link>
          </div>
        )}

        <div className="invite">
          <p>Know someone who knew {site.firstName}? Send them the link so they can share their memories too.</p>
          <InviteButton />
        </div>
      </section>

      <ThankYouToast />
    </>
  );
}
