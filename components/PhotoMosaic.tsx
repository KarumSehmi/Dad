"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { formatDuration } from "@/lib/format";
import type { GalleryPhoto } from "@/lib/types";
import { PlayIcon } from "./icons";
import { useLightbox } from "./Lightbox";

// Most memories come with lots of photos (half have 11 or more), so a memory
// shows a few as a collage, the first one large, with "+12" on the last for
// the ones that don't fit. Tapping any of them opens all of the memory's
// photos. A phone shows up to six and a bigger screen five, laid out by
// .mosaic in globals.css according to how many there are.
const MOST_SHOWN = 6;
const MOST_SHOWN_WIDE = 5;

/** How wide each tile is drawn: a share of a phone's width, or pixels on a bigger screen. */
function tileSizes(count: number, i: number): string {
  const phone = count === 1 ? 90 : count === 2 || count === 4 || (count === 5 && i >= 3) ? 45 : i === 0 ? 60 : 30;
  const wide = count === 1 ? 680 : count <= 3 || i === 0 || (count === 4 && i === 3) ? 340 : 170;
  return `(max-width: 640px) ${phone}vw, ${wide}px`;
}

/** A lone photo keeps most of its shape: nothing wider than 16:9 or taller than 4:5. */
function singleRatio(photo: GalleryPhoto): number {
  return Math.min(16 / 9, Math.max(4 / 5, photo.width / photo.height));
}

export function PhotoMosaic({ photos }: { photos: GalleryPhoto[] }) {
  const open = useLightbox();
  const shown = photos.slice(0, MOST_SHOWN);
  const style = shown.length === 1 ? ({ "--ar": singleRatio(photos[0]).toFixed(4) } as CSSProperties) : undefined;

  return (
    <ul className="mosaic" data-count={shown.length} style={style}>
      {shown.map((photo, i) => {
        // The last tile on each layout says how many more there are.
        const moreWide = i === MOST_SHOWN_WIDE - 1 ? photos.length - MOST_SHOWN_WIDE : 0;
        const moreNarrow = i === MOST_SHOWN - 1 ? photos.length - MOST_SHOWN : 0;
        const label = photo.caption || `${photo.video ? "Video" : "Photo"} shared by ${photo.sharedBy}`;
        return (
          <li key={photo.id} className="mosaic-cell">
            <button
              type="button"
              className="photo-tile"
              onClick={() => open(photos, i)}
              aria-label={moreWide > 0 || moreNarrow > 0 ? `${label}, one of ${photos.length}` : label}
            >
              <Image src={photo.url} alt="" fill sizes={tileSizes(shown.length, i)} style={{ backgroundColor: photo.color }} />
              {photo.video && (
                <>
                  <span className="play-button" aria-hidden="true">
                    <PlayIcon width={22} height={22} />
                  </span>
                  {photo.video.duration ? <span className="video-time">{formatDuration(photo.video.duration)}</span> : null}
                </>
              )}
              {moreWide > 0 && (
                <span className="photo-more photo-more-wide" aria-hidden="true">
                  +{moreWide}
                </span>
              )}
              {moreNarrow > 0 && (
                <span className="photo-more photo-more-narrow" aria-hidden="true">
                  +{moreNarrow}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
