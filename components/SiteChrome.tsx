import Link from "next/link";
import { site } from "@/site.config";
import { FlameIcon } from "./icons";
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
        <p>
          <FlameIcon width={16} height={16} />
          In loving memory of {site.name}
        </p>
        <Link href="/admin" className="footer-link">
          Family admin
        </Link>
      </div>
    </footer>
  );
}
