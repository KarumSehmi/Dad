import Image from "next/image";
import Link from "next/link";
import { initials } from "@/lib/format";
import type { Photo } from "@/lib/types";
import { lifeDates, site } from "@/site.config";

export function Hero({
  portrait,
  memoryCount,
  photoCount,
  videoCount,
}: {
  portrait?: Pick<Photo, "url" | "color">;
  memoryCount: number;
  photoCount: number;
  videoCount: number;
}) {
  const dates = lifeDates();
  // Photos and videos are only counted once there are some.
  const stats = (
    [
      [memoryCount, "memory", "memories"],
      [photoCount, "photo", "photos"],
      [videoCount, "video", "videos"],
    ] as const
  ).filter(([n], i) => i === 0 || n > 0);
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
          <ul className="hero-stats" aria-label="Shared so far">
            {stats.map(([n, one, many]) => (
              <li key={many}>
                <strong>{n.toLocaleString(site.locale)}</strong> {n === 1 ? one : many}
              </li>
            ))}
          </ul>
        )}
        <div className="ornament" aria-hidden="true">
          <span>{initials(site.name)}</span>
        </div>
      </div>
    </section>
  );
}
