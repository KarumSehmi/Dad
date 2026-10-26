import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { initials } from "@/lib/format";
import { site } from "@/site.config";

// Read when the module loads, so the icons can be made once at build time.
const font = await readFile(join(process.cwd(), "assets/fonts/Fraunces-SemiBold.woff"));

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
          background: "#b9381f",
          borderRadius: rounded ? size * 0.22 : 0,
          color: "#fff4e6",
          fontFamily: "Fraunces",
          fontSize: size * 0.44,
          letterSpacing: -size * 0.01,
          paddingBottom: size * 0.03,
        }}
      >
        {initials(site.name)}
      </div>
    ),
    {
      width: size,
      height: size,
      fonts: [{ name: "Fraunces", data: font, weight: 600, style: "normal" }],
    },
  );
}
