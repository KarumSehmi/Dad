"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// On narrow screens the links are hidden in turn (see globals.css): first
// "Memories", since the site name also links home, then "Photos", which the
// home page links to as well.
const LINKS = [
  { href: "/", label: "Memories", hideBelow: "480" },
  { href: "/photos", label: "Photos", hideBelow: "340" },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <>
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="nav-link"
          data-hide-below={link.hideBelow}
          aria-current={pathname === link.href ? "page" : undefined}
        >
          {link.label}
        </Link>
      ))}
    </>
  );
}
