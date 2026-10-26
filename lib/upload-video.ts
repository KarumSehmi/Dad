// Runs in the browser. Sends a video straight to Firebase Storage in chunks,
// carrying on through patchy connections and reporting progress as it goes.
// Firebase's code is only downloaded when someone shares a video.

import { videoPath, videoStorage } from "./video";

type Sdk = typeof import("@firebase/storage");
type Storage = ReturnType<Sdk["getStorage"]>;

let loading: Promise<{ sdk: Sdk; storage: Storage }> | null = null;

function connect() {
  loading ??= (async () => {
    const [{ getApp, getApps, initializeApp }, sdk] = await Promise.all([
      import("@firebase/app"),
      import("@firebase/storage"),
    ]);
    const app = getApps().length ? getApp() : initializeApp({ storageBucket: videoStorage.bucket });
    const storage = sdk.getStorage(app);
    if (videoStorage.emulatorHost) {
      const [host, port] = videoStorage.emulatorHost.split(":");
      sdk.connectStorageEmulator(storage, host, Number(port));
    }
    // Keep retrying for a good while: phones drop signal, and big videos take time.
    storage.maxUploadRetryTime = 30 * 60 * 1000;
    return { sdk, storage };
  })().catch((error) => {
    loading = null; // Let the next attempt try again.
    throw error;
  });
  return loading;
}

function newVideoId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Uploads the video and returns where it was stored. Calls onProgress with bytes sent so far. */
export async function uploadVideo(
  video: { file: Blob; type: string; ext: string },
  onProgress: (sent: number) => void,
): Promise<{ id: string; ext: string }> {
  const { sdk, storage } = await connect();
  // A new id every time, so a retry never collides with a half-finished upload.
  const id = newVideoId();
  const task = sdk.uploadBytesResumable(sdk.ref(storage, videoPath(id, video.ext)), video.file, {
    contentType: video.type,
    cacheControl: "public, max-age=31536000, immutable",
  });
  await new Promise<void>((resolve, reject) => {
    task.on("state_changed", (snapshot) => onProgress(snapshot.bytesTransferred), reject, resolve);
  });
  return { id, ext: video.ext };
}

/** What to tell the sharer when uploadVideo fails. */
export function videoUploadError(error: unknown): string {
  const code = (error as { code?: string } | null)?.code ?? "";
  if (code === "storage/unauthorized") {
    return "A video couldn't be uploaded. It may be too large or not a video file.";
  }
  if (code === "storage/quota-exceeded") {
    return "There's no room for more videos just now. Please let the family know.";
  }
  return "A video didn't finish uploading. Please check your connection and try again.";
}
