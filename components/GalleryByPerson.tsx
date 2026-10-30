"use client";

import Link from "next/link";
import { useMemo } from "react";
import { avatarColor, initials, joinList, mediaCounts } from "@/lib/format";
import type { Person } from "@/lib/types";
import { useLightbox } from "./Lightbox";
import { PhotoGrid } from "./PhotoGrid";

/**
 * Every photo, grouped under who shared it, so each one comes with whose it
 * is and how they knew him. Full screen, they still run on from one person to
 * the next, so they can all be swiped through in one go.
 */
export function GalleryByPerson({ people }: { people: Person[] }) {
  const lightbox = useLightbox();
  const { all, starts } = useMemo(() => {
    const starts: number[] = [];
    let start = 0;
    for (const person of people) {
      starts.push(start);
      start += person.photos.length;
    }
    return { all: people.flatMap((person) => person.photos), starts };
  }, [people]);

  return (
    <div className="gallery-people">
      {people.map((person, p) => {
        // Someone who wrote but shared no photos isn't part of the gallery.
        if (person.photos.length === 0) return null;
        return (
          <section key={person.key} className="gallery-person" aria-labelledby={`person-${p}`}>
            <header className="gallery-person-head">
              <span className="avatar" style={{ backgroundColor: avatarColor(person.name) }} aria-hidden="true">
                {initials(person.name)}
              </span>
              <div className="gallery-person-who">
                <h2 id={`person-${p}`} className="gallery-person-name">
                  {person.name}
                </h2>
                <p className="gallery-person-meta">
                  {[person.relationship, joinList(mediaCounts(person.photos))].filter(Boolean).join(" · ")}
                </p>
              </div>
              <Link href={`/#m-${person.memoryId}`} className="section-link">
                Their memory
              </Link>
            </header>
            <PhotoGrid photos={person.photos} onOpen={(i) => lightbox(all, starts[p] + i)} />
          </section>
        );
      })}
    </div>
  );
}
