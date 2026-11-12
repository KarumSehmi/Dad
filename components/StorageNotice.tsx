import { photoStorageMode } from "@/lib/photo-storage";
import { storageMode } from "@/lib/storage";

/** Shown only on a deployment that isn't connected to its storage yet. */
export function StorageNotice() {
  let problem;
  if (storageMode() === "missing") {
    problem = (
      <>
        Storage isn&apos;t connected yet, so nothing can be shared. In the Vercel dashboard, open this project&apos;s
        Storage tab, create a Blob store (public access), connect it, and redeploy.
      </>
    );
  } else if (photoStorageMode() === "missing") {
    problem = (
      <>
        Photo storage isn&apos;t connected yet, so photos can&apos;t be shared. Set up Firebase Storage as the README
        describes, and redeploy.
      </>
    );
  } else {
    return null;
  }
  return (
    <div className="notice" role="status">
      <div className="container">
        <strong>Almost ready.</strong> {problem}
      </div>
    </div>
  );
}
