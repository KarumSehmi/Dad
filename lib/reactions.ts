"use client";

// Emoji reactions on memories. They live in Firestore rather than Vercel
// Blob, whose free plan allows too few writes for something people tap
// often. Each memory has one document, reactions/<memoryId>, holding a count
// per emoji; firestore.rules lets each change move one count by one. The
// browser talks to Firestore's REST API directly, so no Firebase code is
// downloaded for this.
//
// Which emojis someone has tapped is remembered on their device, so tapping
// again takes their reaction back.
//
// Switched on by NEXT_PUBLIC_FIREBASE_PROJECT_ID and NEXT_PUBLIC_FIREBASE_API_KEY
// (the project's public web config). NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST points
// it at a local Firestore emulator instead, for testing.

import { useCallback, useEffect, useSyncExternalStore } from "react";

export const EMOJIS = [
  { key: "love", emoji: "❤️", label: "Love" },
  { key: "laugh", emoji: "😂", label: "Made me laugh" },
  { key: "aww", emoji: "🥰", label: "Aww" },
  { key: "legend", emoji: "🔥", label: "Legend" },
  { key: "cheers", emoji: "🥂", label: "Cheers" },
] as const;

export type EmojiKey = (typeof EMOJIS)[number]["key"];
type Counts = Partial<Record<EmojiKey, number>>;

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "";
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "";
const emulatorHost = process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST ?? "";

export const reactionsEnabled = projectId !== "" && (apiKey !== "" || emulatorHost !== "");

const api = emulatorHost ? `http://${emulatorHost}/v1` : "https://firestore.googleapis.com/v1";
const database = `projects/${projectId}/databases/(default)`;
const keyParam = apiKey ? `key=${encodeURIComponent(apiKey)}` : "";
const MINE_KEY = "memorial:reactions";

// ---------------------------------------------------------------------------
// A small shared store: every memory on the page reads from one fetch.

type State = { counts: Map<string, Counts>; mine: Record<string, EmojiKey[]> };

let state: State = { counts: new Map(), mine: {} };
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const EMPTY: Counts = {};
const NONE: EmojiKey[] = [];

function emit(next: Partial<State>) {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function isEmojiKey(key: string): key is EmojiKey {
  return EMOJIS.some((e) => e.key === key);
}

function readMine(): Record<string, EmojiKey[]> {
  try {
    const saved = JSON.parse(localStorage.getItem(MINE_KEY) ?? "{}");
    return saved && typeof saved === "object" ? saved : {};
  } catch {
    return {};
  }
}

function saveMine(mine: Record<string, EmojiKey[]>) {
  try {
    localStorage.setItem(MINE_KEY, JSON.stringify(mine));
  } catch {
    // Private browsing: reactions still count, they just can't be undone later.
  }
}

type FirestoreDoc = { name: string; fields?: Record<string, { integerValue?: string }> };

async function loadAll() {
  const counts = new Map<string, Counts>();
  let pageToken = "";
  do {
    const params = [keyParam, "pageSize=300", pageToken && `pageToken=${encodeURIComponent(pageToken)}`]
      .filter(Boolean)
      .join("&");
    const res = await fetch(`${api}/${database}/documents/reactions?${params}`);
    if (!res.ok) throw new Error(`Reactions didn't load (HTTP ${res.status})`);
    const body = (await res.json()) as { documents?: FirestoreDoc[]; nextPageToken?: string };
    for (const doc of body.documents ?? []) {
      const memoryId = doc.name.split("/").pop()!;
      const entry: Counts = {};
      for (const [key, value] of Object.entries(doc.fields ?? {})) {
        if (isEmojiKey(key)) entry[key] = Number(value.integerValue ?? 0);
      }
      counts.set(memoryId, entry);
    }
    pageToken = body.nextPageToken ?? "";
  } while (pageToken);
  emit({ counts });
}

function ensureLoaded() {
  if (!loading) {
    emit({ mine: readMine() });
    loading = loadAll().catch(() => {
      loading = null; // Try again next time a memory appears.
    });
  }
}

/** Adds (+1) or takes back (-1) one reaction, resolving with the new count. */
async function sendReaction(memoryId: string, key: EmojiKey, delta: 1 | -1): Promise<number> {
  const res = await fetch(`${api}/${database}/documents:commit${keyParam ? `?${keyParam}` : ""}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      writes: [
        {
          transform: {
            document: `${database}/documents/reactions/${memoryId}`,
            fieldTransforms: [{ fieldPath: key, increment: { integerValue: String(delta) } }],
          },
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Reaction not saved (HTTP ${res.status})`);
  const body = await res.json();
  return Number(body.writeResults?.[0]?.transformResults?.[0]?.integerValue ?? NaN);
}

const pending = new Set<string>();

async function toggle(memoryId: string, key: EmojiKey) {
  const id = `${memoryId}:${key}`;
  if (pending.has(id)) return;
  pending.add(id);

  const before = state.counts.get(memoryId) ?? EMPTY;
  const mineBefore = state.mine[memoryId] ?? NONE;
  const adding = !mineBefore.includes(key);
  const optimistic = { ...before, [key]: Math.max(0, (before[key] ?? 0) + (adding ? 1 : -1)) };
  const mine = { ...state.mine, [memoryId]: adding ? [...mineBefore, key] : mineBefore.filter((k) => k !== key) };
  emit({ counts: new Map(state.counts).set(memoryId, optimistic), mine });
  saveMine(mine);

  try {
    const count = await sendReaction(memoryId, key, adding ? 1 : -1);
    if (Number.isFinite(count)) {
      const latest = state.counts.get(memoryId) ?? EMPTY;
      emit({ counts: new Map(state.counts).set(memoryId, { ...latest, [key]: count }) });
    }
  } catch {
    // Put things back as they were.
    const latest = state.counts.get(memoryId) ?? EMPTY;
    const restored = { ...state.mine, [memoryId]: mineBefore };
    emit({ counts: new Map(state.counts).set(memoryId, { ...latest, [key]: before[key] ?? 0 }), mine: restored });
    saveMine(restored);
  } finally {
    pending.delete(id);
  }
}

export function useReactions(memoryId: string) {
  useEffect(() => {
    if (reactionsEnabled) ensureLoaded();
  }, []);
  const counts = useSyncExternalStore(
    subscribe,
    () => state.counts.get(memoryId) ?? EMPTY,
    () => EMPTY,
  );
  const mine = useSyncExternalStore(
    subscribe,
    () => state.mine[memoryId] ?? NONE,
    () => NONE,
  );
  const react = useCallback((key: EmojiKey) => toggle(memoryId, key), [memoryId]);
  return { counts, mine, react };
}
