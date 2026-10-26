"use server";

import { updateTag } from "next/cache";
import { cookies, headers } from "next/headers";
import { isAdmin } from "@/lib/admin";
import { MEMORIES_TAG, SETTINGS_TAG } from "@/lib/data";
import {
  ADMIN_COOKIE,
  ADMIN_FLAG_COOKIE,
  ADMIN_SESSION_SECONDS,
  adminConfigured,
  clientIp,
  createAdminSession,
  passwordMatches,
  randomId,
  rateLimit,
  verifyPhoto,
} from "@/lib/security";
import {
  deleteMemoryAndPhotos,
  deletePhotoFiles,
  readMemory,
  readSettings,
  saveMemory,
  saveSettings,
} from "@/lib/storage";
import type { ActionResult, Memory, Photo } from "@/lib/types";
import { cleanText, isHexColor, LIMITS } from "@/lib/validate";
import { isListedRelationship } from "@/site.config";

export type NewMemoryInput = {
  name: string;
  relationship?: string;
  message?: string;
  /** Hidden field that only bots fill in. */
  website?: string;
  photos: { photo: Photo; receipt: string; caption?: string }[];
};

const SAVE_FAILED = "Sorry, something went wrong while saving. Please try again in a moment.";

function asPhoto(value: unknown): Photo | null {
  const p = value as Photo | null;
  if (!p || typeof p !== "object") return null;
  if (typeof p.id !== "string" || typeof p.url !== "string" || !isHexColor(p.color)) return null;
  if (!Number.isInteger(p.width) || !Number.isInteger(p.height)) return null;
  return { id: p.id, url: p.url, width: p.width, height: p.height, color: p.color };
}

export async function createMemory(input: NewMemoryInput): Promise<ActionResult<{ id: string }>> {
  if (!rateLimit(`memory:${clientIp(await headers())}`, 60, 60 * 60)) {
    return { ok: false, error: "You've shared a lot in a short time. Please wait a while and try again." };
  }
  if (!input || typeof input !== "object") return { ok: false, error: SAVE_FAILED };
  // Quietly drop submissions from bots that fill in the hidden field.
  if (input.website) return { ok: true, id: "" };

  const name = cleanText(input.name, LIMITS.name);
  // Only the choices offered on the form are kept.
  const listed = cleanText(input.relationship, LIMITS.relationship);
  const relationship = isListedRelationship(listed) ? listed : "";
  const message = cleanText(input.message, LIMITS.message, { multiline: true });
  if (!name) return { ok: false, error: "Please add your name." };

  const photos: Photo[] = [];
  for (const item of Array.isArray(input.photos) ? input.photos.slice(0, LIMITS.photosPerMemory) : []) {
    const photo = asPhoto(item?.photo);
    if (!photo || typeof item.receipt !== "string" || !verifyPhoto(photo, item.receipt)) {
      return { ok: false, error: "One of the photos didn't upload properly. Please remove it and add it again." };
    }
    const caption = cleanText(item.caption, LIMITS.caption);
    photos.push(caption ? { ...photo, caption } : photo);
  }
  if (!message && photos.length === 0) {
    return { ok: false, error: "Please write a message or add at least one photo." };
  }

  const memory: Memory = {
    id: randomId(),
    name,
    ...(relationship && { relationship }),
    ...(message && { message }),
    photos,
    createdAt: new Date().toISOString(),
    rev: 1,
  };
  try {
    await saveMemory(memory);
  } catch (cause) {
    console.error("Saving memory failed", cause);
    return { ok: false, error: SAVE_FAILED };
  }
  updateTag(MEMORIES_TAG);
  return { ok: true, id: memory.id };
}

// ---------------------------------------------------------------------------
// Admin

const NOT_ADMIN: ActionResult = { ok: false, error: "Please sign in as a family admin first." };

async function clearPortraitIf(urls: string[]) {
  const { settings, rev } = await readSettings();
  if (settings.portrait && urls.includes(settings.portrait.url)) {
    await saveSettings({ ...settings, portrait: undefined }, rev + 1);
    updateTag(SETTINGS_TAG);
  }
}

export async function deleteMemory(memoryId: string): Promise<ActionResult> {
  if (!(await isAdmin())) return NOT_ADMIN;
  try {
    const memory = await readMemory(String(memoryId));
    if (memory) {
      await deleteMemoryAndPhotos(memory);
      await clearPortraitIf(memory.photos.map((p) => p.url));
    }
  } catch (cause) {
    console.error("Deleting memory failed", cause);
    return { ok: false, error: SAVE_FAILED };
  }
  updateTag(MEMORIES_TAG);
  return { ok: true };
}

export async function deletePhoto(memoryId: string, photoId: string): Promise<ActionResult> {
  if (!(await isAdmin())) return NOT_ADMIN;
  try {
    const memory = await readMemory(String(memoryId));
    const photo = memory?.photos.find((p) => p.id === photoId);
    if (memory && photo) {
      const photos = memory.photos.filter((p) => p !== photo);
      if (photos.length === 0 && !memory.message) {
        // Nothing would be left of this memory.
        await deleteMemoryAndPhotos(memory);
      } else {
        await saveMemory({ ...memory, photos, rev: memory.rev + 1 });
        await deletePhotoFiles([photo.url]);
      }
      await clearPortraitIf([photo.url]);
    }
  } catch (cause) {
    console.error("Deleting photo failed", cause);
    return { ok: false, error: SAVE_FAILED };
  }
  updateTag(MEMORIES_TAG);
  return { ok: true };
}

export async function setPortrait(memoryId: string, photoId: string): Promise<ActionResult> {
  if (!(await isAdmin())) return NOT_ADMIN;
  try {
    const photo = (await readMemory(String(memoryId)))?.photos.find((p) => p.id === photoId);
    if (!photo) return { ok: false, error: "That photo no longer exists." };
    const { settings, rev } = await readSettings();
    await saveSettings({ ...settings, portrait: photo }, rev + 1);
  } catch (cause) {
    console.error("Setting portrait failed", cause);
    return { ok: false, error: SAVE_FAILED };
  }
  updateTag(SETTINGS_TAG);
  return { ok: true };
}

export async function clearPortrait(): Promise<ActionResult> {
  if (!(await isAdmin())) return NOT_ADMIN;
  try {
    const { settings, rev } = await readSettings();
    await saveSettings({ ...settings, portrait: undefined }, rev + 1);
  } catch (cause) {
    console.error("Clearing portrait failed", cause);
    return { ok: false, error: SAVE_FAILED };
  }
  updateTag(SETTINGS_TAG);
  return { ok: true };
}

export async function signIn(password: string): Promise<ActionResult> {
  if (!adminConfigured()) return { ok: false, error: "Admin access hasn't been set up for this site yet." };
  if (!rateLimit(`sign-in:${clientIp(await headers())}`, 10, 15 * 60)) {
    return { ok: false, error: "Too many attempts. Please wait 15 minutes and try again." };
  }
  if (typeof password !== "string" || !passwordMatches(password)) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return { ok: false, error: "That password isn't right." };
  }
  const store = await cookies();
  const options = {
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: ADMIN_SESSION_SECONDS,
  };
  store.set(ADMIN_COOKIE, createAdminSession(), { ...options, httpOnly: true });
  store.set(ADMIN_FLAG_COOKIE, "1", options);
  return { ok: true };
}

export async function signOut(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
  store.delete(ADMIN_FLAG_COOKIE);
}
