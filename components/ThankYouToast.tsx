"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { site } from "@/site.config";
import { CloseIcon } from "./icons";

/** Set by the share form just before it brings the sharer back to the home page. */
export const THANKS_KEY = "memorial:thanks";

type Thanks = { id: string; name: string };

const neverChanges = () => () => {};

// Returns the stored JSON only when we've just landed on that memory, so the
// message isn't shown again on later visits to the home page.
function readThanks(): string | null {
  try {
    const raw = sessionStorage.getItem(THANKS_KEY);
    const thanks: Thanks | null = raw ? JSON.parse(raw) : null;
    return thanks && window.location.hash === `#m-${thanks.id}` ? raw : null;
  } catch {
    return null;
  }
}

export function ThankYouToast() {
  const raw = useSyncExternalStore(neverChanges, readThanks, () => null);
  const [dismissed, setDismissed] = useState(false);
  const visible = Boolean(raw) && !dismissed;

  const dismiss = useCallback(() => {
    try {
      sessionStorage.removeItem(THANKS_KEY);
    } catch {
      // Nothing to clean up.
    }
    setDismissed(true);
  }, []);

  useEffect(() => {
    if (!visible) return;
    // Outline the new memory. (CSS :target doesn't apply after an in-app
    // navigation, so this is done here.)
    document.getElementById(`m-${(JSON.parse(raw!) as Thanks).id}`)?.classList.add("is-new");
    const timer = setTimeout(dismiss, 8000);
    return () => clearTimeout(timer);
  }, [visible, dismiss, raw]);

  if (!visible) return null;
  const firstName = (JSON.parse(raw!) as Thanks).name.split(" ")[0];

  return (
    <div className="toast" role="status">
      <span>
        Thank you, {firstName}. Your memory of {site.firstName} is now on the page.
      </span>
      <button type="button" onClick={dismiss} aria-label="Close">
        <CloseIcon width={18} height={18} />
      </button>
    </div>
  );
}
