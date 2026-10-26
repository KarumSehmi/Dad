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

// Soft, warm tones for the initials beside each memory.
const AVATAR_COLORS = ["#b9826a", "#8e9c7a", "#7f93a6", "#b08f5a", "#a3798f", "#6f9a95", "#9d8873"];

export function avatarColor(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function count(n: number, one: string, many: string): string {
  return `${n.toLocaleString(site.locale)} ${n === 1 ? one : many}`;
}

export function downloadUrl(url: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}download=1`;
}
