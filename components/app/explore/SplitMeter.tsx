import type { ApiMarket } from "@/lib/markets/types";
import { oneDp } from "@/lib/markets/format";
import { splitSides } from "../board/splitSides";
import { PixelLabel } from "../PixelLabel";

/** Under this share a segment cannot hold its figure without slicing a digit.
 *  Same threshold the board's masses use. */
const TIGHT_PCT = 22;

function Neutral({ text }: { text: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-muted/15">
      <PixelLabel className="text-[13px]! tracking-[0.12em]!">{text}</PixelLabel>
    </div>
  );
}

/**
 * A market's odds as a fixed-width proportional block.
 *
 * Every meter in the list is the same width, so the boundaries stack into a
 * column the eye can run down — the odds read as a position before they read as
 * a number. That is the whole reason /explore is denser than the board without
 * being harder to scan.
 */
export function SplitMeter({ market }: { market: ApiMarket }) {
  const sides = market.status === "ENDED" ? null : splitSides(market);

  return (
    <div
      aria-hidden="true"
      data-explore-meter=""
      className="relative flex h-10 overflow-hidden rounded-[3px]"
    >
      {market.status === "ENDED" ? (
        // Closed, awaiting the oracle: the frozen book would read as live odds,
        // so it gets texture instead of a split. The gradient is inline because
        // Lightning CSS silently drops this rule from a stylesheet.
        <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
          <div
            className="absolute inset-0 text-amber-400/40"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, currentColor 0 1.5px, transparent 1.5px 5px)",
            }}
          />
          <PixelLabel className="relative font-pixel! text-[13px]! font-semibold! tracking-[0.14em]! text-amber-300!">
            resolving
          </PixelLabel>
        </div>
      ) : market.status === "CANCELLED" ? (
        <Neutral text="cancelled" />
      ) : !sides ? (
        <Neutral text="no price" />
      ) : (
        <>
          {sides.map((s, i) => (
            <div
              key={i}
              style={{ flexGrow: s.pct, flexBasis: 0 }}
              className={`flex min-w-0 items-center overflow-hidden px-2 whitespace-nowrap ${
                s.tone === "yes"
                  ? "justify-start bg-yes/25 text-yes"
                  : "justify-end bg-no/20 text-no"
              }`}
            >
              {s.pct >= TIGHT_PCT && (
                <span className="font-pixel text-[1.05rem] leading-none font-medium tabular-nums">
                  {oneDp(s.pct)}
                </span>
              )}
            </div>
          ))}
          {/* The boundary is what the eye tracks down the column, so it gets a
              hard edge rather than two tints meeting. */}
          <span
            className="pointer-events-none absolute inset-y-0 w-px bg-bg/55"
            style={{ left: `${sides[0].pct}%` }}
          />
        </>
      )}
    </div>
  );
}
