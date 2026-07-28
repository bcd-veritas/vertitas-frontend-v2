"use client";

import { useState } from "react";
import type { ActivityRow, OpenOrderRow, PositionRow } from "@/lib/profile/mock";

type Tab = "positions" | "orders" | "history";

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
}: {
  positions: PositionRow[];
  openOrders: OpenOrderRow[];
  history: ActivityRow[];
}) {
  const [tab, setTab] = useState<Tab>("positions");

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "positions", label: "Positions", count: positions.length },
    { id: "orders", label: "Open Orders", count: openOrders.length },
    { id: "history", label: "History", count: history.length },
  ];

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

      {tab === "positions" && <PositionsTable rows={positions} />}
      {tab === "orders" && <OrdersTable rows={openOrders} />}
      {tab === "history" && <HistoryTable rows={history} />}
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
            const value = (r.shares * r.curPriceCents) / 100;
            const pnl = (r.shares * (r.curPriceCents - r.avgCostCents)) / 100;
            return (
              <tr key={r.id} className="text-sm">
                <td className="px-5 py-2.5 text-fg/90 max-w-60 truncate">{r.market}</td>
                <td className="px-3 py-2.5 text-fg/70 whitespace-nowrap">{r.outcome}</td>
                <td className="px-3 py-2.5 font-mono text-[11px] tabular-nums text-right text-fg/75">
                  {r.shares.toLocaleString("en-US")}
                </td>
                <td className="px-3 py-2.5 font-mono text-[11px] tabular-nums text-right text-fg/75">
                  {r.avgCostCents}¢
                </td>
                <td className="px-3 py-2.5 font-mono text-[11px] tabular-nums text-right text-fg/75">
                  {r.curPriceCents}¢
                </td>
                <td className="px-3 py-2.5 font-mono text-[11px] tabular-nums text-right text-fg/90 whitespace-nowrap">
                  ${value.toFixed(2)}
                </td>
                <td
                  className={`px-5 py-2.5 font-mono text-[11px] tabular-nums text-right whitespace-nowrap ${pnl >= 0 ? "text-yes" : "text-no"
                    }`}
                >
                  {signedUsd(pnl)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function OrdersTable({ rows }: { rows: OpenOrderRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="py-10 text-center font-mono text-[11px] uppercase tracking-[0.24em] text-muted/70">
        no open orders
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
                    title="Coming soon"
                    className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted/60 hover:text-no transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded"
                  >
                    Cancel
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
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
