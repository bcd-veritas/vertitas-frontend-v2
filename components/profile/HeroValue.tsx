import { ArrowUpRight } from "lucide-react";
import { InstanceCloud } from "./InstanceCloud";

/**
 * The Theradime hero, dark-translated and full-bleed (no panel chrome):
 * corner eyebrows → giant uppercase display headline (the user's identity) →
 * giant outline-stroke dollars with solid cents over the drifting instance
 * cloud → signed PNL readout → underlined DEPOSIT CTA (inert this round),
 * mirroring the reference's BEGIN ANALYSIS link.
 */
export function HeroValue({
  title,
  valueCents,
  pnlCents,
  winRatePct,
}: {
  /** Display headline: username, falling back to the short address. */
  title: string;
  valueCents: number;
  pnlCents: number;
  winRatePct: number;
}) {
  const dollars = Math.floor(valueCents / 100).toLocaleString("en-US");
  const cents = String(valueCents % 100).padStart(2, "0");
  const up = pnlCents >= 0;
  const baseCents = valueCents - pnlCents;
  const pnlPct = baseCents > 0 ? (pnlCents / baseCents) * 100 : 0;
  const sign = up ? "+" : "−";
  const pnlUsd = (Math.abs(pnlCents) / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <section
      className="relative border-b border-line overflow-hidden min-h-[80vh] flex"
      aria-label="Portfolio value"
    >
      <InstanceCloud />

      <div className="relative z-10 w-full flex flex-col px-3 sm:px-4 pt-6 pb-10">
        {/* Corner eyebrows, exactly like the reference's stat callouts. */}
        <div className="flex items-baseline justify-between font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
          <span>portfolio // all time</span>
          <span className="tabular-nums">win rate {Math.round(winRatePct)}%</span>
        </div>

        {/* Giant display headline (reference: "THE ARCHITECTURE OF YOUR WEALTH.")
            mt-auto pins the content block to the bottom of the 80vh band. */}
        <h1
          className="mt-auto pt-10 font-semibold uppercase text-fg break-words leading-[0.95] tracking-tight"
          style={{ fontSize: "clamp(3rem, 9vw, 6.5rem)" }}
        >
          {title}.
        </h1>

        {/* Giant outline number (dollars stroked, cents solid). */}
        <p
          className="mt-2 font-semibold tabular-nums leading-none whitespace-nowrap"
          style={{ fontSize: "clamp(4.5rem, 14vw, 11rem)" }}
        >
          <span style={{ WebkitTextStroke: "1.5px var(--color-fg)", color: "transparent" }}>
            ${dollars}
          </span>
          <span className="text-fg" style={{ fontSize: "0.42em" }}>
            .{cents}
          </span>
        </p>

        <p
          className={`mt-5 font-mono text-xs tracking-[0.1em] tabular-nums ${up ? "text-yes" : "text-no"}`}
        >
          {sign}${pnlUsd} ({sign}
          {Math.abs(pnlPct).toFixed(1)}%) ALL TIME · SIM.DATA
        </p>

        {/* Reference's "BEGIN ANALYSIS ↗" — ours is the inert Deposit CTA. */}
        <button
          type="button"
          title="Coming soon"
          className="mt-6 inline-flex items-center gap-1.5 font-mono text-[12px] font-semibold uppercase tracking-[0.14em] text-fg border-b border-fg/70 pb-0.5 hover:text-accent hover:border-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          Deposit <ArrowUpRight size={13} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
