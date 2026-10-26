"use client";

import Image from "next/image";
import { Fragment, type CSSProperties } from "react";
import { splitRows } from "@/lib/justify";
import type { GalleryPhoto } from "@/lib/types";
import { useLightbox } from "./Lightbox";

// How photos are grouped into rows. `phone`/`desktop` are the target sum of
// width÷height ratios per row (bigger = more, smaller photos per row), and
// `width` is the grid's widest size on desktop, used to pick image sizes.
// Rows are planned separately for phones (≤ 640px) and larger screens, and
// CSS shows the right set of row breaks for each.
//
// Memory cards keep up to three photos in one row, capped in height (matching
// --max-h in globals.css) so a single tall photo isn't shown huge.
const VARIANTS = {
  gallery: { phone: 2.5, desktop: 4.4, width: 1080, singleRowUpTo: 0, maxHeight: Infinity },
  strip: { phone: 2.6, desktop: 5.2, width: 1080, singleRowUpTo: 0, maxHeight: Infinity },
  memory: { phone: 2.1, desktop: 3.1, width: 680, singleRowUpTo: 3, maxHeight: 460 },
};

type Plan = { breakAfter: Set<number>; rowSum: number[]; lastRowGap: number };

function plan(ratios: number[], target: number, singleRow: boolean): Plan {
  const { rows, lastRowGap } = singleRow ? { rows: [ratios.map((_, i) => i)], lastRowGap: 0 } : splitRows(ratios, target);
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
 * its shape, and rows fill the width. With `max`, only that many are shown
 * and the last tile says how many more there are.
 */
export function PhotoGrid({
  photos,
  variant = "gallery",
  max,
}: {
  photos: GalleryPhoto[];
  variant?: keyof typeof VARIANTS;
  max?: number;
}) {
  const open = useLightbox();
  const v = VARIANTS[variant];
  const shown = max ? photos.slice(0, max) : photos;
  const hidden = photos.length - shown.length;
  const ratios = shown.map((p) => p.width / p.height);
  const phone = plan(ratios, v.phone, shown.length <= Math.min(v.singleRowUpTo, 2));
  const desktop = plan(ratios, v.desktop, shown.length <= v.singleRowUpTo);

  const style = { "--fill-m": phone.lastRowGap, "--fill-d": desktop.lastRowGap } as CSSProperties;
  return (
    <ul className={`photo-grid photo-grid-${variant}`} style={style}>
      {shown.map((photo, i) => {
        const more = hidden > 0 && i === shown.length - 1 ? hidden : 0;
        const label = photo.caption || `Photo shared by ${photo.sharedBy}`;
        const phoneVw = Math.ceil((ratios[i] / phone.rowSum[i]) * 95);
        const desktopPx = Math.ceil(Math.min((ratios[i] / desktop.rowSum[i]) * v.width, ratios[i] * v.maxHeight));
        const breaks = [phone.breakAfter.has(i) && "br-m", desktop.breakAfter.has(i) && "br-d"].filter(Boolean);
        return (
          <Fragment key={photo.id}>
            <li className="photo-cell" style={{ "--ar": ratios[i].toFixed(4) } as CSSProperties}>
              <button
                type="button"
                className="photo-tile"
                onClick={() => open(photos, i)}
                aria-label={more ? `${label}, and ${more} more photos` : label}
              >
                <Image
                  src={photo.url}
                  alt=""
                  fill
                  sizes={`(max-width: 640px) ${phoneVw}vw, ${desktopPx}px`}
                  style={{ backgroundColor: photo.color }}
                />
                {more > 0 && <span className="photo-more">+{more}</span>}
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
