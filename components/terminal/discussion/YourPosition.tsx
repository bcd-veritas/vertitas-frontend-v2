"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

import type { ApiOutcome, MarketResolution } from "@/lib/markets/types";
import { getMarketResolution } from "@/lib/markets/data";
import {
  cancelUserOrder,
  getUserMarketPositions,
  type UserMarketOrder,
  type UserMarketPosition,
} from "@/lib/profile/data";
import { centsLabel, sharesLabel } from "@/lib/markets/format";
import { ConfirmDialog } from "../../common/ConfirmDialog";
import { EmptyState, OutcomeChip, SectionLabel, SideBadge } from "./atoms";

/** Per-position dollar figures derived from the market's own outcome prices —
 *  never fabricated. Either leg can be unknown (no book price yet, or the
 *  position predates cost tracking), in which case the caller renders a dash
 *  rather than a number built on a guess. */
type PositionDerived = {
  outcomeIndex: number;
  shares: number;
  avgCost: number | null;
  mark: number | null;
};

function derivePosition(
  p: UserMarketPosition,
  outcomes: ApiOutcome[],
): PositionDerived {
  const outcome = outcomes.find((o) => o.index === p.outcomeIndex);
  return {
    outcomeIndex: p.outcomeIndex,
    shares: Number(p.shares) / 1e6,
    avgCost: p.averageCost != null ? Number(p.averageCost) / 1e6 : null,
    mark: outcome?.price != null ? Number(outcome.price) / 1e6 : null,
  };
}

/** The connected wallet's stake in THIS market: holdings per outcome + resting
 *  orders (cancellable), plus a resolution banner that only ever claims what
 *  the market itself has confirmed. Positions and orders are owned by the
 *  parent panel (shared with the tab bar's dot indicator); this component
 *  only fetches the market's resolution state. */
