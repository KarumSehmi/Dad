import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { initials } from "@/lib/format";
import { site } from "@/site.config";

// Read when the module loads, so the icons can be made once at build time.
const font = await readFile(join(process.cwd(), "assets/fonts/CormorantGaramond-Medium.woff"));

/** His initials in the site's serif, used for the browser tab and home-screen icons. */
export function monogram(size: number, { rounded }: { rounded: boolean }) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f6f1e9",
          borderRadius: rounded ? size * 0.22 : 0,
          color: "#7a5c33",
          fontFamily: "Cormorant",
          fontSize: size * 0.52,
          letterSpacing: size * 0.01,
          paddingBottom: size * 0.04,
        }}
      >
        {initials(site.name)}
      </div>
    ),
    {
      width: size,
      height: size,
      fonts: [{ name: "Cormorant", data: font, weight: 500, style: "normal" }],
    },
  );
}
