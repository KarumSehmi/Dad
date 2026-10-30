import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { readAllMemories, readSettings, storageMode } from "./storage";
import type { GalleryPhoto, Memory, Person, Settings } from "./types";

export const MEMORIES_TAG = "memories";
export const SETTINGS_TAG = "settings";

// Pages are built from these cached reads, so visitors get a prerendered page
// and storage is only read again after someone shares, deletes or changes
// something (see the updateTag calls in app/actions.ts), or at most once a
// day as a safety net in case files were changed outside the site.

export async function getMemories(): Promise<Memory[]> {
  "use cache";
  cacheLife("days");
  cacheTag(MEMORIES_TAG);
  if (storageMode() === "missing") return [];
  return readAllMemories();
}

export async function getSettings(): Promise<Settings> {
  "use cache";
  cacheLife("days");
  cacheTag(SETTINGS_TAG);
  if (storageMode() === "missing") return {};
  return (await readSettings()).settings;
}

/** The people who have shared memories, most recent first. */
export function peopleOf(memories: Memory[]): Person[] {
  const people = new Map<string, Person>();
  for (const memory of memories) {
    const key = memory.name.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
    const person = people.get(key);
    if (person) {
      person.photos.push(...galleryPhotos([memory]));
      person.relationship ??= memory.relationship;
    } else {
      people.set(key, {
        key,
        name: memory.name,
        ...(memory.relationship && { relationship: memory.relationship }),
        memoryId: memory.id,
        photos: galleryPhotos([memory]),
      });
    }
  }
  return [...people.values()];
}

/** Every photo across all memories, newest first. */
export function galleryPhotos(memories: Memory[]): GalleryPhoto[] {
  return memories.flatMap((memory) =>
    memory.photos.map((photo) => ({
      ...photo,
      memoryId: memory.id,
      sharedBy: memory.name,
      sharedAt: memory.createdAt,
    })),
  );
}
