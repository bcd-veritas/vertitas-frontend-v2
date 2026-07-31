"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ActivityRow, OpenOrderRow, PositionRow } from "@/lib/profile/mock";
import { ConfirmDialog } from "../common/ConfirmDialog";

type Tab = "positions" | "orders" | "history";

/** Rows shown per page in each portfolio tab. */
const PORTFOLIO_PAGE_SIZE = 10;

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** Fixed UTC stamp ("JUL 4 14:03") — no relative times, hydration-safe. */
function utcStamp(t: number): string {
  const d = new Date(t);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()} ${hh}:${mm}`;
}

/** Signed USD, e.g. "+$12.40" / "−$3.10". */
function signedUsd(usd: number): string {
  return `${usd >= 0 ? "+" : "−"}$${Math.abs(usd).toFixed(2)}`;
}

/** Shares are fixed-point and often fractional. Whole holdings stay clean;
 *  fractional ones show enough to explain a value that looks a cent off. */
function fmtShares(n: number): string {
  return Number.isInteger(n)
    ? n.toLocaleString("en-US")
    : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

/** Same for prices — 77.5862¢ is a real mark, and rounding it to 78¢ for
 *  display is fine, but only after the arithmetic is done. */
function fmtCents(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

/**
 * Portfolio — the wallet's whole book in one section: live holdings
 * (Positions), resting orders (Open Orders), and the completed-trade log
 * (History), toggled like the market page's timeframe tabs. Each row carries
 * the market it belongs to. Mock data this round (UI-first).
 */
export function PortfolioTable({
  positions,
  openOrders,
  history,
  historyTotal,
  onCancelOrder,
}: {
  positions: PositionRow[];
  openOrders: OpenOrderRow[];
  history: ActivityRow[];
  /** The wallet's TOTAL completed trades. `history` is only the fetched slice,
   *  so without this the tab silently stopped at 50 and looked complete. */
  historyTotal?: number;
  /** Cancel a resting order by id; resolves true on success. */
  onCancelOrder?: (orderId: string) => Promise<boolean>;
}) {
  const [tab, setTab] = useState<Tab>("positions");

  // One page index shared across tabs, reset to the first page on tab switch so
  // you never land on an out-of-range page when moving to a shorter tab.
  const [page, setPage] = useState(1);
  const [prevTab, setPrevTab] = useState(tab);
  if (tab !== prevTab) {
    setPrevTab(tab);
    setPage(1);
  }

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "positions", label: "Positions", count: positions.length },
    { id: "orders", label: "Open Orders", count: openOrders.length },
    { id: "history", label: "History", count: historyTotal ?? history.length },
  ];

  // Page math off the active tab's length. `currentPage` clamps against a data
  // refetch shrinking the list under a page the user had advanced to.
  const activeCount =
    tab === "positions"
      ? positions.length
      : tab === "orders"
        ? openOrders.length
        : history.length;
  const totalPages = Math.max(1, Math.ceil(activeCount / PORTFOLIO_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PORTFOLIO_PAGE_SIZE;
  const end = start + PORTFOLIO_PAGE_SIZE;

  return (
    <section className="relative border-b border-line" aria-label="Portfolio">
      <div className="flex flex-wrap items-end justify-between gap-2 px-3 sm:px-4 pt-10 pb-4">
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-fg uppercase">
          Portfolio
        </h2>
      </div>

      {/* Positions / Open Orders / History toggle */}
      <div role="tablist" aria-label="Portfolio view" className="flex flex-wrap items-center gap-1 px-3 sm:px-4 pb-4">
        {tabs.map(({ id, label, count }) => {
          const on = tab === id;
          return (
            <button
              key={id}
              role="tab"
              aria-selected={on}
              onClick={() => setTab(id)}
              className={`px-3 py-1.5 rounded font-mono text-[11px] uppercase tracking-[0.14em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${on ? "text-fg bg-fg/5" : "text-muted hover:text-fg/80"
                }`}
            >
              {label} <span className="tabular-nums opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      {tab === "positions" && <PositionsTable rows={positions.slice(start, end)} />}
      {tab === "orders" && (
        <OrdersTable rows={openOrders.slice(start, end)} onCancel={onCancelOrder} />
      )}
      {tab === "history" && (
        <>
          <HistoryTable rows={history.slice(start, end)} />
          {historyTotal != null && historyTotal > history.length && (
            <p className="px-5 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted/70">
              showing the {history.length} most recent of {historyTotal} trades
            </p>
          )}
        </>
      )}

      {/* Prev / next — only when the active tab spans more than one page. */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 py-5">
          <button
            type="button"
            onClick={() => setPage(currentPage - 1)}
            disabled={currentPage <= 1}
            aria-label="Previous page"
            className="pill pill-ghost p-1.5! disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted tabular-nums">
            page {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
            aria-label="Next page"
            className="pill pill-ghost p-1.5! disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      )}
    </section>
  );
}

function PositionsTable({ rows }: { rows: PositionRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="py-10 text-center font-mono text-[11px] uppercase tracking-[0.24em] text-muted/70">
        no open positions
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-t border-line/50">
        <thead>
          <tr className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted/60">
            <th className="font-normal px-5 py-2">market</th>
            <th className="font-normal px-3 py-2">outcome</th>
            <th className="font-normal px-3 py-2 text-right">shares</th>
            <th className="font-normal px-3 py-2 text-right">avg</th>
            <th className="font-normal px-3 py-2 text-right">cur</th>
            <th className="font-normal px-3 py-2 text-right">value</th>
            <th className="font-normal px-5 py-2 text-right">pnl</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line/50 border-t border-line/50">
          {rows.map((r) => {
            // A closed book awaiting the oracle has no price anyone can trade
            // at — the API falls back to the position's own average cost, which
            // would render as a confident value and an exact $0.00 PnL. Show
            // the holding and withhold the numbers instead.
            const priced = r.status === "ACTIVE" || r.status === "RESOLVED";
            const value = r.valueCents / 100;
            const pnl =
              r.avgCostCents == null ? null : (r.shares * (r.curPriceCents - r.avgCostCents)) / 100;
            return (
              <tr key={r.id} className="text-sm">
                <td className="px-5 py-2.5 text-fg/90 max-w-60 truncate">
                  {r.market}
                  {r.claimable && (
                    <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.14em] text-yes">
                      redeem
                    </span>
                  )}
                  {r.status === "ENDED" && (
                    <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.14em] text-amber-300">
                      resolving
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-fg/70 whitespace-nowrap">{r.outcome}</td>
                <td className="px-3 py-2.5 font-mono text-[11px] tabular-nums text-right text-fg/75">
                  {fmtShares(r.shares)}
                  {r.lockedShares > 0 && (
                    <span className="text-muted/70" title="backing a resting order">
                      {" "}
                      ({fmtShares(r.lockedShares)} locked)
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 font-mono text-[11px] tabular-nums text-right text-fg/75">
                  {r.avgCostCents == null ? "—" : `${fmtCents(r.avgCostCents)}¢`}
                </td>
                <td className="px-3 py-2.5 font-mono text-[11px] tabular-nums text-right text-fg/75">
                  {priced ? `${fmtCents(r.curPriceCents)}¢` : "—"}
                </td>
                <td className="px-3 py-2.5 font-mono text-[11px] tabular-nums text-right text-fg/90 whitespace-nowrap">
                  {priced ? `$${value.toFixed(2)}` : "—"}
                </td>
                <td
                  className={`px-5 py-2.5 font-mono text-[11px] tabular-nums text-right whitespace-nowrap ${
                    !priced || pnl == null ? "text-muted/60" : pnl >= 0 ? "text-yes" : "text-no"
                  }`}
                >
                  {!priced || pnl == null ? "—" : signedUsd(pnl)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function OrdersTable({
  rows,
  onCancel,
}: {
  rows: OpenOrderRow[];
  onCancel?: (orderId: string) => Promise<boolean>;
}) {
  // Single-flight cancel: `cancelling` holds the in-progress order id (disables
  // its button), `failed` the id whose cancel errored (button offers a retry),
  // `confirmOrder` the row awaiting confirmation in the dialog.
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [confirmOrder, setConfirmOrder] = useState<OpenOrderRow | null>(null);

  async function runCancel(id: string) {
    if (!onCancel || cancelling) return;
    setCancelling(id);
    setFailed(null);
    const ok = await onCancel(id);
    // On success the row unmounts (parent drops it); either way close the
    // dialog and clear busy. Failure re-labels the button to "Retry".
    if (!ok) setFailed(id);
    setCancelling(null);
    setConfirmOrder(null);
  }

  if (rows.length === 0) {
    return (
      <p className="py-10 text-center font-mono text-[11px] uppercase tracking-[0.24em] text-muted/70">
        no open orders
      </p>
    );
  }
  return (
    <>
    <div className="overflow-x-auto">
      <table className="w-full text-left border-t border-line/50">
        <thead>
          <tr className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted/60">
            <th className="font-normal px-5 py-2">market</th>
            <th className="font-normal px-3 py-2">outcome</th>
            <th className="font-normal px-3 py-2">side</th>
            <th className="font-normal px-3 py-2 text-right">price</th>
            <th className="font-normal px-3 py-2 text-right">filled</th>
            <th className="font-normal px-3 py-2">status</th>
            <th className="font-normal px-5 py-2 text-right"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line/50 border-t border-line/50">
          {rows.map((r) => {
            const partial = r.filledShares > 0;
            return (
              <tr key={r.id} className="text-sm">
                <td className="px-5 py-2.5 text-fg/90 max-w-60 truncate">{r.market}</td>
                <td className="px-3 py-2.5 text-fg/70 whitespace-nowrap">{r.outcome}</td>
                <td
                  className={`px-3 py-2.5 font-mono text-[11px] tracking-widest ${r.side === "BUY" ? "text-yes" : "text-no"
                    }`}
                >
                  {r.side}
                </td>
                <td className="px-3 py-2.5 font-mono text-[11px] tabular-nums text-right text-fg/75">
                  {r.priceCents}¢
                </td>
                <td className="px-3 py-2.5 font-mono text-[11px] tabular-nums text-right text-fg/75 whitespace-nowrap">
                  {r.filledShares.toLocaleString("en-US")}/{r.shares.toLocaleString("en-US")}
                </td>
                <td className="px-3 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted whitespace-nowrap">
                  {partial ? "partial" : "open"}
                </td>
                <td className="px-5 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => setConfirmOrder(r)}
                    disabled={!onCancel || cancelling === r.id}
                    className="font-mono text-[10px] uppercase tracking-[0.14em] text-no hover:brightness-125 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {cancelling === r.id
                      ? "Cancelling…"
                      : failed === r.id
                        ? "Retry"
                        : "Cancel"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>

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
        onConfirm={() => confirmOrder && runCancel(confirmOrder.id)}
        message={
          confirmOrder && (
            <>
              <span
                className={confirmOrder.side === "BUY" ? "text-yes" : "text-no"}
              >
                {confirmOrder.side}
              </span>{" "}
              <span className="tabular-nums text-fg">
                {confirmOrder.shares.toLocaleString("en-US")}
              </span>{" "}
              sh @{" "}
              <span className="tabular-nums text-fg">
                {confirmOrder.priceCents}¢
              </span>
              <br />
              <span className="text-fg/80">{confirmOrder.market}</span> ·{" "}
              {confirmOrder.outcome}
              <br />
              <br />
              This removes the resting order and returns any locked funds to your
              available balance.
            </>
          )
        }
      />
    </>
  );
}

function HistoryTable({ rows }: { rows: ActivityRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="py-10 text-center font-mono text-[11px] uppercase tracking-[0.24em] text-muted/70">
        no history yet
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-t border-line/50">
        <thead>
          <tr className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted/60">
            <th className="font-normal px-5 py-2">time</th>
            <th className="font-normal px-3 py-2">action</th>
            <th className="font-normal px-3 py-2">market</th>
            <th className="font-normal px-3 py-2">outcome</th>
            <th className="font-normal px-3 py-2 text-right">shares</th>
            <th className="font-normal px-3 py-2 text-right">price</th>
            <th className="font-normal px-5 py-2 text-right">total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line/50 border-t border-line/50">
          {rows.map((r) => (
            <tr key={r.id} className="text-sm">
              <td className="px-5 py-2.5 font-mono text-[11px] text-muted whitespace-nowrap tabular-nums">
                {utcStamp(r.t)}
              </td>
              <td
                className={`px-3 py-2.5 font-mono text-[11px] tracking-widest ${r.action === "BOUGHT" ? "text-yes" : "text-no"
                  }`}
              >
                {r.action}
              </td>
              <td className="px-3 py-2.5 text-fg/90 max-w-60 truncate">{r.market}</td>
              <td className="px-3 py-2.5 text-fg/70 whitespace-nowrap">{r.outcome}</td>
              <td className="px-3 py-2.5 font-mono text-[11px] tabular-nums text-right text-fg/75">
                {r.shares.toLocaleString("en-US")}
              </td>
              <td className="px-3 py-2.5 font-mono text-[11px] tabular-nums text-right text-fg/75">
                {r.priceCents}¢
              </td>
              <td className="px-5 py-2.5 font-mono text-[11px] tabular-nums text-right text-fg/90 whitespace-nowrap">
                ${((r.shares * r.priceCents) / 100).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
