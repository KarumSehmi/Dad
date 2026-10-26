import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { lifeDates, site } from "@/site.config";

// The picture shown when the link is shared in messages or on social media,
// used until a family admin picks a main photo (see generateMetadata in
// app/layout.tsx).

const [medium, italic] = await Promise.all([
  readFile(join(process.cwd(), "assets/fonts/CormorantGaramond-Medium.woff")),
  readFile(join(process.cwd(), "assets/fonts/CormorantGaramond-MediumItalic.woff")),
]);

export async function GET() {
  const dates = lifeDates();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#f6f1e9",
          color: "#2b2520",
          fontFamily: "Cormorant",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 30,
            left: 30,
            right: 30,
            bottom: 30,
            display: "flex",
            border: "2px solid #d8ccbb",
            borderRadius: 28,
          }}
        />
        <svg width="56" height="56" viewBox="0 0 64 64">
          <path
            d="M32 9c1.6 7.5-6.5 11-6.5 19.5a6.5 6.5 0 0 0 13 0c0-3.2-1.6-5.4-2.7-7.6 5.4 2.2 10.2 8.1 10.2 16.7A14 14 0 0 1 32 51.6a14 14 0 0 1-14-14C18 24.8 29.8 18.5 32 9z"
            fill="#7a5c33"
          />
        </svg>
        <div style={{ marginTop: 22, fontSize: 30, letterSpacing: 9, color: "#7a5c33", textTransform: "uppercase" }}>
          In loving memory
        </div>
        <div style={{ marginTop: 6, fontSize: 128, lineHeight: 1.1 }}>{site.name}</div>
        {dates && <div style={{ fontSize: 46, fontStyle: "italic", color: "#5b524a" }}>{dates}</div>}
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Cormorant", data: medium, weight: 500, style: "normal" },
        { name: "Cormorant", data: italic, weight: 500, style: "italic" },
      ],
    },
  );
}
