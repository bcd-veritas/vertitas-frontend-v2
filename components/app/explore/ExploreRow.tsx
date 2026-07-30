import Link from "next/link";
import type { ApiMarket } from "@/lib/markets/types";
import { countdownPair, formatVolCompact, multiplier, oneDp } from "@/lib/markets/format";
import { splitSides } from "../board/splitSides";
import { CategoryIcon } from "../categoryIcon";
import { PixelLabel } from "../PixelLabel";
import { SplitMeter } from "./SplitMeter";

/** ENDED = closed, awaiting the oracle. */
function statusWord(status: ApiMarket["status"]): string {
  switch (status) {
    case "ENDED":
      return "resolving";
    case "RESOLVED":
      return "resolved";
    case "CANCELLED":
      return "cancelled";
    default:
      return "open";
  }
}

/**
 * One market, one line.
 *
 * `now` arrives from the list rather than each row keeping its own interval:
 * fifty rows meant fifty timers, all firing on the same second.
 */
export function ExploreRow({ market, now }: { market: ApiMarket; now: number | null }) {
  const live = market.status === "ACTIVE";
  const sides = splitSides(market);

  return (
    <Link
      href={`/markets/${market.id}`}
      data-explore-row=""
      className={`grid grid-cols-[auto_minmax(0,1fr)_132px] items-center gap-x-3 gap-y-1 border-b border-line px-2 py-2.5 transition-colors hover:bg-white/[0.035] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent sm:gap-x-4 lg:grid-cols-[auto_minmax(0,1fr)_auto_200px_1rem] ${
        live ? "" : "opacity-55"
      }`}
    >
      <span className="col-start-1 row-start-1 flex items-center">
        <CategoryIcon category={market.category} />
      </span>

      <span className="col-start-2 row-start-1 flex min-w-0 flex-col gap-1">
        <PixelLabel className="truncate text-[13px]! tracking-[0.14em]!">
          {live
            ? `mkt.${(market.category ?? "open").replace(/\s+/g, "")} // closes ${now == null ? "—" : countdownPair(market.endTime, now)}`
            : `mkt.${statusWord(market.status)} // ${market.category ?? "open"}`}
        </PixelLabel>
        <span className="truncate font-pixel text-[1.2rem] leading-[1.05] font-medium tracking-[0.03em] text-fg uppercase">
          {market.title}
        </span>
      </span>

      <PixelLabel className="col-start-2 row-start-2 tracking-[0.12em]! tabular-nums lg:col-start-3 lg:row-start-1 lg:text-right">
        {formatVolCompact(market.volume)}
      </PixelLabel>

      {/* Screen readers get the odds as text; the meter itself is decorative. */}
      <span className="sr-only">
        {market.status === "ENDED"
          ? "Resolving — closed and awaiting the oracle outcome."
          : market.status === "CANCELLED"
            ? "Cancelled — no payout."
            : sides
              ? sides
                  .map(
                    (s) =>
                      `${s.label} ${oneDp(s.pct)} percent, pays ${multiplier(s.pct / 100)}`,
                  )
                  .join(", ")
              : "No price yet."}
      </span>

      <span className="col-start-3 row-span-2 row-start-1 lg:col-start-4 lg:row-span-1">
        <SplitMeter market={market} />
      </span>

      <span
        aria-hidden="true"
        className="col-start-5 hidden font-terminal text-[15px] text-fg/30 lg:block lg:text-right"
      >
        &rsaquo;
      </span>
    </Link>
  );
}
