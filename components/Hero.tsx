import Image from "next/image";
import Link from "next/link";
import { count, initials } from "@/lib/format";
import type { Photo } from "@/lib/types";
import { lifeDates, site } from "@/site.config";
import { FlameIcon } from "./icons";

export function Hero({
  portrait,
  memoryCount,
  photoCount,
}: {
  portrait?: Pick<Photo, "url" | "color">;
  memoryCount: number;
  photoCount: number;
}) {
  const dates = lifeDates();
  return (
    <section className="hero">
      <div className="container hero-inner">
        <div className="hero-portrait">
          {portrait ? (
            <Image
              src={portrait.url}
              alt={site.name}
              fill
              sizes="(max-width: 640px) 220px, 280px"
              preload
              style={{ backgroundColor: portrait.color }}
            />
          ) : (
            <span className="hero-initials" aria-hidden="true">
              {initials(site.name)}
            </span>
          )}
        </div>
        <p className="eyebrow">In loving memory</p>
        <h1 className="hero-name">{site.name}</h1>
        {dates && <p className="hero-dates">{dates}</p>}
        <div className="hero-tribute">
          {site.tribute.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        <div className="hero-actions">
          <Link href="/share" className="btn btn-primary btn-lg">
            Share a memory
          </Link>
          <Link href="/photos" className="btn btn-secondary btn-lg">
            See photos
          </Link>
        </div>
        {memoryCount > 0 && (
          <p className="hero-stats">
            {count(memoryCount, "memory", "memories")} and {count(photoCount, "photo", "photos")} shared so far
          </p>
        )}
        <div className="ornament" aria-hidden="true">
          <FlameIcon width={18} height={18} />
        </div>
      </div>
    </section>
  );
}
