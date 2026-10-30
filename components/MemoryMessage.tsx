"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";

// Most messages are a short paragraph (half are under 230 characters), but a
// few run to thousands, and in full they'd push everyone else's memories far
// down the page. Those start folded to a few lines, with "Read more".
const FOLDED_LINES = 8;
// Fold only when it hides a good amount: tapping to see two more lines annoys.
const WORTH_FOLDING_LINES = FOLDED_LINES + 5;
// Likely to need folding even on a wide screen, so the page arrives folded
// rather than folding after it appears.
const LIKELY_LONG = 500;

export function MemoryMessage({ paragraphs }: { paragraphs: string[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [long, setLong] = useState(() => paragraphs.join("\n\n").length > LIKELY_LONG);
  const [open, setOpen] = useState(false);

  // Measured before the browser draws, and again whenever the width changes.
  useLayoutEffect(() => {
    const el = box.current!;
    const check = () => {
      const line = parseFloat(getComputedStyle(el).lineHeight) || 28;
      setLong(el.scrollHeight > line * WORTH_FOLDING_LINES);
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const folded = long && !open;
  return (
    <>
      <div
        ref={box}
        className="memory-message"
        data-folded={folded || undefined}
        style={{ "--folded-lines": FOLDED_LINES } as CSSProperties}
      >
        {paragraphs.map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>
      {long && (
        <button
          type="button"
          className="memory-more"
          aria-expanded={open}
          onClick={() => {
            setOpen(!open);
            // Folding a long message back up from the bottom of it would leave
            // the reader somewhere further down the page.
            const card = box.current?.closest("article");
            if (open && card && card.getBoundingClientRect().top < 0) card.scrollIntoView({ block: "start" });
          }}
        >
          {open ? "Show less" : "Read more"}
        </button>
      )}
    </>
  );
}
