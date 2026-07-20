import type { ReactNode } from "react";

/** Shared presentational atoms for the DISCUSSION panel tabs. Pure — no hooks,
 *  no client state — so any tab can render them. */

export function Avatar({ name }: { name: string }) {
  return (
    <span className="w-7 h-7 rounded-full bg-accent/10 border border-accent/25 flex items-center justify-center font-mono text-[10px] text-accent uppercase shrink-0">
      {name.slice(0, 2)}
    </span>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <p className="py-8 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-muted/70">
      {text}
    </p>
  );
}

/** Yes/No chip toned by LABEL (never index) — the project-wide convention. */
export function OutcomeChip({ label }: { label: string }) {
  const l = label.trim().toLowerCase();
  const tone =
    l === "yes"
      ? "bg-yes/10 text-yes"
      : l === "no"
        ? "bg-no/10 text-no"
        : "bg-fg/10 text-fg/80";
  return (
    <span className={`px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] shrink-0 ${tone}`}>
      {label}
    </span>
  );
}

/** buy/sell tone for a resting order's side. */
export function SideBadge({ side }: { side: "BID" | "ASK" }) {
  const buy = side === "BID";
  return (
    <span
      className={`px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] shrink-0 ${
        buy ? "bg-accent/10 text-accent" : "bg-fg/10 text-fg/70"
      }`}
    >
      {buy ? "buy" : "sell"}
    </span>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="pt-4 pb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted/70">
      {children}
    </p>
  );
}

export function walletShort(w: string): string {
  return `${w.slice(0, 6)}…${w.slice(-4)}`;
}

/** Stable UTC date — no relative-time hydration risk. */
export function shortDate(iso: string): string {
  return new Date(iso)
    .toLocaleString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
    .toUpperCase();
}
