"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { createMemory, type NewMemoryInput, type UploadedVideo } from "@/app/actions";
import { formatDuration } from "@/lib/format";
import { friendlyPhotoError, preparePhoto, type PreparedPhoto } from "@/lib/prepare-photo";
import { isVideoFile, prepareVideo, VideoError, type PreparedVideo } from "@/lib/prepare-video";
import type { Photo } from "@/lib/types";
import { uploadVideo, videoUploadError } from "@/lib/upload-video";
import { LIMITS } from "@/lib/validate";
import { videosEnabled } from "@/lib/video";
import { relationships, relationshipTitle, site } from "@/site.config";
import { CloseIcon, PhotoIcon, PlayIcon } from "./icons";
import { THANKS_KEY } from "./ThankYouToast";

type Uploaded = { photo: Photo; receipt: string };

type Item = {
  key: string;
  fileName: string;
  kind: "photo" | "video";
  status: "preparing" | "ready" | "failed";
  /** The photo, or for a video, the still that stands in for it. */
  prepared?: PreparedPhoto;
  video?: Omit<PreparedVideo, "poster">;
  uploaded?: Uploaded;
  uploadedVideo?: UploadedVideo;
  error?: string;
};

type Phase =
  | { step: "idle" }
  | { step: "uploading"; done: number; total: number; fraction: number }
  | { step: "saving" }
  | { step: "done" };

const REMEMBERED = "memorial:sharer";

class UploadError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
  }
}

async function uploadPhoto(prepared: PreparedPhoto): Promise<Uploaded> {
  const body = new FormData();
  body.append("photo", prepared.blob, "photo.jpg");
  body.append("color", prepared.color);
  let res: Response;
  try {
    res = await fetch("/api/photos", { method: "POST", body });
  } catch {
    throw new UploadError("A photo didn't upload. Please check your connection and try again.", true);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.photo) {
    throw new UploadError(json?.error ?? "A photo didn't upload. Please try again.", res.status >= 500);
  }
  return json as Uploaded;
}

async function uploadWithRetry(prepared: PreparedPhoto): Promise<Uploaded> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await uploadPhoto(prepared);
    } catch (error) {
      if (attempt >= 3 || !(error instanceof UploadError) || !error.retryable) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    }
  }
}

