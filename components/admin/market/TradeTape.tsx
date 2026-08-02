'use client';

import { centsLabel, sharesLabel } from '@/lib/markets/format';
import type { MarketTrade } from '@/lib/markets/types';

function short(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function TradeTape({
  trades,
  outcomeLabels,
}: {
  trades: MarketTrade[];
  outcomeLabels: Record<number, string>;
}) {
  if (trades.length === 0) {
    return <p className="font-mono text-xs text-muted">No trades yet.</p>;
  }

  return (
    <div className="w-full">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 z-10 bg-surface font-mono text-[10px] uppercase tracking-wider text-muted">
          <tr>
            <th className="pb-2 pr-2 font-normal">Time</th>
            <th className="px-2 font-normal">Outcome</th>
            <th className="px-2 text-right font-normal">Price</th>
            <th className="px-2 text-right font-normal">Size</th>
            <th className="pl-2 text-right font-normal">Buyer → Seller</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => (
            <tr
              key={t.id}
              className="border-t border-line/60 hover:bg-fg/5 transition-colors"
            >
              <td className="py-1.5 pr-2 font-mono text-[11px] text-muted">
                {timeAgo(t.createdAt)}
              </td>
              <td className="px-2 font-mono text-[10px] uppercase tracking-wider text-fg/80">
                {outcomeLabels[t.outcomeIndex] ?? `#${t.outcomeIndex}`}
              </td>
              <td className="px-2 text-right font-mono text-xs tabular-nums text-fg/80">
                {centsLabel(t.price)}
              </td>
              <td className="px-2 text-right font-mono text-xs tabular-nums text-muted">
                {sharesLabel(t.quantity)}
              </td>
              <td className="pl-2 text-right font-mono text-[10px] text-muted">
                {short(t.buyerWallet)} → {short(t.sellerWallet)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
