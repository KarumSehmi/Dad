"use client";

import Link from "next/link";
import { useIsAdmin } from "@/lib/use-is-admin";

/** Visitors see no way in; family admins signed in on this device get a link back. */
export function AdminFooterLink() {
  if (!useIsAdmin()) return null;
  return (
    <Link href="/admin" className="footer-link">
      Family admin
    </Link>
  );
}
