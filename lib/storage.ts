import "server-only";
import { del, list, put } from "@vercel/blob";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Memory, Photo, Settings } from "./types";

/*
 * The memories' words and the site settings are stored as small files:
 *
 *   memories/<memoryId>/<rev>.json  one memory: name, message, photo list
 *   settings/<rev>.json             site settings chosen by an admin
 *
 * Files are never overwritten. Changing a memory writes the next revision and
 * deletes the old one, so cached copies of a URL can never go stale.
 *
 * On Vercel the files go to Vercel Blob. Locally (no Blob token) they go to
 * the .data folder and are served by app/files/[...path]/route.ts.
 *
 * Photos and videos are kept in Firebase Storage instead (lib/photo-storage.ts),
 * never here: Vercel Blob's free plan blocks the whole store for 30 days once
 * a monthly limit is passed, and photos used it up. Only when running without
 * Firebase (npm run dev) are photos kept in .data, as photos/<photoId>/photo.jpg.
 * Photos shared before the move are still in Vercel Blob at that path, but
 * nothing reads them there: each was copied to Firebase under the same id.
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

const ONE_YEAR = 60 * 60 * 24 * 365;

const blobBackend: Backend = {
  async put(pathname, body, contentType) {
    const blob = await put(pathname, body, {
      access: "public",
      contentType,
      addRandomSuffix: false,
      cacheControlMaxAge: ONE_YEAR,
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

export type StorageMode = "blob" | "local" | "missing";

export function storageMode(): StorageMode {
  if (process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID) return "blob";
  // Vercel's filesystem is read-only, so local storage can't work there.
  if (process.env.VERCEL) return "missing";
  return "local";
}

export class StorageNotConfiguredError extends Error {
  constructor() {
    super("Storage is not connected. Connect a Vercel Blob store to this project.");
  }
}

function backend(): Backend {
  const mode = storageMode();
  if (mode === "missing") throw new StorageNotConfiguredError();
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
  const store = backend();
  await store.put(revPath(folder, rev), JSON.stringify(data), "application/json");
  await store.remove(previous.map((f) => f.url));
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
  const store = backend();
  const byId = new Map<string, StoredFile[]>();
  for (const file of await store.list("memories/")) {
    const id = file.pathname.match(MEMORY_FILE)?.[1];
    if (id) byId.set(id, [...(byId.get(id) ?? []), file]);
  }
  const memories = await Promise.all(
    [...byId.values()].map(async (files) => {
      const { latest } = latestRevision(files);
      return latest ? parseMemory(await store.read(latest)) : null;
    }),
  );
  return memories
    .filter((m): m is Memory => m !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function memoryFiles(id: string): Promise<StoredFile[]> {
  return backend().list(`memories/${id}/`);
}

export async function readMemory(id: string): Promise<Memory | null> {
  if (!/^[\w-]{1,40}$/.test(id)) return null;
  const { latest } = latestRevision(await memoryFiles(id));
  return latest ? parseMemory(await backend().read(latest)) : null;
}

export async function saveMemory(memory: Memory): Promise<void> {
  const existing = await memoryFiles(memory.id);
  await writeRevision(`memories/${memory.id}/`, memory.rev, memory, existing);
}

export async function deleteMemoryAndPhotos(memory: Memory): Promise<void> {
  const files = await memoryFiles(memory.id);
  await backend().remove(files.map((f) => f.url));
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

/**
 * Removes the photos' files that are kept here: the old copies in Vercel Blob
 * of photos shared before the move to Firebase, or photos in .data. Files in
 * Firebase Storage stay, because storage.rules lets nobody delete them (see
 * "Looking after the site" in the README). With the photo gone from its
 * memory, the site no longer shows or links to them.
 */
export async function deletePhotoFiles(photos: Photo[]): Promise<void> {
  const store = backend();
  await store.remove(photos.map((p) => p.url).filter((url) => store.holds(url)));
}

// ---------------------------------------------------------------------------
// Settings

export async function readSettings(): Promise<{ settings: Settings; rev: number }> {
  const store = backend();
  const { latest } = latestRevision(await store.list("settings/"));
  if (!latest) return { settings: {}, rev: 0 };
  try {
    return { settings: JSON.parse(await store.read(latest)) as Settings, rev: revOf(latest) };
  } catch {
    return { settings: {}, rev: revOf(latest) };
  }
}

export async function saveSettings(settings: Settings, rev: number): Promise<void> {
  const existing = await backend().list("settings/");
  await writeRevision("settings/", rev, settings, existing);
}
