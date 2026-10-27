import { galleryPhotos } from "@/lib/data";
import { avatarColor, formatDate, initials } from "@/lib/format";
import type { Memory } from "@/lib/types";
import { AdminMemoryActions } from "./AdminMemoryActions";
import { PhotoGrid } from "./PhotoGrid";
import { Reactions } from "./Reactions";

export function MemoryCard({ memory }: { memory: Memory }) {
  const photos = galleryPhotos([memory]);
  const paragraphs = memory.message?.split(/\n\s*\n/) ?? [];

  return (
    <article id={`m-${memory.id}`} className="memory">
      <header className="memory-head">
        <span className="avatar" style={{ backgroundColor: avatarColor(memory.name) }} aria-hidden="true">
          {initials(memory.name)}
        </span>
        <div className="memory-who">
          <h3 className="memory-name">{memory.name}</h3>
          <p className="memory-meta">
            {memory.relationship && <span>{memory.relationship}</span>}
            <time dateTime={memory.createdAt}>{formatDate(memory.createdAt)}</time>
          </p>
        </div>
      </header>

      {paragraphs.length > 0 && (
        <div className="memory-message">
          {paragraphs.map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>
      )}

      {photos.length > 0 && (
        <PhotoGrid photos={photos} variant="memory" max={6} />
      )}

      <Reactions memoryId={memory.id} />

      <AdminMemoryActions memoryId={memory.id} name={memory.name} />
    </article>
  );
}
