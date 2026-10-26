export type Photo = {
  id: string;
  url: string;
  width: number;
  height: number;
  /** Average colour, shown while the photo loads. */
  color: string;
  caption?: string;
};

export type Memory = {
  id: string;
  name: string;
  relationship?: string;
  message?: string;
  photos: Photo[];
  /** ISO timestamp. */
  createdAt: string;
  /** Bumped whenever the memory is rewritten (e.g. a photo is removed). */
  rev: number;
};

export type Settings = {
  portrait?: Photo;
};

/** A photo plus the memory it came from, for galleries and the lightbox. */
export type GalleryPhoto = Photo & {
  memoryId: string;
  sharedBy: string;
  sharedAt: string;
};

export type ActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string };
