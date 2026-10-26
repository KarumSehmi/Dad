// Runs in the browser. Checks a video can be shared, takes a still from it to
// stand in for it in galleries, and removes the location the phone recorded.
// The video itself is uploaded as it is: re-encoding it on a phone would be
// slow, and phones already save videos in formats that play almost anywhere.

import { canvas, encodePhoto, scaledCanvas, type PreparedPhoto } from "./prepare-photo";
import { LIMITS } from "./validate";
import { isVideoExtension, VIDEO_TYPES } from "./video";
import { stripVideoLocation } from "./video-location";

export type PreparedVideo = {
  /** A still from the video, uploaded like a photo. */
  poster: PreparedPhoto;
  /** What gets uploaded: the original file, minus its location. */
  file: Blob;
  type: string;
  ext: string;
  /** In seconds, if the browser could tell. */
  duration?: number;
};

/** A problem with a video that the sharer can do something about. */
export class VideoError extends Error {}

const LIKELY_VIDEO = /\.(mp4|m4v|mov|webm|3gp|3g2|mkv|avi|wmv|mpe?g|flv|ogv|mts|m2ts)$/i;

export function isVideoFile(file: File): boolean {
  return file.type.startsWith("video/") || LIKELY_VIDEO.test(file.name);
}

function videoKind(file: File): { type: string; ext: string } | null {
  const ext = file.name.match(/\.([a-z0-9]+)$/i)?.[1].toLowerCase() ?? "";
  if (isVideoExtension(ext)) {
    return { ext, type: /^video\/[\w.+-]+$/.test(file.type) ? file.type : VIDEO_TYPES[ext] };
  }
  // Some phones give files no extension, so go by the type the browser reports.
  const match = Object.entries(VIDEO_TYPES).find(([, type]) => type === file.type);
  return match ? { ext: match[0], type: match[1] } : null;
}

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error("Timed out")), ms));
}

function nextEvent(video: HTMLVideoElement, event: string): Promise<void> {
  const happened = new Promise<void>((resolve, reject) => {
    video.addEventListener(event, () => resolve(), { once: true });
    video.addEventListener("error", () => reject(new Error("The video couldn't be read")), { once: true });
  });
  return Promise.race([happened, timeout(15_000)]);
}

/** A still from a moment into the video (the very first frame is often black). */
async function captureStill(file: File): Promise<{ still: PreparedPhoto; duration?: number } | null> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  // Some phones only decode videos that are on the page.
  video.style.cssText = "position:fixed;top:0;left:0;width:2px;height:2px;opacity:0;pointer-events:none";
  document.body.append(video);
  try {
    const loaded = nextEvent(video, "loadedmetadata");
    video.src = url;
    await loaded;
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : undefined;

    // iPhones don't decode any frames until a video has played.
    await Promise.race([video.play(), timeout(3000)]).catch(() => {});
    video.pause();
    const at = duration ? Math.min(1, duration / 3) : 0;
    if (Math.abs(video.currentTime - at) > 0.05) {
      const seeked = nextEvent(video, "seeked");
      video.currentTime = at;
      await seeked;
    }
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) await nextEvent(video, "loadeddata");

    const { videoWidth: w, videoHeight: h } = video;
    if (!w || !h) return null;
    return { still: await encodePhoto(scaledCanvas(video, w, h)), duration };
  } catch {
    // This browser can't play the video (others may be able to).
    return null;
  } finally {
    video.removeAttribute("src");
    video.load();
    video.remove();
    URL.revokeObjectURL(url);
  }
}

/** Stands in for the still when this browser can't play the video. */
async function plainStill(): Promise<PreparedPhoto> {
  const { el, ctx } = canvas(1280, 720);
  ctx.fillStyle = "#3b342d";
  ctx.fillRect(0, 0, 1280, 720);
  return encodePhoto(el);
}

export async function prepareVideo(file: File): Promise<PreparedVideo> {
  const kind = videoKind(file);
  if (!kind) {
    throw new VideoError("This kind of video file can't be shared here. Videos from phones (MP4 or MOV) work best.");
  }
  if (file.size === 0) throw new VideoError("This video file is empty.");
  if (file.size >= LIMITS.videoBytes) {
    throw new VideoError(
      `This video is over ${LIMITS.videoBytes / 1024 / 1024} MB. Please trim it, or share a shorter clip.`,
    );
  }
  const captured = await captureStill(file);
  return {
    poster: captured?.still ?? (await plainStill()),
    file: await stripVideoLocation(file),
    ...kind,
    duration: captured?.duration,
  };
}
