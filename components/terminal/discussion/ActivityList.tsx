"use client";

import { useState } from "react";
import type { MarketTrade } from "@/lib/markets/types";
import { getMarketTradesPage } from "@/lib/markets/data";
import {
  DayHeader,
  EmptyState,
  OutcomeChip,
  ProportionBar,
  shortDate,
  shortTime,
  toneForLabel,
  walletShort,
} from "./atoms";

const PAGE = 12;

export function ActivityList({
  marketId,
  trades,
  total,
  labelFor,
  onMore,
}: {
  marketId: string;
  trades: MarketTrade[] | null;
  total: number;
  labelFor: (index: number) => string;
  onMore: (t: MarketTrade[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  if (trades === null) return <EmptyState text="loading…" />;
  if (trades.length === 0) return <EmptyState text="no trades yet" />;

  // Notional, not share count: a 23-share fill at 48c and a 219-share fill at
  // 44c are wildly different trades and used to render identically.
  const usd = (t: MarketTrade) => (Number(t.quantity) / 1e8) * (Number(t.price) / 1e8);
  const max = Math.max(...trades.map(usd), 0.01);

  async function loadMore() {
    setBusy(true);
    const next = await getMarketTradesPage(marketId, Math.floor(trades!.length / PAGE) + 1, PAGE);
    setBusy(false);
    // A trade landing between pages can re-serve a row already on screen —
    // de-dupe by id so it doesn't produce a duplicate React key.
    const seen = new Set(trades!.map((t) => t.id));
    onMore([...trades!, ...next.items.filter((t) => !seen.has(t.id))]);
  }

  return (
    <div className="py-2">
      {trades.map((t, i) => {
        const day = shortDate(t.createdAt);
        const header = i === 0 || shortDate(trades[i - 1].createdAt) !== day;
        const label = labelFor(t.outcomeIndex);
        const tone = toneForLabel(label);
        const n = trades.filter((x) => shortDate(x.createdAt) === day).length;
        return (
          <div key={t.id}>
            {header && <DayHeader day={day} count={n} />}
            <div className="relative flex items-center gap-2.5 overflow-hidden border-b border-line/30 px-2 py-2">
              <ProportionBar pct={(usd(t) / max) * 100} tone={tone} />
              <span className="relative">
                <OutcomeChip label={label} />
              </span>
              <span className="relative min-w-[7rem] font-mono text-[12.5px] tabular-nums text-fg">
                {Math.round(Number(t.quantity) / 1e8).toLocaleString("en-US")}
                <span className="ml-0.5 text-[9px] text-muted">sh</span> @{" "}
                {Math.round(Number(t.price) / 1e6)}&cent;
              </span>
              <span className="relative min-w-[4.5rem] text-right font-mono text-[12.5px] tabular-nums text-fg/75">
                ${usd(t).toFixed(2)}
              </span>
              <span className="relative hidden min-w-0 flex-1 truncate text-right font-mono text-[10px] text-muted sm:block">
                {walletShort(t.buyerWallet)} &larr; {walletShort(t.sellerWallet)}
              </span>
              <span className="relative min-w-[3rem] text-right font-mono text-[10px] text-muted/70">
                {shortTime(t.createdAt)}
              </span>
            </div>
          </div>
        );
      })}

      {trades.length < total && (
        <button
          type="button"
          onClick={loadMore}
          disabled={busy}
          className="mt-2 w-full rounded border border-line px-3 py-2.5 font-mono text-[10px] tracking-[0.16em] text-muted uppercase transition-colors hover:bg-white/[0.03] hover:text-fg disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {busy
            ? "loading…"
            : `load more · showing ${trades.length} of ${total.toLocaleString("en-US")}`}
        </button>
      )}
    </div>
  );
}
