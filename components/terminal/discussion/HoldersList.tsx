"use client";

import { useAccount } from "wagmi";
import type { ApiOutcome, MarketHolder } from "@/lib/markets/types";
import { centsLabel } from "@/lib/markets/format";
import { Avatar, EmptyState, OutcomeChip, ProportionBar, toneForLabel, walletShort } from "./atoms";

const shares = (h: MarketHolder) =>
  Number(BigInt(h.availableAmount) + BigInt(h.lockedAmount)) / 1e6;

export function HoldersList({
  holders,
  outcomes,
  labelFor,
}: {
  holders: MarketHolder[] | null;
  outcomes: ApiOutcome[];
  labelFor: (index: number) => string;
}) {
  const { address } = useAccount();
  if (holders === null) return <EmptyState text="loading…" />;
  if (holders.length === 0) return <EmptyState text="no holders yet" />;

  const total = holders.reduce((s, h) => s + shares(h), 0);
  const rows = [...holders].sort((a, b) => shares(b) - shares(a));

  // Detect a true Yes/No pair (exactly two outcomes whose labels are "yes" and "no").
  // Binary markets keep fixed Yes-left / No-right order per the project convention.
  const isBinaryYesNo =
    outcomes.length === 2 &&
    outcomes.every((o) => {
      const l = o.label.trim().toLowerCase();
      return l === "yes" || l === "no";
    });

  // Always copy before sorting to avoid mutating the shared prop.
  // Binary Yes/No pair: Yes first, then No (fixed order).
  // Everything else: index ascending.
  const sortedOutcomes = [...outcomes].sort((a, b) => {
    if (isBinaryYesNo) {
      const aLabel = a.label.trim().toLowerCase();
      if (aLabel === "yes") return -1;
      if (b.label.trim().toLowerCase() === "yes") return 1;
    }
    return a.index - b.index;
  });

  // Build sides from the sorted outcome list.
  // Even if no holders exist for an outcome, it appears in the summary as "0 sh · 0 holders".
  const sides = sortedOutcomes.map((outcome) => {
    const label = outcome.label;
    const group = holders.filter((h) => h.outcomeIndex === outcome.index);
    return {
      label,
      tone: toneForLabel(label),
      sh: group.reduce((s, h) => s + shares(h), 0),
      n: group.length,
    };
  });

  return (
    <div className="py-2">
      <div className="mb-2 grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(9rem,1fr))]">
        {sides.map((s) => (
          <div key={s.label} className="border border-line px-3 py-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-[10px] tracking-[0.18em] text-muted/70 uppercase">
                {s.label}
              </span>
              <span className="font-mono text-[10px] tracking-[0.18em] text-muted/70 uppercase">
                {s.n} holder{s.n === 1 ? "" : "s"}
              </span>
            </div>
            <p
              className={`mt-1 font-mono text-lg font-semibold tabular-nums ${
                s.tone === "yes" ? "text-yes" : s.tone === "no" ? "text-no" : "text-fg/80"
              }`}
            >
              {Math.round(s.sh).toLocaleString("en-US")}
              <span className="ml-1 text-[9px] text-muted uppercase">sh</span>
            </p>
          </div>
        ))}
      </div>

      {rows.map((h) => {
        const label = labelFor(h.outcomeIndex);
        const tone = toneForLabel(label);
        const me = !!address && h.walletAddress.toLowerCase() === address.toLowerCase();
        const name = h.user?.username ?? "anon";
        return (
          <div
            key={h.id}
            className={`relative flex items-center gap-3 overflow-hidden border-t border-line/40 px-2 py-2.5 ${
              me ? "bg-accent/[0.05] shadow-[inset_2px_0_0_var(--color-accent)]" : ""
            }`}
          >
            <ProportionBar pct={total > 0 ? (shares(h) / total) * 100 : 0} tone={tone} />
            <span className="relative">
              <Avatar name={name} />
            </span>
            <span className="relative min-w-0 flex-1">
              <span className="block truncate text-[12.5px] text-fg/90">
                {name}
                {me && (
                  <span className="ml-1.5 font-mono text-[10px] tracking-[0.14em] text-accent uppercase">
                    you
                  </span>
                )}
              </span>
              <span className="block font-mono text-[10px] text-muted/75">
                {walletShort(h.walletAddress)}
              </span>
            </span>
            <span className="relative">
              <OutcomeChip label={label} />
            </span>
            <span className="relative font-mono text-[10px] whitespace-nowrap text-muted">
              avg {h.averageCost != null ? centsLabel(h.averageCost) : "—"}
            </span>
            <span className="relative font-mono text-[13px] tabular-nums text-fg">
              {Math.round(shares(h)).toLocaleString("en-US")}
              <span className="ml-1 text-[9px] text-muted uppercase">sh</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
