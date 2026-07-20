"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

import type { MarketResolution } from "@/lib/markets/types";
import { getMarketResolution } from "@/lib/markets/data";
import {
  cancelUserOrder,
  getUserMarketOpenOrders,
  getUserMarketPositions,
  type UserMarketOrder,
  type UserMarketPosition,
} from "@/lib/profile/data";
import { centsLabel, sharesLabel } from "@/lib/markets/format";
import { useUserRoom } from "@/lib/realtime/hooks";
import { EmptyState, OutcomeChip, SectionLabel, SideBadge } from "./atoms";

/** The connected wallet's stake in THIS market: holdings per outcome + resting
 *  orders (cancellable), plus a resolved banner with winnings. Self-contained —
 *  owns its fetches so the parent stays a thin tab switcher. */
export function YourPosition({
  marketId,
  labelFor,
}: {
  marketId: string;
  labelFor: (index: number) => string;
}) {
  const { address, isConnected } = useAccount();
  const [positions, setPositions] = useState<UserMarketPosition[] | null>(null);
  const [orders, setOrders] = useState<UserMarketOrder[] | null>(null);
  const [resolution, setResolution] = useState<MarketResolution | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!address) {
      Promise.resolve().then(() => {
        if (!alive) return;
        setPositions(null);
        setOrders(null);
      });
      return () => {
        alive = false;
      };
    }
    getUserMarketPositions(address, marketId).then(
      (p) => alive && setPositions(p),
    );
    getUserMarketOpenOrders(address, marketId).then(
      (o) => alive && setOrders(o),
    );
    getMarketResolution(marketId).then((r) => alive && setResolution(r));
    return () => {
      alive = false;
    };
  }, [address, marketId]);

  // Live refresh: fills, cancels, expiry, and settlement all signal the
  // wallet's user room — re-pull holdings and resting orders when they land.
  useUserRoom(isConnected ? address : null, () => {
    if (!address) return;
    getUserMarketPositions(address, marketId).then(setPositions);
    getUserMarketOpenOrders(address, marketId).then(setOrders);
  });

  async function handleCancel(id: string) {
    if (!address) return;
    setCancelling(id);
    const ok = await cancelUserOrder(id, address);
    setCancelling(null);
    if (!ok) return;
    setOrders((prev) => (prev ? prev.filter((o) => o.id !== id) : prev));
    // Cancelling an ASK returns shares to the position — refresh holdings.
    getUserMarketPositions(address, marketId).then(setPositions);
  }

  if (!isConnected || !address)
    return <EmptyState text="connect wallet to see your position" />;
  if (positions === null || orders === null)
    return <EmptyState text="loading…" />;

  const winningOutcome = resolution?.resolution?.winningOutcome ?? null;
  const resolved = winningOutcome !== null;

  return (
    <div>
      {resolved && (
        <div className="mt-3 flex items-center gap-2 border border-line/70 bg-fg/[0.02] px-3 py-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            resolved
          </span>
          <OutcomeChip label={labelFor(winningOutcome)} />
          <span className="font-mono text-[11px] text-fg/60">won</span>
        </div>
      )}

      <SectionLabel>Holdings</SectionLabel>
      {positions.length === 0 ? (
        <EmptyState
          text={
            resolved
              ? "settled — winnings paid to your balance"
              : "no shares in this market"
          }
        />
      ) : (
        <div className="divide-y divide-line/50">
          {positions.map((p) => {
            const won = resolved && p.outcomeIndex === winningOutcome;
            return (
              <div key={p.outcomeIndex} className="flex items-center gap-3 py-3">
                <OutcomeChip label={labelFor(p.outcomeIndex)} />
                <div className="min-w-0 flex-1" />
                {won && (
                  <span className="font-mono text-[11px] tabular-nums text-yes shrink-0">
                    won ${(Number(p.shares) / 1e8).toFixed(2)}
                  </span>
                )}
                <span className="font-mono text-sm tabular-nums text-fg/85 shrink-0">
                  {sharesLabel(p.shares)}
                  <span className="text-muted text-[10px] uppercase ml-1">sh</span>
                </span>
              </div>
            );
          })}
        </div>
      )}

      <SectionLabel>Open Orders</SectionLabel>
      {orders.length === 0 ? (
        <EmptyState text="no open orders" />
      ) : (
        <div className="divide-y divide-line/50">
          {orders.map((o) => (
            <div key={o.id} className="flex items-center gap-3 py-3">
              <SideBadge side={o.side} />
              <OutcomeChip label={labelFor(o.outcomeIndex)} />
              <p className="font-mono text-[11px] text-muted min-w-0 flex-1 truncate">
                <span className="tabular-nums text-fg/85">
                  {sharesLabel(o.remaining)}
                </span>{" "}
                sh @{" "}
                <span className="tabular-nums text-fg/85">
                  {centsLabel(o.price)}
                </span>
              </p>
              <button
                type="button"
                onClick={() => handleCancel(o.id)}
                disabled={cancelling === o.id}
                className="font-mono text-[10px] uppercase tracking-[0.1em] text-no/80 hover:text-no disabled:opacity-40 transition-colors shrink-0"
              >
                {cancelling === o.id ? "…" : "cancel"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
