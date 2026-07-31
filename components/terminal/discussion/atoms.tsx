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

/** Derive tone from outcome label: yes/no/neutral (anything else).
 *  Used by OutcomeChip, PositionChip, and HoldersList for consistent three-bucket logic. */
export function toneForLabel(label: string): "yes" | "no" | "neutral" {
  const l = label.trim().toLowerCase();
  if (l === "yes") return "yes";
  if (l === "no") return "no";
  return "neutral";
}

/** Yes/No chip toned by LABEL (never index) — the project-wide convention. */
export function OutcomeChip({ label }: { label: string }) {
  const tone = toneForLabel(label);
  const toneClass =
    tone === "yes"
      ? "bg-yes/10 text-yes"
      : tone === "no"
        ? "bg-no/10 text-no"
        : "bg-fg/10 text-fg/80";
  return (
    <span className={`px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] shrink-0 ${toneClass}`}>
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

/** What the commenter actually holds. Toned by LABEL, never index. */
export function PositionChip({ label, shares }: { label: string; shares: number }) {
  const tone = toneForLabel(label);
  const toneClass =
    tone === "yes"
      ? "bg-yes/15 text-yes"
      : tone === "no"
        ? "bg-no/15 text-no"
        : "bg-fg/10 text-fg/80";
  const n = Math.round(shares).toLocaleString("en-US");
  return (
    <span
      title={`holds ${n} ${label} shares`}
      className={`shrink-0 rounded-[3px] px-1.5 py-0.5 font-mono text-[10px] tracking-[0.06em] whitespace-nowrap uppercase ${toneClass}`}
    >
      {label} {n}
    </span>
  );
}

/**
 * A magnitude bar sitting BEHIND a row's content.
 *
 * The row must be `relative`, and every content element in it must be
 * `relative` too — otherwise this paints over them. Do NOT give the row a
 * blanket "make children relative" rule: that would also catch this bar and
 * cancel its absolute positioning, turning it into an inline box that shoves
 * the whole row sideways. (That exact bug appeared twice in the mockup.)
 */
export function ProportionBar({ pct, tone }: { pct: number; tone: "yes" | "no" | "neutral" }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      className={`pointer-events-none absolute inset-y-0 left-0 ${
        tone === "yes" ? "bg-yes/[0.13]" : tone === "no" ? "bg-no/[0.11]" : "bg-fg/[0.06]"
      }`}
    />
  );
}

/** Sticky day divider for the Activity tape. */
export function DayHeader({ day, count }: { day: string; count: number }) {
  return (
    <div className="sticky top-0 z-[2] flex items-center justify-between gap-4 border-y border-line/60 bg-bg/95 px-1 py-1.5 backdrop-blur-sm">
      <span className="font-mono text-[10px] tracking-[0.18em] text-muted/70 uppercase">
        {day}
      </span>
      <span className="font-mono text-[10px] tracking-[0.18em] text-muted/70 uppercase">
        {count} fill{count === 1 ? "" : "s"}
      </span>
    </div>
  );
}

/** Stable UTC clock to pair with shortDate. */
export function shortTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}
