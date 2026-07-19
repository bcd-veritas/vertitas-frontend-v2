import type { ReactNode } from "react";

/** Corner/button tone by outcome LABEL (project convention — never index).
 *  Returns a CSS color string for inline styling of dynamic elements. */
export function toneForLabel(label: string | null | undefined): string {
  const l = label?.trim().toLowerCase();
  if (l === "yes") return "var(--color-yes)";
  if (l === "no") return "var(--color-no)";
  return "var(--color-accent)";
}

/** Numbered lifecycle pill: 1 PROPOSE · 2 CHALLENGE · 3 VOTE. */
export function StagePill({
  n,
  label,
  active,
}: {
  n: number;
  label: string;
  active: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] border ${active
          ? "border-accent text-accent"
          : "border-line text-muted/60"
        }`}
    >
      <span className="tabular-nums">{n}</span>
      {label}
    </span>
  );
}

export function MonoNote({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
      {children}
    </p>
  );
}

/** Outcome picker chip, toned by LABEL (project convention — never index). */
export function OutcomeChipButton({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const l = label.trim().toLowerCase();
  const toneOn =
    l === "yes"
      ? "border-yes bg-yes/20 text-yes"
      : l === "no"
        ? "border-no bg-no/20 text-no"
        : "border-fg/60 bg-fg/10 text-fg";
  const toneHover =
    l === "yes"
      ? "hover:border-yes hover:text-yes hover:bg-yes/10"
      : l === "no"
        ? "hover:border-no hover:text-no hover:bg-no/10"
        : "hover:border-fg/60 hover:text-fg hover:bg-fg/5";
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`px-5 py-2 font-mono text-[12px] uppercase tracking-widest border cursor-pointer transition-all active:scale-95 ${
        selected
          ? `${toneOn} font-bold shadow-[inset_0_0_0_1px_currentColor]`
          : `border-line/80 bg-fg/[0.03] text-fg/70 ${toneHover}`
      }`}
    >
      {label}
    </button>
  );
}
