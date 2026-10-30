"use client";

import Image from "next/image";
import { Fragment, type CSSProperties } from "react";
import { formatDuration } from "@/lib/format";
import { splitRows } from "@/lib/justify";
import type { GalleryPhoto } from "@/lib/types";
import { PlayIcon } from "./icons";
import { useLightbox } from "./Lightbox";

// How photos are grouped into rows: the target sum of width÷height ratios per
// row (bigger = more, smaller photos per row), planned separately for phones
// (≤ 640px) and larger screens, with CSS showing the right row breaks for
// each. WIDTH is the grid's widest size on a computer, used to pick image sizes.
const PHONE_ROW = 2.5;
const DESKTOP_ROW = 4.4;
const WIDTH = 1080;

type Plan = { breakAfter: Set<number>; rowSum: number[]; lastRowGap: number };

function plan(ratios: number[], target: number): Plan {
  const { rows, lastRowGap } = splitRows(ratios, target);
  const breakAfter = new Set<number>();
  const rowSum: number[] = [];
  rows.forEach((row, r) => {
    const isLast = r === rows.length - 1;
    const sum = row.reduce((total, i) => total + ratios[i], 0) + (isLast ? lastRowGap : 0);
    for (const i of row) rowSum[i] = sum;
    if (!isLast) breakAfter.add(row[row.length - 1]);
  });
  return { breakAfter, rowSum, lastRowGap };
}

/**
 * Photos in justified rows: every photo in a row is the same height and keeps
 * its shape, and rows fill the width. Tapping one opens it full screen, among
 * these photos, or wherever `onOpen` says.
 */
export function PhotoGrid({ photos, onOpen }: { photos: GalleryPhoto[]; onOpen?: (index: number) => void }) {
  const lightbox = useLightbox();
  const open = onOpen ?? ((index: number) => lightbox(photos, index));
  const ratios = photos.map((p) => p.width / p.height);
  const phone = plan(ratios, PHONE_ROW);
  const desktop = plan(ratios, DESKTOP_ROW);

  const style = { "--fill-m": phone.lastRowGap, "--fill-d": desktop.lastRowGap } as CSSProperties;
  return (
    <ul className="photo-grid" style={style}>
      {photos.map((photo, i) => {
        const label = photo.caption || `${photo.video ? "Video" : "Photo"} shared by ${photo.sharedBy}`;
        const phoneVw = Math.ceil((ratios[i] / phone.rowSum[i]) * 95);
        const desktopPx = Math.ceil((ratios[i] / desktop.rowSum[i]) * WIDTH);
        const breaks = [phone.breakAfter.has(i) && "br-m", desktop.breakAfter.has(i) && "br-d"].filter(Boolean);
        return (
          <Fragment key={photo.id}>
            <li className="photo-cell" style={{ "--ar": ratios[i].toFixed(4) } as CSSProperties}>
              <button type="button" className="photo-tile" onClick={() => open(i)} aria-label={label}>
                <Image
                  src={photo.url}
                  alt=""
                  fill
                  sizes={`(max-width: 640px) ${phoneVw}vw, ${desktopPx}px`}
                  style={{ backgroundColor: photo.color }}
                />
                {photo.video && (
                  <>
                    <span className="play-button" aria-hidden="true">
                      <PlayIcon width={22} height={22} />
                    </span>
                    {photo.video.duration ? <span className="video-time">{formatDuration(photo.video.duration)}</span> : null}
                  </>
                )}
              </button>
            </li>
            {breaks.length > 0 && <li className={`photo-break ${breaks.join(" ")}`} aria-hidden="true" />}
          </Fragment>
        );
      })}
      <li className="photo-fill" aria-hidden="true" />
    </ul>
  );
}
