import { storageMode } from "@/lib/storage";

/** Shown only on a deployment that has no photo storage connected yet. */
export function StorageNotice() {
  if (storageMode() !== "missing") return null;
  return (
    <div className="notice" role="status">
      <div className="container">
        <strong>Almost ready.</strong> Photo storage isn&apos;t connected yet, so nothing can be shared. In the Vercel
        dashboard, open this project&apos;s Storage tab, create a Blob store (public access), connect it, and redeploy.
      </div>
    </div>
  );
}