export function YourPosition({
  marketId,
  labelFor,
  positions,
  orders,
  onOrdersChange,
  onPositionsChange,
  outcomes,
}: {
  marketId: string;
  labelFor: (index: number) => string;
  positions: UserMarketPosition[] | null;
  orders: UserMarketOrder[] | null;
  onOrdersChange: (o: UserMarketOrder[]) => void;
  onPositionsChange: (p: UserMarketPosition[]) => void;
  outcomes: ApiOutcome[];
}) {
  const { address, isConnected } = useAccount();
  const [resolution, setResolution] = useState<MarketResolution | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [confirmOrder, setConfirmOrder] = useState<UserMarketOrder | null>(null);

  useEffect(() => {
    let alive = true;
    getMarketResolution(marketId).then((r) => alive && setResolution(r));
    return () => {
      alive = false;
    };
  }, [marketId]);

  async function handleCancel(id: string) {
    if (!address) return;
    setCancelling(id);
    const ok = await cancelUserOrder(id, address);
    setCancelling(null);
    setConfirmOrder(null);
    if (!ok) return;
    onOrdersChange(orders ? orders.filter((o) => o.id !== id) : []);
    // Cancelling an ASK returns shares to the position — refresh holdings.
    // A failed refetch (null) leaves the last-known holdings on screen rather
    // than wiping them, matching onPositionsChange's non-null contract.
    getUserMarketPositions(address, marketId).then((p) => {
      if (p) onPositionsChange(p);
    });
  }

  if (!isConnected || !address)
    return <EmptyState text="connect wallet to see your position" />;
  if (positions === null || orders === null)
    return <EmptyState text="loading…" />;

  const r = resolution?.resolution ?? null;
  const winningOutcome = r?.winningOutcome ?? null;
  // Settled means the MARKET says so — never merely that an outcome was named.
  const settled = resolution?.status === "RESOLVED" && r?.resolvedAt != null;
  const proposed = !settled && r?.proposedAt != null && winningOutcome != null;

  return (
    <div>
      {settled && winningOutcome != null && (
        <div className="mt-3 flex items-center gap-2 border border-line/70 bg-fg/[0.02] px-3 py-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            resolved
          </span>
          <OutcomeChip label={labelFor(winningOutcome)} />
          <span className="font-mono text-[11px] text-fg/60">won</span>
        </div>
      )}

      {proposed && winningOutcome != null && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border border-amber-400/35 bg-amber-400/[0.06] px-3 py-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-300">
            proposed
          </span>
          <OutcomeChip label={labelFor(winningOutcome)} />
          {r?.disputed && (
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-no">
              disputed
            </span>
          )}
          <span className="font-mono text-[11px] text-fg/70">
            {r?.disputeResolved
              ? "dispute resolved \u00B7 awaiting final settlement"
              : "under review"}{" "}
            &mdash; nothing has paid out
          </span>
        </div>
      )}

      {positions.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(() => {
            const derived = positions.map((p) => derivePosition(p, outcomes));
            const totalShares = derived.reduce((s, d) => s + d.shares, 0);
            const allCostKnown = derived.every((d) => d.avgCost != null);
            const allMarkKnown = derived.every((d) => d.mark != null);
            const totalCost = allCostKnown
              ? derived.reduce((s, d) => s + d.shares * (d.avgCost ?? 0), 0)
              : null;
            const totalValue = allMarkKnown
              ? derived.reduce((s, d) => s + d.shares * (d.mark ?? 0), 0)
              : null;
            const unrealized =
              totalCost != null && totalValue != null
                ? totalValue - totalCost
                : null;

            const cells = [
              [
                "your shares",
                Math.round(totalShares).toLocaleString("en-US"),
                "",
              ],
              [
                "avg cost",
                totalCost != null && totalShares > 0
                  ? `${Math.round((totalCost / totalShares) * 100)}\u00A2`
                  : "\u2014",
                "",
              ],
              [
                "value now",
                totalValue != null ? `$${totalValue.toFixed(2)}` : "\u2014",
                "",
              ],
              [
                "unrealized",
                unrealized != null
                  ? `${unrealized >= 0 ? "+" : "\u2212"}$${Math.abs(unrealized).toFixed(2)}`
                  : "\u2014",
                unrealized != null
                  ? unrealized >= 0
                    ? "text-yes"
                    : "text-no"
                  : "",
              ],
            ] as const;

            return cells.map(([k, v, tone]) => (
              <div key={k} className="border border-line px-3 py-2">
                <span className="font-mono text-[10px] tracking-[0.18em] text-muted/70 uppercase">
                  {k}
                </span>
                <p
                  className={`mt-1 font-mono text-base font-semibold tabular-nums ${tone}`}
                >
                  {v}
                </p>
              </div>
            ));
          })()}
        </div>
      )}

      <SectionLabel>Holdings</SectionLabel>
      {positions.length === 0 ? (
        <EmptyState
          text={
            settled
              ? "settled — winnings paid to your balance"
              : "no shares in this market"
          }
        />
      ) : (
        <div className="divide-y divide-line/50">
          {positions.map((p) => {
            const won = settled && p.outcomeIndex === winningOutcome;
            return (
              <div key={p.outcomeIndex} className="flex items-center gap-3 py-3">
                <OutcomeChip label={labelFor(p.outcomeIndex)} />
                <div className="min-w-0 flex-1" />
                {won && (
                  <span className="font-mono text-[11px] tabular-nums text-yes shrink-0">
                    won ${(Number(p.shares) / 1e6).toFixed(2)}
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
                onClick={() => setConfirmOrder(o)}
                disabled={cancelling === o.id}
                className="font-mono text-[10px] uppercase tracking-[0.1em] text-no/80 hover:text-no disabled:opacity-40 transition-colors shrink-0"
              >
                {cancelling === o.id ? "…" : "cancel"}
              </button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmOrder !== null}
        busy={confirmOrder !== null && cancelling === confirmOrder.id}
        title="Cancel order?"
        confirmLabel="Cancel order"
        cancelLabel="Keep order"
        busyLabel="Cancelling…"
        onClose={() => {
          if (!cancelling) setConfirmOrder(null);
        }}
        onConfirm={() => confirmOrder && handleCancel(confirmOrder.id)}
        message={
          confirmOrder && (
            <>
              <span
                className={confirmOrder.side === "BID" ? "text-yes" : "text-no"}
              >
                {confirmOrder.side === "BID" ? "BUY" : "SELL"}
              </span>{" "}
              <span className="tabular-nums text-fg">
                {sharesLabel(confirmOrder.remaining)}
              </span>{" "}
              sh @{" "}
              <span className="tabular-nums text-fg">
                {centsLabel(confirmOrder.price)}
              </span>{" "}
              · {labelFor(confirmOrder.outcomeIndex)}
              <br />
              <br />
              This removes the resting order and returns any locked funds to your
              available balance.
            </>
          )
        }
      />
    </div>
  );
}
