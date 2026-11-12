import "server-only";
import { del, list, put } from "@vercel/blob";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  createFile,
  deleteFiles,
  FileExistsError,
  fileExists,
  firebaseAdminConfigured,
  listFiles,
  readFileText,
} from "./firebase-admin";
import { firebaseBucket } from "./firebase-storage";
import { PHOTO_WIDTHS, photoFileName, photoIdOf } from "./image-url";
import type { Memory, Photo, Settings } from "./types";

/*
 * The memories' words and the site settings are stored as small files:
 *
 *   memories/<memoryId>/<rev>.json  one memory: name, message, photo list
 *   settings/<rev>.json             site settings chosen by an admin
 *
 * Files are never overwritten. Changing a memory writes the next revision and
 * deletes the old one, so cached copies can never go stale.
 *
 * On Vercel they're kept in Firebase Storage, next to the photos and videos,
 * where only the site can reach them (lib/firebase-admin.ts). Locally (no
 * Firebase key) they go to the .data folder, which app/files/[...path] serves.
 *
 * Until November 2026 they were kept in Vercel Blob, along with the photos.
 * Its free plan blocks the whole store for 30 days once a monthly limit is
 * passed, which took every photo off the site and stopped anything new being
 * saved. The first time the site runs with its Firebase key, it copies these
 * files across (moveFromVercelBlob below) and never uses Vercel Blob again.
 * Never keep anything there.
 */

type StoredFile = { pathname: string; url: string };

type Backend = {
  put(pathname: string, body: Buffer | string, contentType: string): Promise<StoredFile>;
  list(prefix: string): Promise<StoredFile[]>;
  read(file: StoredFile): Promise<string>;
  /** Whether `url` is the address of a file kept here (as returned by put() and list()). */
  holds(url: string): boolean;
  /** Takes URLs as returned by put() and list(). */
  remove(urls: string[]): Promise<void>;
};

const FIREBASE_URL_PREFIX = `gs://${firebaseBucket}/`;

const firebaseBackend: Backend = {
  async put(pathname, body, contentType) {
    await createFile(pathname, body, contentType);
    return { pathname, url: FIREBASE_URL_PREFIX + pathname };
  },
  async list(prefix) {
    return (await listFiles(prefix)).map((pathname) => ({ pathname, url: FIREBASE_URL_PREFIX + pathname }));
  },
  async read(file) {
    const text = await readFileText(file.pathname);
    if (text === null) throw new Error(`Could not read ${file.pathname}: it's gone`);
    return text;
  },
  holds(url) {
    return url.startsWith(FIREBASE_URL_PREFIX);
  },
  async remove(urls) {
    await deleteFiles(urls.map((url) => url.slice(FIREBASE_URL_PREFIX.length)));
  },
};

// Only used to read what was kept in Vercel Blob before the move to Firebase,
// or by a deployment without its Firebase key yet.
const blobBackend: Backend = {
  async put(pathname, body, contentType) {
    const blob = await put(pathname, body, {
      access: "public",
      contentType,
      addRandomSuffix: false,
      cacheControlMaxAge: 60 * 60 * 24 * 365,
    });
    return { pathname: blob.pathname, url: blob.url };
  },
  async list(prefix) {
    const files: StoredFile[] = [];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix, cursor, limit: 1000 });
      for (const blob of page.blobs) files.push({ pathname: blob.pathname, url: blob.url });
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return files;
  },
  async read(file) {
    const res = await fetch(file.url);
    if (!res.ok) throw new Error(`Could not read ${file.pathname} (HTTP ${res.status})`);
    return res.text();
  },
  holds(url) {
    return /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\//.test(url);
  },
  async remove(urls) {
    if (urls.length > 0) await del(urls);
  },
};

const LOCAL_ROOT = path.join(process.cwd(), ".data");
const LOCAL_URL_PREFIX = "/files/";

/** Resolves a storage pathname to a file inside LOCAL_ROOT, or null if it escapes it. */
export function localFilePath(pathname: string): string | null {
  const file = path.resolve(LOCAL_ROOT, pathname);
  return file.startsWith(LOCAL_ROOT + path.sep) ? file : null;
}

function requireLocalFilePath(pathname: string): string {
  const file = localFilePath(pathname);
  if (!file) throw new Error(`Invalid storage path: ${pathname}`);
  return file;
}

