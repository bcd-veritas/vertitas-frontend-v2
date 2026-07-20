import type { MarketTrade } from "@/lib/markets/types";
import { centsLabel, sharesLabel } from "@/lib/markets/format";
import { EmptyState, OutcomeChip, shortDate, walletShort } from "./atoms";

export function ActivityList({
  trades,
  labelFor,
}: {
  trades: MarketTrade[] | null;
  labelFor: (index: number) => string;
}) {
  if (trades === null) return <EmptyState text="loading…" />;
  if (trades.length === 0) return <EmptyState text="no trades yet" />;
  return (
    <div className="divide-y divide-line/50">
      {trades.map((t) => (
        <div key={t.id} className="flex items-center gap-3 py-3">
          <OutcomeChip label={labelFor(t.outcomeIndex)} />
          <p className="font-mono text-[11px] text-muted min-w-0 flex-1 truncate">
            <span className="tabular-nums text-fg/85">
              {sharesLabel(t.quantity)}
            </span>{" "}
            sh @{" "}
            <span className="tabular-nums text-fg/85">{centsLabel(t.price)}</span>
            <span className="mx-1.5">·</span>
            {walletShort(t.buyerWallet)}
            <span className="mx-1 text-muted/60">←</span>
            {walletShort(t.sellerWallet)}
          </p>
          <span className="font-mono text-[11px] text-muted shrink-0">
            {shortDate(t.createdAt)}
          </span>
        </div>
      ))}
    </div>
  );
}
