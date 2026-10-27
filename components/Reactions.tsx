"use client";

import { useState } from "react";
import { EMOJIS, reactionsEnabled, useReactions, type EmojiKey } from "@/lib/reactions";

/** A row of emoji buttons under a memory. Tap to react, tap again to take it back. */
export function Reactions({ memoryId }: { memoryId: string }) {
  const { counts, mine, react } = useReactions(memoryId);
  const [popped, setPopped] = useState<EmojiKey | null>(null);
  if (!reactionsEnabled) return null;

  return (
    <div className="reactions" role="group" aria-label="Reactions">
      {EMOJIS.map(({ key, emoji, label }) => {
        const count = counts[key] ?? 0;
        const on = mine.includes(key);
        return (
          <button
            key={key}
            type="button"
            className="reaction"
            aria-pressed={on}
            aria-label={count ? `${label}, ${count}` : label}
            title={label}
            data-pop={popped === key || undefined}
            onClick={() => {
              if (!on) setPopped(key);
              react(key);
            }}
            onAnimationEnd={() => setPopped(null)}
          >
            <span className="reaction-emoji" aria-hidden="true">
              {emoji}
            </span>
            {count > 0 && <span className="reaction-count">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
