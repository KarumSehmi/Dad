import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { LightboxProvider } from "@/components/Lightbox";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getSettings } from "@/lib/data";
import { optimizedImageUrl } from "@/lib/format";
import { site } from "@/site.config";
import "./globals.css";

// A warm, slightly playful serif for headings (its "soft" setting is turned
// up in globals.css).
const display = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["SOFT", "WONK", "opsz"],
  variable: "--font-display",
});

const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });

// The preview picture for shared links: the main photo once one is chosen
// (served through the image optimizer as a modest-sized file, which messaging
// apps prefer), otherwise the name card drawn by app/og/route.tsx.
async function previewImage(): Promise<NonNullable<Metadata["openGraph"]>["images"]> {
  const { portrait } = await getSettings();
  const optimized = (src: string) => optimizedImageUrl(src, 1080);
  if (portrait) {
    const width = Math.min(1080, portrait.width);
    return [{ url: optimized(portrait.url), width, height: Math.round((width * portrait.height) / portrait.width), alt: site.name }];
  }
  if (site.portrait) return [{ url: optimized(site.portrait), alt: site.name }];
  return [{ url: "/og", width: 1200, height: 630, alt: `Celebrating ${site.name}` }];
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    // Full web address used in link previews. Without SITE_URL, Vercel's
    // production domain is used.
    metadataBase: process.env.SITE_URL ? new URL(process.env.SITE_URL) : undefined,
    title: { default: `Celebrating ${site.name}`, template: `%s · ${site.name}` },
    description: site.tribute[0],
    openGraph: {
      title: `Celebrating ${site.name}`,
      description: site.tribute[0],
      type: "website",
      images: await previewImage(),
    },
    twitter: { card: "summary_large_image" },
    robots: site.allowSearchEngines ? undefined : { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#f6f1e9",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <LightboxProvider>
          <SiteHeader />
          <main id="main">{children}</main>
          <SiteFooter />
        </LightboxProvider>
      </body>
    </html>
  );
}
