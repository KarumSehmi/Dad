import Link from "next/link";
import { site } from "@/site.config";
import { AdminFooterLink } from "./AdminFooterLink";
import { NavLinks } from "./NavLinks";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container site-header-inner">
        <Link href="/" className="site-title">
          {site.name}
        </Link>
        <nav className="site-nav" aria-label="Main">
          <NavLinks />
          <Link href="/share" className="btn btn-primary btn-sm">
            <span>
              Share<span data-hide-below="640"> a memory</span>
            </span>
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container site-footer-inner">
        <p>In loving memory of {site.name}</p>
        {/* The admin page is at /admin; there's deliberately no link to it for visitors. */}
        <AdminFooterLink />
      </div>
    </footer>
  );
}
