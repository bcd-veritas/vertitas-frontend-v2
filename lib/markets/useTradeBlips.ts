"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import type { ApiOutcome } from "./types";
import { getMarketTrades } from "./data";

export type TradeBlip = {
  /** Trade id — stable key for the overlay. */
  id: string;
  label: string;
  /** Binary convention: Yes prints push probability up (+), No prints push
   *  it down (−). Non-binary outcomes always read as +. */
  sign: "+" | "−";
  qty: string;
  priceCents: number;
  outcomeIndex: number;
  /** Set when the connected wallet was a party to the fill. */
  mine: "bid" | "ask" | null;
};

const KEEP = 8; // live blips retained; overlay evicts the oldest visually
const SEEN_CAP = 200;

const fmtQty = (raw: string): string => {
  const shares = Number(raw) / 1e8;
  return Number.isInteger(shares) ? String(shares) : shares.toFixed(1);
};

/**
 * Live trade tape for the blip overlay. The realtime layer is identifier-only
 * ("activity happened"), so quantities come from re-pulling the recent-trades
 * feed on each activity tick and diffing by trade id. The first fetch (and
 * any fetch after a marketId change) only SEEDS the seen-set — page load and
 * reconnect catch-up must not replay the whole recent tape as fireworks.
 */
export function useTradeBlips(
  marketId: string,
  outcomes: ApiOutcome[],
  feedNonce: number,
): TradeBlip[] {
  const { address } = useAccount();
  const [blips, setBlips] = useState<TradeBlip[]>([]);
  // Seen-set is keyed to its market: a marketId change silently re-seeds
  // (and clears the tape) inside the next fetch — no reset effect needed.
  const seenRef = useRef<{ mkt: string; ids: Set<string> } | null>(null);
  const outcomesRef = useRef(outcomes);
  const walletRef = useRef(address);
  useEffect(() => {
    outcomesRef.current = outcomes;
    walletRef.current = address;
  });

  useEffect(() => {
    let alive = true;
    getMarketTrades(marketId, 20).then((trades) => {
      if (!alive) return;
      const seeding = seenRef.current?.mkt !== marketId;
      if (seeding) {
        seenRef.current = { mkt: marketId, ids: new Set() };
        setBlips((prev) => (prev.length > 0 ? [] : prev));
      }
      const seen = seenRef.current!.ids;
      const fresh = trades.filter((t) => !seen.has(t.id));
      for (const t of fresh) seen.add(t.id);
      if (seen.size > SEEN_CAP) {
        // Trim oldest insertions; Set iterates in insertion order.
        const drop = seen.size - SEEN_CAP;
        let i = 0;
        for (const id of seen) {
          if (i++ >= drop) break;
          seen.delete(id);
        }
      }
      if (seeding || fresh.length === 0) return;

      const binary = outcomesRef.current.length === 2;
      const me = walletRef.current?.toLowerCase() ?? null;
      const next = fresh
        .slice()
        .reverse() // feed is newest-first; blips stack oldest-first
        .map((t): TradeBlip => {
          const label =
            outcomesRef.current.find((o) => o.index === t.outcomeIndex)
              ?.label ?? `#${t.outcomeIndex}`;
          const mine =
            me == null
              ? null
              : t.buyerWallet.toLowerCase() === me
                ? "bid"
                : t.sellerWallet.toLowerCase() === me
                  ? "ask"
                  : null;
          return {
            id: t.id,
            label,
            sign: binary && label.toLowerCase() === "no" ? "−" : "+",
            qty: fmtQty(t.quantity),
            priceCents: Math.round(Number(t.price) / 1e6),
            outcomeIndex: t.outcomeIndex,
            mine,
          };
        });
      setBlips((prev) => [...prev, ...next].slice(-KEEP));
    });
    return () => {
      alive = false;
    };
  }, [marketId, feedNonce]);

  return blips;
}
