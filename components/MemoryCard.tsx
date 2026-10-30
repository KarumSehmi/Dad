import { galleryPhotos } from "@/lib/data";
import { avatarColor, formatDate, initials } from "@/lib/format";
import type { Memory } from "@/lib/types";
import { AdminMemoryActions } from "./AdminMemoryActions";
import { MemoryMessage } from "./MemoryMessage";
import { PhotoMosaic } from "./PhotoMosaic";

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

      {paragraphs.length > 0 && <MemoryMessage paragraphs={paragraphs} />}

      {photos.length > 0 && <PhotoMosaic photos={photos} />}

      <AdminMemoryActions memoryId={memory.id} name={memory.name} />
    </article>
  );
}
