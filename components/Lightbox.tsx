"use client";

import Image from "next/image";
import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
  type ReactNode,
} from "react";
import { deletePhoto, setPortrait } from "@/app/actions";
import { downloadUrl, formatDate } from "@/lib/format";
import { resizedImageUrl } from "@/lib/image-url";
import type { GalleryPhoto } from "@/lib/types";
import { useIsAdmin } from "@/lib/use-is-admin";
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon, DownloadIcon, StarIcon, TrashIcon } from "./icons";

type OpenLightbox = (photos: GalleryPhoto[], index: number) => void;

const LightboxContext = createContext<OpenLightbox>(() => {});

export function useLightbox(): OpenLightbox {
  return useContext(LightboxContext);
}

export function LightboxProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ photos: GalleryPhoto[]; index: number } | null>(null);
  const open = useCallback<OpenLightbox>((photos, index) => setState({ photos, index }), []);
  const close = useCallback(() => setState(null), []);
  const show = useCallback((index: number) => setState((s) => (s ? { ...s, index } : s)), []);

  return (
    <LightboxContext value={open}>
      {children}
      {state && <Lightbox photos={state.photos} index={state.index} onShow={show} onClose={close} />}
    </LightboxContext>
  );
}

function Lightbox({
  photos,
  index,
  onShow,
  onClose,
}: {
  photos: GalleryPhoto[];
  index: number;
  onShow: (index: number) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const justSwiped = useRef(false);
  const isAdmin = useIsAdmin();
  const photo = photos[index];
  const many = photos.length > 1;
  // Room for captions is kept under every photo when any of them has one.
  const hasCaptions = photos.some((p) => p.caption);

  const go = useCallback(
    (delta: number) => onShow((index + delta + photos.length) % photos.length),
    [index, photos.length, onShow],
  );

  useEffect(() => {
    const el = dialog.current!;
    el.showModal();
    document.documentElement.classList.add("no-scroll");
    return () => {
      document.documentElement.classList.remove("no-scroll");
      if (el.open) el.close();
    };
  }, []);

  useEffect(() => {
    if (!many) return;
    function onKey(event: KeyboardEvent) {
      // Arrow keys on a video move through it instead.
      if (event.target instanceof HTMLVideoElement) return;
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, many]);

  const close = () => dialog.current?.close();

  return (
    <dialog
      ref={dialog}
      className="lightbox"
      aria-label="Photo viewer"
      data-captions={hasCaptions || undefined}
      onClose={onClose}
    >
      <div className="lb-bar">
        <span className="lb-count">{many ? `${index + 1} of ${photos.length}` : ""}</span>
        <div className="lb-tools">
          {isAdmin && <AdminPhotoTools key={photo.id} photo={photo} onDeleted={close} />}
          {photo.video ? (
            // Firebase serves videos from another site, so browsers open them rather than download them.
            <a className="lb-btn" href={photo.video.url} target="_blank" rel="noreferrer" download>
              <DownloadIcon />
              <span className="lb-btn-label">Download</span>
            </a>
          ) : (
            <a className="lb-btn" href={downloadUrl(photo.url)} download>
              <DownloadIcon />
              <span className="lb-btn-label">Download</span>
            </a>
          )}
          <button type="button" className="lb-btn" onClick={close} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
      </div>

      <div
        className="lb-stage"
        onPointerDown={(e) => {
          // Dragging on a video moves through it, so it isn't a swipe.
          if (e.isPrimary && !(e.target instanceof HTMLVideoElement)) swipe.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          const start = swipe.current;
          swipe.current = null;
          if (!start || !many) return;
          const dx = e.clientX - start.x;
          const dy = e.clientY - start.y;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            justSwiped.current = true;
            go(dx < 0 ? 1 : -1);
          }
        }}
        onPointerCancel={() => (swipe.current = null)}
        onClick={(e) => {
          if (justSwiped.current) justSwiped.current = false;
          else if (e.target === e.currentTarget) close();
        }}
      >
        {many && (
          <button type="button" className="lb-nav lb-prev" onClick={() => go(-1)} aria-label="Previous">
            <ChevronLeftIcon width={28} height={28} />
          </button>
        )}
        {photo.video ? (
          <LightboxVideo key={photo.id} photo={photo} />
        ) : (
          <Image
            key={photo.id}
            src={photo.url}
            width={photo.width}
            height={photo.height}
            sizes="100vw"
            loading="eager"
            alt={photo.caption || `Photo shared by ${photo.sharedBy}`}
            className="lb-img"
            style={{ backgroundColor: photo.color }}
            draggable={false}
          />
        )}
        {many && (
          <button type="button" className="lb-nav lb-next" onClick={() => go(1)} aria-label="Next">
            <ChevronRightIcon width={28} height={28} />
          </button>
        )}
        {many && (
          // Fetch the next photo early so swiping through feels instant.
          <Image
            key={`next-${photos[(index + 1) % photos.length].id}`}
            src={photos[(index + 1) % photos.length].url}
            width={photos[(index + 1) % photos.length].width}
            height={photos[(index + 1) % photos.length].height}
            sizes="100vw"
            loading="eager"
            alt=""
            aria-hidden="true"
            className="lb-preload"
          />
        )}
      </div>

      <div className="lb-caption">
        <LightboxCaption key={photo.id} photo={photo} onSeeMemory={close} />
      </div>
    </dialog>
  );
}

/**
 * The words under a photo. Their space is the same height for every photo (two
 * lines of caption, then who shared it), so the photo and the arrows stay in
 * the same place from one photo to the next. A caption too long for two lines
 * shows its first line and "Read more", which opens it over the photo.
 */
function LightboxCaption({ photo, onSeeMemory }: { photo: GalleryPhoto; onSeeMemory: () => void }) {
  const measure = useRef<HTMLParagraphElement>(null);
  const [tooLong, setTooLong] = useState(false);
  const [open, setOpen] = useState(false);
  const { caption } = photo;

  // Before the caption is first drawn, and whenever the screen changes width.
  useLayoutEffect(() => {
    const el = measure.current;
    if (!el) return;
    const check = () => setTooLong(el.scrollHeight > el.clientHeight + 1);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const lines = open ? "" : tooLong ? " lb-lines-1" : " lb-lines-2";
  return (
    <div className="lb-caption-inner" data-open={open || undefined}>
      {caption && (
        <>
          {/* Unseen, held to two lines, to tell whether the caption fits. */}
          <p ref={measure} className="lb-caption-text lb-lines-2 lb-caption-measure" aria-hidden="true">
            {caption}
          </p>
          <p className={`lb-caption-text${lines}`}>{caption}</p>
          {tooLong && (
            <button type="button" className="lb-more" aria-expanded={open} onClick={() => setOpen(!open)}>
              {open ? "Show less" : "Read more"}
            </button>
          )}
        </>
      )}
      <p className="lb-meta">
        <span className="lb-meta-who">Shared by {photo.sharedBy}</span>
        <span className="lb-meta-sep" aria-hidden="true">
          ·
        </span>
        <span className="lb-meta-when">
          {formatDate(photo.sharedAt)} ·{" "}
          <Link href={`/#m-${photo.memoryId}`} onClick={onSeeMemory}>
            See their memory
          </Link>
        </span>
      </p>
    </div>
  );
}

function LightboxVideo({ photo }: { photo: GalleryPhoto }) {
  const [failed, setFailed] = useState(false);
  const video = photo.video!;
  if (failed) {
    return (
      <div className="lb-video-failed">
        <p>This video won&apos;t play here.</p>
        <a href={video.url} target="_blank" rel="noreferrer">
          Open the video file
        </a>
      </div>
    );
  }
  return (
    <video
      className="lb-img lb-video"
      src={video.url}
      poster={resizedImageUrl(photo.url, 1080)}
      width={photo.width}
      height={photo.height}
      controls
      playsInline
      preload="metadata"
      aria-label={photo.caption || `Video shared by ${photo.sharedBy}`}
      onError={() => setFailed(true)}
      style={{ "--ar": photo.width / photo.height } as CSSProperties}
    />
  );
}

function AdminPhotoTools({ photo, onDeleted }: { photo: GalleryPhoto; onDeleted: () => void }) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState("");

  return (
    <>
      {status && (
        <span className="lb-status" role="status">
          {status}
        </span>
      )}
      {!photo.video && (
        <button
          type="button"
          className="lb-btn"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await setPortrait(photo.memoryId, photo.id);
              setStatus(result.ok ? "Set as the main photo" : result.error);
            })
          }
        >
          <StarIcon />
          <span className="lb-btn-label">Use as main photo</span>
        </button>
      )}
      <button
        type="button"
        className="lb-btn lb-danger"
        disabled={pending}
        onClick={() => {
          const what = photo.video ? "video" : "photo";
          if (!window.confirm(`Delete this ${what} for everyone? This can't be undone.`)) return;
          startTransition(async () => {
            const result = await deletePhoto(photo.memoryId, photo.id);
            if (result.ok) onDeleted();
            else setStatus(result.error);
          });
        }}
      >
        <TrashIcon />
        <span className="lb-btn-label">Delete</span>
      </button>
    </>
  );
}
