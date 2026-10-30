"use client";

import Image from "next/image";
import { useMemo, useSyncExternalStore } from "react";
import { avatarColor, initials, joinList, mediaCounts } from "@/lib/format";
import type { Person } from "@/lib/types";
import { useLightbox } from "./Lightbox";

// Whose photos this visitor has already looked through, as each person's
// newest memory at the time, so anyone who shares again shows as new. Kept
// only in this browser.
const SEEN_KEY = "memorial:seen-people";
const SEEN_CHANGED = "memorial:seen-people-changed";

function readSeen(): string {
  try {
    return localStorage.getItem(SEEN_KEY) ?? "{}";
  } catch {
    return "{}";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(SEEN_CHANGED, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(SEEN_CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function parseSeen(raw: string): Record<string, string> {
  try {
    const seen: unknown = JSON.parse(raw);
    return seen && typeof seen === "object" ? (seen as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function markSeen(person: Person) {
  try {
    const seen = parseSeen(readSeen());
    seen[person.key] = person.memoryId;
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {
    // Private browsing, say: the ring just stays as it is.
  }
  window.dispatchEvent(new Event(SEEN_CHANGED));
}

/**
 * A face for everyone who has shared, newest first, like the stories along the
 * top of Instagram. Tapping one shows all their photos full screen. A coloured
 * ring means there's something this visitor hasn't looked at yet.
 */
export function PeopleRow({ people }: { people: Person[] }) {
  const open = useLightbox();
  const raw = useSyncExternalStore(subscribe, readSeen, () => "{}");
  const seen = useMemo(() => parseSeen(raw), [raw]);

  return (
    <ul className="people">
      {people.map((person) => {
        const cover = person.photos[0];
        const isSeen = seen[person.key] === person.memoryId;
        const face = (
          <>
            <span className="person-ring">
              {cover ? (
                <span className="person-photo">
                  <Image src={cover.url} alt="" fill sizes="80px" style={{ backgroundColor: cover.color }} />
                </span>
              ) : (
                <span className="person-photo person-initials" style={{ backgroundColor: avatarColor(person.name) }}>
                  {initials(person.name)}
                </span>
              )}
            </span>
            <span className="person-name">{person.name}</span>
          </>
        );
        return (
          <li key={person.key} className="person" data-seen={isSeen || undefined}>
            {cover ? (
              <button
                type="button"
                className="person-button"
                aria-label={`See ${person.name}’s ${joinList(mediaCounts(person.photos))}`}
                onClick={() => {
                  open(person.photos, 0);
                  markSeen(person);
                }}
              >
                {face}
              </button>
            ) : (
              <a className="person-button" href={`#m-${person.memoryId}`} onClick={() => markSeen(person)}>
                {face}
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}
