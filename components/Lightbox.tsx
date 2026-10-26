"use client";

import Image from "next/image";
import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { deletePhoto, setPortrait } from "@/app/actions";
import { downloadUrl, formatDate } from "@/lib/format";
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
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, many]);

  const close = () => dialog.current?.close();

  return (
    <dialog ref={dialog} className="lightbox" aria-label="Photo viewer" onClose={onClose}>
      <div className="lb-bar">
        <span className="lb-count">{many ? `${index + 1} of ${photos.length}` : ""}</span>
        <div className="lb-tools">
          {isAdmin && <AdminPhotoTools key={photo.id} photo={photo} onDeleted={close} />}
          <a className="lb-btn" href={downloadUrl(photo.url)} download>
            <DownloadIcon />
            <span className="lb-btn-label">Download</span>
          </a>
          <button type="button" className="lb-btn" onClick={close} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
      </div>

      <div
        className="lb-stage"
        onPointerDown={(e) => {
          if (e.isPrimary) swipe.current = { x: e.clientX, y: e.clientY };
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
          <button type="button" className="lb-nav lb-prev" onClick={() => go(-1)} aria-label="Previous photo">
            <ChevronLeftIcon width={28} height={28} />
          </button>
        )}
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
        {many && (
          <button type="button" className="lb-nav lb-next" onClick={() => go(1)} aria-label="Next photo">
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
        {photo.caption && <p className="lb-caption-text">{photo.caption}</p>}
        <p className="lb-meta">
          Shared by {photo.sharedBy} · {formatDate(photo.sharedAt)} ·{" "}
          <Link href={`/#m-${photo.memoryId}`} onClick={close}>
            See their memory
          </Link>
        </p>
      </div>
    </dialog>
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
      <button
        type="button"
        className="lb-btn lb-danger"
        disabled={pending}
        onClick={() => {
          if (!window.confirm("Delete this photo for everyone? This can't be undone.")) return;
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
