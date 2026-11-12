import { photoStorageMode } from "@/lib/photo-storage";
import { storageMode } from "@/lib/storage";

/** Shown only on a deployment that isn't connected to its storage yet. */
export function StorageNotice() {
  if (storageMode() !== "missing" && photoStorageMode() !== "missing") return null;
  return (
    <div className="notice" role="status">
      <div className="container">
        <strong>Almost ready.</strong> Storage isn&apos;t connected yet, so nothing can be shared. Set up Firebase as
        the README describes, and redeploy.
      </div>
    </div>
  );
}
