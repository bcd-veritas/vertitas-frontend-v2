"use client";

import { useEffect, useState } from "react";
import type { FeaturedComment, MarketHolder, MarketTrade } from "@/lib/markets/types";
import { getMarketComments, getMarketTrades, getTopHolders } from "@/lib/markets/data";
import { centsLabel, sharesLabel } from "@/lib/markets/format";
import { PixelLabel } from "../PixelLabel";

/** First 6 + last 4 chars, e.g. "0x7f3a…9c21" — used whenever a holder has no
 *  username on file. */
function shortenWallet(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** ISO -> "2h ago" / "3d ago" / "just now". Coarse on purpose — this is a
 *  glance-only readout, not a precise timestamp. */
function relativeAge(iso: string, now: number = Date.now()): string {
  const ms = now - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** A single `label · dotted leader · value` row, matching the leader idiom
 *  used by MarketCard's OutcomeRow. */
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline">
      <PixelLabel className="shrink-0">{label}</PixelLabel>
      <span
        className="flex-1 border-b border-dotted border-line -translate-y-[3px]"
        aria-hidden="true"
      />
      <span className="font-terminal text-[13px] tabular-nums text-fg/85">{value}</span>
    </div>
  );
}

type State = {
  trades: MarketTrade[];
  holders: { items: MarketHolder[]; total: number };
  comments: FeaturedComment[];
  loaded: boolean;
};

const EMPTY: State = {
  trades: [],
  holders: { items: [], total: 0 },
  comments: [],
  loaded: false,
};

/** Supplementary detail column for the board's wide anchor card — only one
 *  instance ever mounts per board, so no need to batch these three requests. */
export function AnchorDetail({ marketId }: { marketId: string }) {
  const [state, setState] = useState<State>(EMPTY);

  useEffect(() => {
    // No synchronous reset here: `marketId` only ever changes via a full
    // remount (SplitCard keys on market.id), so state already starts at
    // EMPTY for a new id — resetting again would be a same-tick setState.
    let alive = true;
    Promise.all([
      getMarketTrades(marketId, 1),
      getTopHolders(marketId, 1, 1),
      getMarketComments(marketId),
    ]).then(([trades, holders, comments]) => {
      if (!alive) return;
      setState({ trades, holders, comments, loaded: true });
    });
    return () => {
      alive = false;
    };
  }, [marketId]);

  // Relative age needs Date.now(), so it fills in after mount rather than
  // during render — deferred via setTimeout(…, 0), the same idiom SplitCard's
  // countdown uses, so this isn't a synchronous setState inside the effect.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setNow(Date.now()), 0);
    return () => clearTimeout(t);
  }, []);

  const { trades, holders, comments, loaded } = state;

  const lastTrade = trades[0]
    ? `${centsLabel(trades[0].price)} × ${sharesLabel(trades[0].quantity)}`
    : "—";

  const holdersLabel = loaded ? holders.total.toLocaleString("en-US") : "—";

  const topHolder = holders.items[0];
  const topHolderLabel = topHolder
    ? (topHolder.user?.username ?? shortenWallet(topHolder.walletAddress))
    : "—";

  // Newest comment by createdAt, not assumed API order.
  const latestComment = comments.reduce<FeaturedComment | null>((latest, c) => {
    if (!latest) return c;
    return new Date(c.createdAt).getTime() > new Date(latest.createdAt).getTime()
      ? c
      : latest;
  }, null);

  const latestLabel =
    latestComment && now != null ? relativeAge(latestComment.createdAt, now) : "—";

  return (
    <div className="flex flex-col gap-3.5 p-5">
      <PixelLabel className="text-fg/45!">activity</PixelLabel>
      <div className="flex flex-col gap-2">
        <DetailRow label="last trade" value={lastTrade} />
        <DetailRow label="holders" value={holdersLabel} />
        <DetailRow label="top holder" value={topHolderLabel} />
        <DetailRow label="latest" value={latestLabel} />
      </div>

      {latestComment && (
        <>
          <PixelLabel className="text-fg/45!">latest comment</PixelLabel>
          <div className="flex flex-col gap-1.5">
            <p className="font-terminal text-[13px] leading-relaxed text-fg/60 line-clamp-3 border-l-2 border-line pl-2.5">
              {latestComment.content}
            </p>
            <PixelLabel className="text-fg/40!">
              {`${latestComment.user?.username ?? "anon"} // ${latestLabel}`}
            </PixelLabel>
          </div>
        </>
      )}
    </div>
  );
}