const localBackend: Backend = {
  async put(pathname, body) {
    const file = requireLocalFilePath(pathname);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body, { flag: "wx" });
    return { pathname, url: LOCAL_URL_PREFIX + pathname };
  },
  async list(prefix) {
    const dir = requireLocalFilePath(prefix);
    let entries;
    try {
      entries = await readdir(dir, { recursive: true, withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => {
        const pathname = path.relative(LOCAL_ROOT, path.join(entry.parentPath, entry.name)).split(path.sep).join("/");
        return { pathname, url: LOCAL_URL_PREFIX + pathname };
      });
  },
  async read(file) {
    return readFile(requireLocalFilePath(file.pathname), "utf8");
  },
  holds(url) {
    return url.startsWith(LOCAL_URL_PREFIX);
  },
  async remove(urls) {
    for (const url of urls) {
      if (!url.startsWith(LOCAL_URL_PREFIX)) throw new Error(`Not a local storage URL: ${url}`);
      await rm(requireLocalFilePath(url.slice(LOCAL_URL_PREFIX.length)), { force: true });
    }
  },
};

export type StorageMode = "firebase" | "blob" | "local" | "missing";

export function storageMode(): StorageMode {
  if (firebaseAdminConfigured()) return "firebase";
  if (process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID) return "blob";
  // Vercel's filesystem is read-only, so local storage can't work there.
  if (process.env.VERCEL) return "missing";
  return "local";
}

export class StorageNotConfiguredError extends Error {
  constructor() {
    super("Storage is not connected. Set up Firebase as the README describes.");
  }
}

// ---------------------------------------------------------------------------
// The one-time move from Vercel Blob

/** Left in Firebase once everything has been copied across. */
const MOVED_NOTE = "moved-from-vercel-blob.json";

let moving: Promise<void> | null = null;

/**
 * Copies every memory and settings file from Vercel Blob into Firebase,
 * keeping their names, unless that's been done already. Several copies of the
 * site may do this at once (e.g. while a deployment is built); files are
 * never replaced, so that's harmless.
 */
function moveFromVercelBlob(): Promise<void> {
  moving ??= (async () => {
    if (!process.env.BLOB_READ_WRITE_TOKEN || (await fileExists(MOVED_NOTE))) return;
    const files = [...(await blobBackend.list("memories/")), ...(await blobBackend.list("settings/"))];
    for (let i = 0; i < files.length; i += 8) {
      await Promise.all(
        files.slice(i, i + 8).map(async (file) => {
          try {
            await createFile(file.pathname, await blobBackend.read(file), "application/json");
          } catch (error) {
            if (!(error instanceof FileExistsError)) throw error;
          }
        }),
      );
    }
    try {
      await createFile(MOVED_NOTE, JSON.stringify({ movedAt: new Date().toISOString(), files: files.length }), "application/json");
    } catch (error) {
      if (!(error instanceof FileExistsError)) throw error;
    }
    console.log(`Copied ${files.length} files from Vercel Blob to Firebase`);
  })().catch((error) => {
    moving = null; // Try again next time.
    throw error;
  });
  return moving;
}

async function store(): Promise<Backend> {
  const mode = storageMode();
  if (mode === "missing") throw new StorageNotConfiguredError();
  if (mode === "firebase") {
    await moveFromVercelBlob();
    return firebaseBackend;
  }
  return mode === "blob" ? blobBackend : localBackend;
}

// ---------------------------------------------------------------------------
// Revisioned JSON documents

const REV_FILE = /\/(\d+)\.json$/;

function revOf(file: StoredFile): number {
  return Number(file.pathname.match(REV_FILE)?.[1] ?? -1);
}

function revPath(folder: string, rev: number): string {
  return `${folder}${String(rev).padStart(6, "0")}.json`;
}

/** Newest revision among a document's files, plus all older ones. */
function latestRevision(files: StoredFile[]) {
  const sorted = files.filter((f) => revOf(f) >= 0).sort((a, b) => revOf(b) - revOf(a));
  return { latest: sorted[0], older: sorted.slice(1) };
}

async function writeRevision(folder: string, rev: number, data: unknown, previous: StoredFile[]) {
  const files = await store();
  await files.put(revPath(folder, rev), JSON.stringify(data), "application/json");
  await files.remove(previous.map((f) => f.url));
}

// ---------------------------------------------------------------------------
// Memories

const MEMORY_FILE = /^memories\/([\w-]+)\/\d+\.json$/;

function parseMemory(json: string): Memory | null {
  try {
    const m = JSON.parse(json) as Memory;
    if (typeof m.id !== "string" || typeof m.name !== "string" || !Array.isArray(m.photos)) return null;
    return m;
  } catch {
    return null;
  }
}

export async function readAllMemories(): Promise<Memory[]> {
  const files = await store();
  const byId = new Map<string, StoredFile[]>();
  for (const file of await files.list("memories/")) {
    const id = file.pathname.match(MEMORY_FILE)?.[1];
    if (id) byId.set(id, [...(byId.get(id) ?? []), file]);
  }
  const memories = await Promise.all(
    [...byId.values()].map(async (revisions) => {
      const { latest } = latestRevision(revisions);
      return latest ? parseMemory(await files.read(latest)) : null;
    }),
  );
  return memories
    .filter((m): m is Memory => m !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function memoryFiles(id: string): Promise<StoredFile[]> {
  return (await store()).list(`memories/${id}/`);
}

export async function readMemory(id: string): Promise<Memory | null> {
  if (!/^[\w-]{1,40}$/.test(id)) return null;
  const { latest } = latestRevision(await memoryFiles(id));
  return latest ? parseMemory(await (await store()).read(latest)) : null;
}

export async function saveMemory(memory: Memory): Promise<void> {
  const existing = await memoryFiles(memory.id);
  await writeRevision(`memories/${memory.id}/`, memory.rev, memory, existing);
}

export async function deleteMemoryAndPhotos(memory: Memory): Promise<void> {
  const files = await memoryFiles(memory.id);
  await (await store()).remove(files.map((f) => f.url));
  await deletePhotoFiles(memory.photos);
}

// ---------------------------------------------------------------------------
// Photos

const PHOTO_ID = /^[\w-]{1,40}$/;

function localPhotoPath(id: string): string {
  return `photos/${id}/photo.jpg`;
}

/** Keeps a shared photo in the .data folder, when running without Firebase (see lib/photo-storage.ts). */
export async function savePhotoLocally(id: string, body: Buffer): Promise<string> {
  if (storageMode() !== "local") throw new Error("Photos are only kept here when running locally.");
  return (await localBackend.put(localPhotoPath(id), body, "image/jpeg")).url;
}

/** A photo kept in the .data folder, or null if there's no such photo. */
export async function readLocalPhoto(id: string): Promise<Buffer | null> {
  if (storageMode() !== "local" || !PHOTO_ID.test(id)) return null;
  try {
    return await readFile(requireLocalFilePath(localPhotoPath(id)));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

/** The names of a photo's files in Firebase Storage: as shared, every width, and the video if it's one. */
function firebaseFilesOf(photo: Photo): string[] {
  const names: string[] = [];
  const id = photoIdOf(photo.url);
  if (id) names.push(photoFileName(id), ...PHOTO_WIDTHS.map((width) => photoFileName(id, width)));
  const video = photo.video?.url.match(/\/o\/([^?]+)/)?.[1];
  if (video) names.push(decodeURIComponent(video));
  return names;
}

/**
 * Removes the photos' files for good: from Firebase Storage, and from .data
 * when running locally. (The copies left in Vercel Blob from before the move
 * stay there; nothing uses or links to them.)
 */
export async function deletePhotoFiles(photos: Photo[]): Promise<void> {
  const mode = storageMode();
  if (mode === "firebase") await deleteFiles(photos.flatMap(firebaseFilesOf));
  else if (mode === "local") await localBackend.remove(photos.map((p) => p.url).filter((url) => localBackend.holds(url)));
}

// ---------------------------------------------------------------------------
// Settings

export async function readSettings(): Promise<{ settings: Settings; rev: number }> {
  const files = await store();
  const { latest } = latestRevision(await files.list("settings/"));
  if (!latest) return { settings: {}, rev: 0 };
  try {
    return { settings: JSON.parse(await files.read(latest)) as Settings, rev: revOf(latest) };
  } catch {
    return { settings: {}, rev: revOf(latest) };
  }
}

export async function saveSettings(settings: Settings, rev: number): Promise<void> {
  const existing = await (await store()).list("settings/");
  await writeRevision("settings/", rev, settings, existing);
}
