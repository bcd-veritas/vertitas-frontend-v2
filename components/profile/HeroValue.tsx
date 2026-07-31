import { ArrowUpRight } from "lucide-react";
import { InstanceCloud } from "./InstanceCloud";
import { CountUp } from "./CountUp";

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
  pnlBaseCents,
  resolvingShares,
  claimableCount,
  winRatePct,
}: {
  /** Display headline: username, falling back to the short address. */
  title: string;
  valueCents: number;
  pnlCents: number;
  /** Cost basis of the positions the PnL came from. Kept separate from
   *  `valueCents`, which also carries idle collateral — dividing by that turned
   *  a 79% gain on open positions into "+1.8%". */
  pnlBaseCents: number;
  /** Shares in markets that have closed and not yet resolved. No dollar figure:
   *  nothing can price them until the oracle reports. */
  resolvingShares: number;
  /** Settled, winning, unclaimed positions. */
  claimableCount: number;
  winRatePct: number;
}) {
  const up = pnlCents >= 0;
  const pnlPct = pnlBaseCents > 0 ? (pnlCents / pnlBaseCents) * 100 : 0;
  const sign = up ? "+" : "−";

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
          <span className="tabular-nums">
            win rate <CountUp value={Math.round(winRatePct)} suffix="%" />
          </span>
        </div>

        {/* Giant display headline (reference: "THE ARCHITECTURE OF YOUR WEALTH.")
            mt-auto pins the content block to the bottom of the 80vh band. */}
        <h1
          className="mt-auto pt-10 font-semibold uppercase text-fg wrap-break-word leading-[0.95] tracking-tight"
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
            <CountUp value={Math.floor(valueCents / 100)} prefix="$" />
          </span>
          <span className="text-fg" style={{ fontSize: "0.42em" }}>
            <CountUp value={valueCents % 100} prefix="." pad={2} />
          </span>
        </p>

        {/* "ALL TIME" until now, which it never was — this is the unrealized
            mark-to-market on positions still open. Anything already closed
            contributes nothing to it. */}
        <p
          className={`mt-5 font-mono text-xs tracking-widest tabular-nums ${up ? "text-yes" : "text-no"}`}
        >
          {sign}
          <CountUp value={Math.abs(pnlCents) / 100} prefix="$" decimals={2} /> ({sign}
          <CountUp value={Math.abs(pnlPct)} decimals={1} suffix="%" />) UNREALIZED · OPEN
          POSITIONS
        </p>

        {(resolvingShares > 0 || claimableCount > 0) && (
          <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11px] tracking-widest text-muted uppercase tabular-nums">
            {resolvingShares > 0 && (
              <span>
                <CountUp value={resolvingShares} decimals={resolvingShares % 1 ? 2 : 0} /> shares
                awaiting resolution — not priced above
              </span>
            )}
            {claimableCount > 0 && (
              <span className="text-yes">
                {claimableCount} market{claimableCount === 1 ? "" : "s"} ready to redeem
              </span>
            )}
          </p>
        )}
      </div>
    </section>
  );
}
