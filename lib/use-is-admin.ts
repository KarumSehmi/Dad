"use client";

import { useSyncExternalStore } from "react";

// The real admin check happens on the server for every admin action. This
// only reads the non-secret flag cookie set at sign-in, to decide whether to
// show the admin buttons on otherwise identical cached pages.

const EVENT = "admin-change";

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("focus", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("focus", onChange);
  };
}

const read = () => document.cookie.split("; ").includes("hs_admin=1");

export function useIsAdmin(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}

export function announceAdminChange() {
  window.dispatchEvent(new Event(EVENT));
}
