import Link from "next/link";
import { Hero } from "@/components/Hero";
import { InviteButton } from "@/components/InviteButton";
import { MemoryCard } from "@/components/MemoryCard";
import { PeopleRow } from "@/components/PeopleRow";
import { StorageNotice } from "@/components/StorageNotice";
import { ThankYouToast } from "@/components/ThankYouToast";
import { galleryPhotos, getMemories, getSettings, peopleOf } from "@/lib/data";
import { count } from "@/lib/format";
import { site } from "@/site.config";

export default async function HomePage() {
  const [memories, settings] = await Promise.all([getMemories(), getSettings()]);
  const photos = galleryPhotos(memories);
  const videoCount = photos.filter((photo) => photo.video).length;
  const people = peopleOf(memories);
  const portrait = settings.portrait ?? (site.portrait ? { url: site.portrait, color: "#d9cfc1" } : undefined);

  return (
    <>
      <StorageNotice />
      <Hero
        portrait={portrait}
        memoryCount={memories.length}
        photoCount={photos.length - videoCount}
        videoCount={videoCount}
      />

      {/* People mostly share photos (about a dozen each), so the way in is
          by person: tap someone to flick through theirs. */}
      {people.length > 0 && (
        <section className="section container" aria-labelledby="people">
          <div className="section-head">
            <h2 id="people">From {count(people.length, "person", "people")}</h2>
            {photos.length > 0 && (
              <Link href="/photos" className="section-link">
                See all {photos.length.toLocaleString(site.locale)}
              </Link>
            )}
          </div>
          <p className="section-hint">Pick someone to see their photos.</p>
          <PeopleRow people={people} />
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
              Be the first to share a favourite photo or a story about {site.firstName} that makes you smile.
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
