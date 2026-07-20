"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { useAccount } from "wagmi";
import type { ApiMarket, MarketResolution, MarketTrade } from "@/lib/markets/types";
import { getMarketResolution, getMarketTrades } from "@/lib/markets/data";
import { Frame } from "./Frame";

/** Net winning-outcome shares from the wallet's trades — positions are
 *  zeroed by settlement, so trade history is the durable source. */
function wonDollars(
  trades: MarketTrade[],
  wallet: string,
  winningOutcome: number,
): number {
  const w = wallet.toLowerCase();
  let shares = 0;
  for (const t of trades) {
    if (t.outcomeIndex !== winningOutcome) continue;
    const qty = Number(t.quantity) / 1e8;
    if (t.buyerWallet.toLowerCase() === w) shares += qty;
    if (t.sellerWallet.toLowerCase() === w) shares -= qty;
  }
  return Math.max(0, shares); // $1/share
}

/**
 * Occupies the trade-ticket slot once a market is no longer ACTIVE: a
 * "determining winner" holding state while the outcome lands on-chain, then
 * the settled outcome + the connected wallet's winnings. Replaces the ticket
 * rather than hiding it, so the rail always shows the market's current action
 * — and this is where UMA propose/dispute/vote controls will live too.
 */
export function ResolutionPanel({ market }: { market: ApiMarket }) {
  const { address } = useAccount();
  const [data, setData] = useState<MarketResolution | null>(null);
  const [won, setWon] = useState<number | null>(null);

  // Poll while pending; harmless once RESOLVED (payload stops changing).
  useEffect(() => {
    if (market.status === "ACTIVE") return;
    let alive = true;
    const load = () =>
      getMarketResolution(market.id).then((d) => alive && setData(d));
    load();
    const timer = setInterval(load, 15_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [market.id, market.status]);

  const winning = data?.resolution?.winningOutcome ?? null;

  useEffect(() => {
    let alive = true;
    if (winning == null || !address) {
      // Deferred setState (not a direct effect-body call) per the project's
      // set-state-in-effect lint rule — mirrors TradePanel's clock pattern.
      Promise.resolve().then(() => alive && setWon(null));
      return () => {
        alive = false;
      };
    }
    getMarketTrades(market.id, 100, address).then((trades) => {
      if (!alive) return;
      setWon(wonDollars(trades, address, winning));
    });
    return () => {
      alive = false;
    };
  }, [market.id, address, winning]);

  if (market.status === "ACTIVE") return null;

  if (market.status === "CANCELLED") {
    return (
      <Frame label="Resolution" ariaLabel="Resolution">
        <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
          <p className="font-pixel text-lg uppercase tracking-wide text-fg">
            market cancelled
          </p>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            {market.title}
          </p>
        </div>
      </Frame>
    );
  }

  const resolved = data?.status === "RESOLVED" && data.resolution?.winningLabel;
  const label = data?.resolution?.winningLabel ?? "";
  const l = label.trim().toLowerCase();
  const tint =
    l === "yes"
      ? "var(--color-yes)"
      : l === "no"
        ? "var(--color-no)"
        : "var(--color-accent)";

  // Ended, awaiting the on-chain outcome (≤ ~one sweep).
  if (!resolved) {
    return (
      <Frame label="Resolution" ariaLabel="Resolution">
        <div className="flex flex-col items-center gap-4 px-6 py-10 text-center">
          <Loader2
            aria-hidden="true"
            className="h-8 w-8 animate-spin text-accent"
            strokeWidth={1.5}
          />
          <div className="flex flex-col gap-1">
            <p className="font-pixel text-lg uppercase tracking-wide text-fg">
              determining winner
            </p>
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
              {market.title}
            </p>
          </div>
          <p className="max-w-[32ch] font-mono text-[11px] leading-relaxed text-muted/70">
            This market has ended. The final outcome appears automatically once
            it settles on-chain.
          </p>
        </div>
      </Frame>
    );
  }

  // Resolved — flood the frame with the outcome tint.
  return (
    <Frame label="Resolution" ariaLabel="Resolution" accent={tint} tickColor={tint}>
      <div className="flex flex-col items-center gap-3 px-6 py-9 text-center">
        <span
          aria-hidden="true"
          className="flex h-12 w-12 items-center justify-center rounded-full"
          style={{ background: tint }}
        >
          <Check
            className="h-6 w-6"
            strokeWidth={3}
            style={{ color: "var(--color-bg)" }}
          />
        </span>
        <div className="flex flex-col gap-0.5">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">
            outcome
          </p>
          <p
            className="font-pixel text-2xl uppercase tracking-wide"
            style={{ color: tint }}
          >
            {label}
          </p>
        </div>
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
          {market.title}
        </p>

        {won != null && won > 0 && (
          <div className="mt-2 w-full border-t border-line/50 pt-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
              you won
            </p>
            <p className="font-mono text-3xl tabular-nums text-fg">
              ${won.toFixed(2)}
            </p>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted/60">
              credited to your balance
            </p>
          </div>
        )}
      </div>
    </Frame>
  );
}
