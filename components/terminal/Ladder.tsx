"use client";

import type { BookLevel, OrderBookData } from "@/lib/markets/types";
import { centsLabel, oneDp, sharesLabel, toCents } from "@/lib/markets/format";

const MAX_ROWS = 8;

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
    <div className="relative grid grid-cols-[56px_1fr_1fr] items-center gap-2 px-5 py-1.25 font-mono text-[11px] tabular-nums">
      <span
        aria-hidden="true"
        className={`absolute inset-y-0.75 right-0 ${color} opacity-[0.4] transition-[width] duration-500 ease-out`}
        style={{ ...HATCH, width: `${width}%` }}
      />
      <span className={color}>{centsLabel(level.price)}</span>
      <span className="relative text-right text-fg/75">{sharesLabel(level.quantity)}</span>
      <span className="relative text-right text-muted">{sharesLabel(cum.toString())}</span>
    </div>
  );
}

/** Pure CLOB ladder for one outcome token's aggregated book. */
export function Ladder({ book }: { book: OrderBookData }) {
  const bids = book.bids.slice(0, MAX_ROWS);
  const asks = book.asks.slice(0, MAX_ROWS);
  const bidCum = cumulative(bids);
  const askCum = cumulative(asks);
  const maxCum = [...bidCum, ...askCum].reduce((a, b) => (a > b ? a : b), 0n);

  const bestBid = bids[0] ? toCents(bids[0].price) : null;
  const bestAsk = asks[0] ? toCents(asks[0].price) : null;
  const spread =
    bestBid != null && bestAsk != null ? bestAsk - bestBid : null;
  const mid =
    bestBid != null && bestAsk != null ? (bestAsk + bestBid) / 2 : null;

  if (bids.length === 0 && asks.length === 0) {
    return (
      <p className="py-10 text-center font-mono text-[11px] uppercase tracking-[0.24em] text-muted/70">
        no open orders
      </p>
    );
  }

  return (
    <div className="pb-2">
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
      {asks.length > 0 && (
        <div className="flex justify-end mr-2 pt-1.5 pb-0.5">
          <span className="rounded-full bg-no/10 text-red-400 px-3 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em]">
            asks
          </span>
        </div>
      )}

      <div className="my-1 border-y border-line/60 px-5 py-1.5 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-muted tabular-nums">
        {spread != null ? `spread ${oneDp(spread)}¢ · mid ${oneDp(mid!)}¢` : "spread — · one-sided book"}
      </div>

      {/* Bids: best bid touching the spread row, worst at the bottom. */}
      {bids.length > 0 && (
        <div className="flex justify-end mr-2 pt-0.5 pb-1.5">
          <span className="rounded-full bg-yes/10 text-green-400 px-3 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em]">
            bids
          </span>
        </div>
      )}
      {bids.map((l, i) => (
        <LadderRow key={`b-${l.price}`} level={l} cum={bidCum[i]} maxCum={maxCum} side="bid" />
      ))}
    </div>
  );
}
