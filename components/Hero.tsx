import Image from "next/image";
import Link from "next/link";
import { count, initials, joinList } from "@/lib/format";
import type { Photo } from "@/lib/types";
import { lifeDates, site } from "@/site.config";

export function Hero({
  portrait,
  memoryCount,
  mediaCounts,
}: {
  portrait?: Pick<Photo, "url" | "color">;
  memoryCount: number;
  /** e.g. ["12 photos", "2 videos"] */
  mediaCounts: string[];
}) {
  const dates = lifeDates();
  return (
    <section className="hero">
      <div className="container hero-inner">
        {/* A snapshot, like a polaroid. */}
        <div className="hero-photo">
          <div className="polaroid">
            <div className="polaroid-picture">
              {portrait ? (
                <Image
                  src={portrait.url}
                  alt={site.name}
                  fill
                  sizes="(max-width: 640px) 70vw, 340px"
                  preload
                  style={{ backgroundColor: portrait.color }}
                />
              ) : (
                <span className="hero-initials" aria-hidden="true">
                  {initials(site.name)}
                </span>
              )}
            </div>
          </div>
        </div>
        <p className="eyebrow">Celebrating the life of</p>
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
            {joinList([count(memoryCount, "memory", "memories"), ...mediaCounts])} shared so far
          </p>
        )}
        <div className="ornament" aria-hidden="true">
          <span>{initials(site.name)}</span>
        </div>
      </div>
    </section>
  );
}
