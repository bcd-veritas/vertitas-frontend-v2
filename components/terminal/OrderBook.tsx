"use client";

import { useState } from "react";
import type { ApiOutcome, BookLevel, OrderBookData } from "@/lib/markets/types";
import { centsLabel, sharesLabel, toCents } from "@/lib/markets/format";

const MAX_ROWS = 8;
const EMPTY_BOOK: OrderBookData = { bids: [], asks: [] };

/** Same hatch texture as the dashboard footer's load bars. */
const HATCH = {
  backgroundImage:
    "repeating-linear-gradient(45deg, currentColor 0 1.5px, transparent 1.5px 5px)",
} as const;

/** Cumulative share totals from the touch outward, one entry per level. */
function cumulative(levels: BookLevel[]): bigint[] {
  let running = 0n;
  return levels.map((l) => (running += BigInt(l.quantity)));
}

function LadderRow({
  level,
  cum,
  maxCum,
  side,
}: {
  level: BookLevel;
  cum: bigint;
  maxCum: bigint;
  side: "bid" | "ask";
}) {
  const color = side === "bid" ? "text-yes" : "text-no";
  const width = maxCum > 0n ? Number((cum * 100n) / maxCum) : 0;
  return (
    <div className="relative grid grid-cols-[56px_1fr_1fr] items-center gap-2 px-5 py-[5px] font-mono text-[11px] tabular-nums">
      <span
        aria-hidden="true"
        className={`absolute inset-y-[3px] right-0 ${color} opacity-[0.14]`}
        style={{ ...HATCH, width: `${width}%` }}
      />
      <span className={color}>{centsLabel(level.price)}</span>
      <span className="relative text-right text-fg/75">{sharesLabel(level.quantity)}</span>
      <span className="relative text-right text-muted">{sharesLabel(cum.toString())}</span>
    </div>
  );
}

export function OrderBook({
  outcomes,
  books,
}: {
  outcomes: ApiOutcome[];
  books: OrderBookData[];
}) {
  const [sel, setSel] = useState(0);
  const book = books[sel] ?? EMPTY_BOOK;

  const bids = book.bids.slice(0, MAX_ROWS);
  const asks = book.asks.slice(0, MAX_ROWS);
  const bidCum = cumulative(bids);
  const askCum = cumulative(asks);
  const maxCum = [...bidCum, ...askCum].reduce((a, b) => (a > b ? a : b), 0n);

  const bestBid = bids[0] ? toCents(bids[0].price) : null;
  const bestAsk = asks[0] ? toCents(asks[0].price) : null;
  const spread =
    bestBid != null && bestAsk != null ? Math.round(bestAsk - bestBid) : null;
  const mid =
    bestBid != null && bestAsk != null ? Math.round((bestAsk + bestBid) / 2) : null;

  const empty = bids.length === 0 && asks.length === 0;

  return (
    <section
      className="relative bg-surface/70 border border-line rounded-xl overflow-hidden"
      aria-label="Order book"
    >
      <span
        aria-hidden="true"
        className="absolute top-2.5 right-3 font-mono text-muted/40 text-xs select-none"
      >
        +
      </span>
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
        <h2 className="font-pixel text-xl tracking-wide text-fg">ORDER BOOK</h2>
        <div role="tablist" aria-label="Outcome" className="flex items-center gap-1">
          {outcomes.map((o, i) => {
            const on = sel === i;
            return (
              <button
                key={o.id}
                role="tab"
                aria-selected={on}
                onClick={() => setSel(i)}
                className={`px-2.5 py-1 rounded font-mono text-[11px] uppercase tracking-[0.14em] transition-colors ${
                  on
                    ? "bg-accent/10 text-accent border border-accent/25"
                    : "text-muted hover:text-fg/80 border border-transparent"
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>

      {empty ? (
        <p className="py-14 text-center font-mono text-[11px] uppercase tracking-[0.24em] text-muted/70">
          no open orders
        </p>
      ) : (
        <div className="pb-4">
          <div className="grid grid-cols-[56px_1fr_1fr] gap-2 px-5 pb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted/60">
            <span>price</span>
            <span className="text-right">qty</span>
            <span className="text-right">total</span>
          </div>

          {/* Asks: worst at the top, best ask touching the spread row. */}
          {[...asks].reverse().map((l, i) => (
            <LadderRow
              key={`a-${l.price}`}
              level={l}
              cum={askCum[asks.length - 1 - i]}
              maxCum={maxCum}
              side="ask"
            />
          ))}

          <div className="my-1 border-y border-line/60 px-5 py-1.5 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-muted tabular-nums">
            {spread != null
              ? `spread ${spread}¢ · mid ${mid}¢`
              : "spread — · one-sided book"}
          </div>

          {/* Bids: best bid touching the spread row, worst at the bottom. */}
          {bids.map((l, i) => (
            <LadderRow
              key={`b-${l.price}`}
              level={l}
              cum={bidCum[i]}
              maxCum={maxCum}
              side="bid"
            />
          ))}
        </div>
      )}
    </section>
  );
}
