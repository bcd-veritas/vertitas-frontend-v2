import { CountUp } from "./CountUp";

/**
 * The reference's three solid color-block step cards: flush edge-to-edge
 * thirds, square corners, near-black text on the app's own theme tokens.
 */

const BLOCKS = [
  {
    eyebrow: "volume traded",
    desc: "Lifetime notional across all fills.",
    bg: "var(--color-accent)",
  },
  {
    eyebrow: "markets traded",
    desc: "Distinct markets with at least one fill.",
    bg: "var(--color-yes)",
  },
  {
    eyebrow: "win rate",
    desc: "Closed positions that settled profitable.",
    bg: "var(--color-no)",
  },
] as const;

export function MetricBlocks({
  volumeTradedCents,
  marketsTraded,
  winRatePct,
}: {
  volumeTradedCents: number;
  marketsTraded: number;
  winRatePct: number;
}) {
  const values = [
    { value: Math.round(volumeTradedCents / 100), prefix: "$" },
    { value: marketsTraded },
    { value: Math.round(winRatePct), suffix: "%" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 border-b border-line">
      {BLOCKS.map((b, i) => (
        <div
          key={b.eyebrow}
          className="relative p-6 min-h-55 flex flex-col overflow-hidden"
          style={{ background: b.bg, color: "var(--color-bg)" }}
        >
          <span
            aria-hidden="true"
            className="absolute top-4 right-4 font-mono text-[10px] tracking-[0.24em] opacity-60"
            style={{ writingMode: "vertical-rl" }}
          >
            IDX 0{i + 1}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] opacity-70">
            {b.eyebrow}
          </span>
          <span className="mt-2 text-base font-medium opacity-85 pr-10 leading-snug">{b.desc}</span>
          <CountUp
            {...values[i]}
            className="mt-auto pt-6 text-6xl sm:text-7xl font-semibold tabular-nums leading-none"
          />
        </div>
      ))}
    </div>
  );
}
