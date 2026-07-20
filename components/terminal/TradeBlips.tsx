"use client";

import type { TradeBlip } from "@/lib/markets/useTradeBlips";
import { toneForLabel } from "./oracle/atoms";

/**
 * Floating fill indicators over the price chart's bottom-left corner — the
 * live tape. Fills only (order placements just move the book ladder); the
 * connected wallet's own fills are promoted: accent tone, bold, explicit
 * copy. Purely decorative — pointer-events pass through, hidden from AT
 * (the activity feed carries the accessible record).
 */
export function TradeBlips({ blips }: { blips: TradeBlip[] }) {
  if (blips.length === 0) return null;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute bottom-3 left-4 z-10 flex flex-col items-start gap-1.5"
    >
      {blips.map((b) => {
        const tone = b.mine ? "var(--color-accent)" : toneForLabel(b.label);
        const line = `${b.sign}${b.qty} ${b.label.toUpperCase()} @ ${b.priceCents}¢`;
        return (
          <span
            key={b.id}
            className={`blip-life border px-2.5 py-1 font-mono text-[11px] tracking-[0.08em] whitespace-nowrap ${
              b.mine ? "font-bold" : ""
            }`}
            style={{
              color: tone,
              borderColor: b.mine ? tone : "var(--color-line)",
              background:
                "color-mix(in srgb, var(--color-surface) 88%, transparent)",
            }}
          >
            {b.mine ? `your ${b.mine} filled · ${line}` : line}
          </span>
        );
      })}
    </div>
  );
}
