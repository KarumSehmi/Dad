import { site } from "@/site.config";

const dateFormat = new Intl.DateTimeFormat(site.locale, {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: site.timeZone,
});

export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const picked = words.length > 1 ? [words[0], words[words.length - 1]] : words;
  return picked.map((word) => Array.from(word)[0]?.toUpperCase() ?? "").join("");
}

// Bright, cheerful colours for the initials beside each memory (each dark
// enough for white letters).
const AVATAR_COLORS = ["#c2410c", "#7b4fa0", "#3f78c0", "#b03a6a", "#2b8a7e", "#5f8a2f", "#a3651a"];

export function avatarColor(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function count(n: number, one: string, many: string): string {
  return `${n.toLocaleString(site.locale)} ${n === 1 ? one : many}`;
}

const listFormat = new Intl.ListFormat(site.locale, { type: "conjunction" });

/** ["a", "b", "c"] → "a, b and c". */
export function joinList(parts: string[]): string {
  return listFormat.format(parts);
}

/** e.g. ["12 photos", "2 videos"]. Videos are only mentioned if there are some. */
export function mediaCounts(items: { video?: unknown }[]): string[] {
  const videos = items.filter((item) => item.video).length;
  const photos = items.length - videos;
  const parts = photos > 0 || videos === 0 ? [count(photos, "photo", "photos")] : [];
  return videos > 0 ? [...parts, count(videos, "video", "videos")] : parts;
}

/** 75 → "1:15". */
export function formatDuration(seconds: number): string {
  const total = Math.max(1, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

export function downloadUrl(url: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}download=1`;
}
