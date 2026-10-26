import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Photo } from "./types";

export function randomId(): string {
  return randomBytes(9).toString("base64url");
}

function sameBytes(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

function hmac(key: string | Buffer, message: string): string {
  return createHmac("sha256", key).update(message).digest("base64url");
}

// ---------------------------------------------------------------------------
// Photo receipts: the upload route hands back a signed receipt for each photo
// it stores, and a memory may only include photos that come with one. This
// stops anyone from attaching images hosted elsewhere.

function signingKey(purpose: string): Buffer {
  const secret =
    process.env.SESSION_SECRET || process.env.BLOB_READ_WRITE_TOKEN || process.env.ADMIN_PASSWORD;
  if (!secret) {
    if (process.env.VERCEL) throw new Error("Set SESSION_SECRET (any long random string) in the project settings.");
    return createHash("sha256").update(`local-development-only:${purpose}`).digest();
  }
  return createHmac("sha256", secret).update(purpose).digest();
}

function photoPayload(p: Pick<Photo, "id" | "url" | "width" | "height" | "color">): string {
  return JSON.stringify([p.id, p.url, p.width, p.height, p.color]);
}

export function signPhoto(photo: Photo): string {
  return hmac(signingKey("photo-receipt"), photoPayload(photo));
}

export function verifyPhoto(photo: Photo, receipt: string): boolean {
  return sameBytes(hmac(signingKey("photo-receipt"), photoPayload(photo)), receipt);
}

// ---------------------------------------------------------------------------
// Admin sessions. The cookie holds an expiry time signed with a key derived
// from ADMIN_PASSWORD, so changing the password signs everyone out.

export const ADMIN_COOKIE = "hs_admin_session";
/** Readable by the browser; only used to decide whether to show admin buttons. */
export const ADMIN_FLAG_COOKIE = "hs_admin";
export const ADMIN_SESSION_SECONDS = 60 * 60 * 24 * 30;

export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

export function passwordMatches(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  return Boolean(expected) && sameBytes(input, expected!);
}

function sessionKey(): string {
  return hmac(process.env.ADMIN_PASSWORD!, "admin-session");
}

export function createAdminSession(now = Date.now()): string {
  const expires = String(now + ADMIN_SESSION_SECONDS * 1000);
  return `${expires}.${hmac(sessionKey(), expires)}`;
}

export function isValidAdminSession(value: string | undefined, now = Date.now()): boolean {
  if (!value || !adminConfigured()) return false;
  const [expires, signature] = value.split(".");
  if (!expires || !signature || Number(expires) < now) return false;
  return sameBytes(hmac(sessionKey(), expires), signature);
}

// ---------------------------------------------------------------------------
// Best-effort rate limiting, per server instance. Enough to slow down a
// misbehaving script without needing a database.

const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowSeconds: number): boolean {
  const now = Date.now();
  if (buckets.size > 10_000) {
    for (const [k, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(k);
  }
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

export function clientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown"
  );
}