export function ShareForm() {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [phase, setPhase] = useState<Phase>({ step: "idle" });
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const nextKey = useRef(0);
  const removed = useRef(new Set<string>());
  const queue = useRef(Promise.resolve());
  const latest = useRef({ items, phase });
  const busy = phase.step !== "idle";

  useEffect(() => {
    latest.current = { items, phase };
  });

  // Fill in the name used last time, and warn before leaving with unsent work.
  useEffect(() => {
    const el = form.current!;
    try {
      const saved = JSON.parse(localStorage.getItem(REMEMBERED) ?? "null");
      const fields = el.elements as unknown as Record<string, HTMLInputElement>;
      if (saved?.name && !fields.name.value) fields.name.value = saved.name;
      if (saved?.relationship && !fields.relationship.value) fields.relationship.value = saved.relationship;
    } catch {
      // Storage can be unavailable (private browsing); nothing to restore.
    }

    function onBeforeUnload(event: BeforeUnloadEvent) {
      const { items, phase } = latest.current;
      const message = (el.elements.namedItem("message") as HTMLTextAreaElement).value.trim();
      if (phase.step !== "done" && (items.length > 0 || message)) event.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      for (const item of latest.current.items) {
        if (item.prepared) URL.revokeObjectURL(item.prepared.previewUrl);
      }
    };
  }, []);

  function update(key: string, change: Partial<Item>) {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...change } : item)));
  }

  function addFiles(files: FileList | null) {
    if (!files?.length) return;
    let room = LIMITS.photosPerMemory - items.length;
    let videoRoom = LIMITS.videosPerMemory - items.filter((item) => item.kind === "video").length;
    const accepted: { file: File; kind: Item["kind"] }[] = [];
    let skipped = "";
    for (const file of Array.from(files)) {
      const kind = isVideoFile(file) ? "video" : "photo";
      if (room <= 0) {
        const what = videosEnabled ? "photos and videos" : "photos";
        skipped = `You can add up to ${LIMITS.photosPerMemory} ${what} at a time. Share the rest in another memory.`;
      } else if (kind === "video" && videosEnabled && videoRoom <= 0) {
        skipped = `You can add up to ${LIMITS.videosPerMemory} videos at a time. Share the rest in another memory.`;
      } else {
        accepted.push({ file, kind });
        room -= 1;
        if (kind === "video") videoRoom -= 1;
      }
    }
    setError(skipped);
    const added: Item[] = accepted.map(({ file, kind }) => ({
      key: `p${nextKey.current++}`,
      fileName: file.name,
      kind,
      status: "preparing",
    }));
    setItems((current) => [...current, ...added]);

    // One at a time, so phones don't run out of memory with big batches.
    accepted.forEach(({ file, kind }, i) => {
      const { key } = added[i];
      queue.current = queue.current.then(async () => {
        if (removed.current.has(key)) return;
        try {
          let change: Partial<Item>;
          if (kind === "photo") {
            change = { prepared: await preparePhoto(file) };
          } else {
            if (!videosEnabled) throw new VideoError("Videos can't be shared on this site yet.");
            const { poster, ...video } = await prepareVideo(file);
            change = { prepared: poster, video };
          }
          if (removed.current.has(key)) URL.revokeObjectURL(change.prepared!.previewUrl);
          else update(key, { status: "ready", ...change });
        } catch (cause) {
          const error =
            kind === "photo"
              ? friendlyPhotoError(file)
              : cause instanceof VideoError
                ? cause.message
                : "This video couldn't be opened.";
          update(key, { status: "failed", error });
        }
      });
    });
  }

  function removeItem(item: Item) {
    removed.current.add(item.key);
    if (item.prepared) URL.revokeObjectURL(item.prepared.previewUrl);
    setItems((current) => current.filter((i) => i.key !== item.key));
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (!busy) addFiles(event.dataTransfer.files);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const el = event.currentTarget;
    const data = new FormData(el);
    const text = (field: string) => String(data.get(field) ?? "").trim();
    const name = text("name");
    const relationship = text("relationship");
    const message = text("message");
    const ready = items.filter((item) => item.status === "ready");

    if (!name) {
      setError("Please add your name so people know who shared this.");
      (el.elements.namedItem("name") as HTMLInputElement).focus();
      return;
    }
    if (items.some((item) => item.status === "preparing")) {
      setError(`Your ${videosEnabled ? "photos and videos are" : "photos are"} still being prepared. This only takes a moment.`);
      return;
    }
    if (!message && ready.length === 0) {
      setError(`Please write a message, or add a photo${videosEnabled ? " or video" : ""}.`);
      return;
    }
    setError("");

    try {
      // Progress is measured in bytes, since one video can outweigh many photos.
      const total = ready.reduce((sum, item) => sum + item.prepared!.blob.size + (item.video?.file.size ?? 0), 0);
      let sent = 0;
      const photos: NewMemoryInput["photos"] = [];
      for (const [i, item] of ready.entries()) {
        const progress = (bytes: number) =>
          setPhase({ step: "uploading", done: i, total: ready.length, fraction: (sent + bytes) / total });
        progress(0);
        // Each upload is remembered, so trying again after a failure doesn't repeat it.
        const uploaded = item.uploaded ?? (await uploadWithRetry(item.prepared!));
        if (!item.uploaded) update(item.key, { uploaded });
        sent += item.prepared!.blob.size;

        let video = item.uploadedVideo;
        if (item.video && !video) {
          try {
            video = await uploadVideo(item.video, progress);
          } catch (cause) {
            throw new UploadError(videoUploadError(cause), false);
          }
          update(item.key, { uploadedVideo: video });
        }
        sent += item.video?.file.size ?? 0;

        const caption = text(`caption-${item.key}`);
        if (item.video) photos.push({ ...uploaded, caption, video: { ...video!, duration: item.video.duration } });
        else photos.push({ ...uploaded, caption });
      }

      setPhase({ step: "saving" });
      const result = await createMemory({ name, relationship, message, website: text("website"), photos });
      if (!result.ok) {
        setError(result.error);
        setPhase({ step: "idle" });
        return;
      }
      try {
        localStorage.setItem(REMEMBERED, JSON.stringify({ name, relationship }));
        sessionStorage.setItem(THANKS_KEY, JSON.stringify({ id: result.id, name }));
      } catch {
        // Not being able to remember the name or say thank you is fine.
      }
      setPhase({ step: "done" });
      router.push(result.id ? `/#m-${result.id}` : "/");
    } catch (cause) {
      setError(
        cause instanceof UploadError
          ? cause.message
          : "Something went wrong while sharing. Please check your connection and try again.",
      );
      setPhase({ step: "idle" });
    }
  }

  const hasVideo = items.some((item) => item.kind === "video" && item.status === "ready");
  const submitLabel =
    phase.step === "uploading"
      ? hasVideo
        ? `Uploading… ${Math.floor(phase.fraction * 100)}%`
        : `Uploading photo ${phase.done + 1} of ${phase.total}…`
      : phase.step === "saving"
        ? "Saving…"
        : phase.step === "done"
          ? "Shared. Thank you"
          : "Share";

  return (
    <form ref={form} className="share-form" onSubmit={onSubmit} noValidate>
      <div className="field">
        <label htmlFor="name">Your name</label>
        <input id="name" name="name" autoComplete="name" maxLength={LIMITS.name} required disabled={busy} />
      </div>

      <div className="field">
        <label htmlFor="relationship">
          How you knew {site.firstName} <span className="optional">(optional)</span>
        </label>
        <select id="relationship" name="relationship" defaultValue="" disabled={busy}>
          <option value="">Choose one</option>
          {relationships.map(({ group, options }) => (
            <optgroup key={group} label={group}>
              {options.map((option) => {
                const title = relationshipTitle(option);
                return (
                  <option key={title} value={title}>
                    {typeof option === "string" ? title : `${title} – ${option[1]}`}
                  </option>
                );
              })}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="message">
          Your message <span className="optional">(optional if you add {videosEnabled ? "photos or videos" : "photos"})</span>
        </label>
        <textarea
          id="message"
          name="message"
          rows={7}
          maxLength={LIMITS.message}
          placeholder={`A favourite memory, a funny story, or a few words about ${site.firstName}…`}
          disabled={busy}
        />
      </div>

      <fieldset className="field">
        <legend>
          {videosEnabled ? "Photos and videos" : "Photos"} <span className="optional">(optional)</span>
        </legend>

        {items.length > 0 && (
          <ul className="share-photos">
            {items.map((item) => (
              <li key={item.key} className="share-photo" data-status={item.status}>
                <div className="share-photo-thumb">
                  {item.prepared ? (
                    // A local preview of the resized photo; next/image can't optimise blob: URLs.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.prepared.previewUrl} alt="" />
                  ) : item.status === "preparing" ? (
                    <span className="spinner" aria-label={`Preparing ${item.kind}`} />
                  ) : null}
                  {item.kind === "video" && item.status === "ready" && (
                    <span className="video-badge">
                      <PlayIcon width={12} height={12} />
                      {item.video?.duration ? formatDuration(item.video.duration) : "Video"}
                    </span>
                  )}
                  <button
                    type="button"
                    className="share-photo-remove"
                    onClick={() => removeItem(item)}
                    disabled={busy}
                    aria-label={`Remove ${item.fileName}`}
                  >
                    <CloseIcon width={16} height={16} />
                  </button>
                </div>
                {item.status === "failed" ? (
                  <p className="share-photo-error">{item.error}</p>
                ) : (
                  <input
                    name={`caption-${item.key}`}
                    className="share-photo-caption"
                    placeholder="Caption (optional)"
                    maxLength={LIMITS.caption}
                    aria-label={`Caption for ${item.fileName}`}
                    disabled={busy}
                  />
                )}
              </li>
            ))}
          </ul>
        )}

        <label
          className="dropzone"
          data-dragging={dragging || undefined}
          data-disabled={busy || items.length >= LIMITS.photosPerMemory || undefined}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <input
            type="file"
            accept={videosEnabled ? "image/*,video/*" : "image/*"}
            multiple
            className="visually-hidden"
            disabled={busy || items.length >= LIMITS.photosPerMemory}
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <PhotoIcon width={28} height={28} />
          <span className="dropzone-title">
            {videosEnabled
              ? items.length
                ? "Add more"
                : "Add photos or videos"
              : items.length
                ? "Add more photos"
                : "Add photos"}
          </span>
          <span className="dropzone-hint">
            Choose from your phone or computer, up to {LIMITS.photosPerMemory} at a time
            {videosEnabled && ` (videos up to ${LIMITS.videoBytes / 1024 / 1024} MB each)`}
          </span>
        </label>
      </fieldset>

      {/* Left empty by people; bots tend to fill it in. */}
      <div className="hp" aria-hidden="true">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="form-actions">
        <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>
          {submitLabel}
        </button>
        {phase.step === "uploading" && (
          <div
            className="progress"
            role="progressbar"
            aria-label="Upload progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.floor(phase.fraction * 100)}
          >
            <span style={{ width: `${phase.fraction * 100}%` }} />
          </div>
        )}
        <p className="form-note">
          {phase.step === "uploading" && hasVideo
            ? "Videos can take a few minutes. Please keep this page open until it's finished."
            : "Anyone with the link to this site will be able to see what you share."}
        </p>
      </div>
    </form>
  );
}
