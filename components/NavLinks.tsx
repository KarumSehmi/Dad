"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// "Memories" is hidden on very narrow screens, where the site name (which
// links home) does the same job.
const LINKS = [
  { href: "/", label: "Memories", narrow: false },
  { href: "/photos", label: "Photos", narrow: true },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <>
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={link.narrow ? "nav-link" : "nav-link wide-only"}
          aria-current={pathname === link.href ? "page" : undefined}
        >
          {link.label}
        </Link>
      ))}
    </>
  );
}
