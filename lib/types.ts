export type Video = {
  /** Where it plays from (Firebase Storage, see lib/video.ts). */
  url: string;
  /** As uploaded, e.g. "video/mp4". */
  type: string;
  /** In bytes. */
  size: number;
  /** In seconds, as measured by the sharer's browser. */
  duration?: number;
};

export type Photo = {
  id: string;
  url: string;
  width: number;
  height: number;
  /** Average colour, shown while the photo loads. */
  color: string;
  caption?: string;
  /** Set when this is a video. The photo is then a still from it. */
  video?: Video;
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
