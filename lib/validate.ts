export const LIMITS = {
  name: 80,
  relationship: 80,
  message: 6000,
  caption: 300,
  photosPerMemory: 30,
  /** Per uploaded photo, after the browser has resized it. Vercel caps request bodies at 4.5 MB. */
  photoBytes: 4 * 1024 * 1024,
  /** Counted within photosPerMemory. */
  videosPerMemory: 10,
  /** Videos must be smaller than this. Keep in step with storage.rules. */
  videoBytes: 500 * 1024 * 1024,
};

// Control characters other than tab and newline.
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Normalises user text and trims it to `max` characters. Returns "" for non-strings. */
export function cleanText(value: unknown, max: number, { multiline = false } = {}): string {
  if (typeof value !== "string") return "";
  let text = value.normalize("NFC").replace(/\r\n?/g, "\n").replace(CONTROL_CHARS, "");
  text = multiline ? text.replace(/[ \t]+\n/g, "\n").replace(/\n{4,}/g, "\n\n\n") : text.replace(/\s+/g, " ");
  return Array.from(text.trim()).slice(0, max).join("").trim();
}

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}
