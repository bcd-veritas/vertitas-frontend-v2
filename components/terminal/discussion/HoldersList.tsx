import type { MarketHolder } from "@/lib/markets/types";
import { centsLabel, sharesLabel } from "@/lib/markets/format";
import { Avatar, EmptyState, OutcomeChip, walletShort } from "./atoms";

export function HoldersList({
  holders,
  labelFor,
}: {
  holders: MarketHolder[] | null;
  labelFor: (index: number) => string;
}) {
  if (holders === null) return <EmptyState text="loading…" />;
  if (holders.length === 0) return <EmptyState text="no holders yet" />;
  return (
    <div className="divide-y divide-line/50">
      {holders.map((h) => {
        const name = h.user?.username ?? "anon";
        const shares = (
          BigInt(h.availableAmount) + BigInt(h.lockedAmount)
        ).toString();
        return (
          <div key={h.id} className="flex items-center gap-3 py-3">
            <Avatar name={name} />
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[11px] text-fg/85 truncate">
                {name}
                <span className="mx-1.5 text-muted">·</span>
                <span className="text-muted">{walletShort(h.walletAddress)}</span>
              </p>
              <p className="font-mono text-[11px] text-muted mt-0.5">
                avg cost{" "}
                <span className="tabular-nums text-fg/70">
                  {h.averageCost != null ? centsLabel(h.averageCost) : "—"}
                </span>
              </p>
            </div>
            <OutcomeChip label={labelFor(h.outcomeIndex)} />
            <span className="font-mono text-sm tabular-nums text-fg/85 shrink-0">
              {sharesLabel(shares)}
              <span className="text-muted text-[10px] uppercase ml-1">sh</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
