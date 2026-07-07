"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ApiMarket } from "@/lib/markets/types";
import { closesLabel, countdown } from "@/lib/markets/format";
import { CategoryIcon } from "../app/categoryIcon";
import { MonoLabel } from "../landing/ui/MonoLabel";
import { CornerMarks } from "../landing/ui/CornerMarks";
import { AnnotationLine } from "../landing/ui/AnnotationLine";
import { PixelHeading } from "../landing/ui/PixelHeading";
import { RollingNumber } from "../profile/RollingNumber";
import { SignalWaves } from "./SignalWaves";

export type LeaderReadout = {
  label: string;
  /** Probability 0–100, null when the market has no prints or book. */
  pct: number | null;
  /** Rank color shared with the chart and tower. */
  color: string;
};

/**
 * The landing hero's world running on live data: pixel display headline,
 * wave horizon tinted by the leading outcome, annotation line pointing at a
 * giant rolling consensus readout, corner marks, mono eyebrows. Elements
 * carry data-reveal so the page shell can stagger them in on load.
 */
export function TerminalHero({
  market,
  leader,
}: {
  market: ApiMarket;
  leader: LeaderReadout;
}) {
  const live = market.status === "ACTIVE";
  return (
    <header className="relative border-b border-line overflow-hidden min-h-[56vh] flex">
      <SignalWaves tint={leader.color} />
      <CornerMarks />

      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-10 flex flex-col">
        {/* Eyebrow row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2" data-reveal>
          <Link
            href="/home"
            className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted hover:text-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded"
          >
            <ArrowLeft size={12} aria-hidden="true" /> markets
          </Link>
          <span className="hidden sm:flex items-center gap-1.5">
            <CategoryIcon category={market.category} size={11} />
            <MonoLabel>
              {`mkt.${(market.category ?? "open").replace(/\s+/g, "")} // closes ${closesLabel(market.endTime)}`}
            </MonoLabel>
          </span>
          <span
            className="ml-auto font-mono text-[11px] tracking-[0.14em] tabular-nums transition-colors duration-500"
            style={{ color: leader.color }}
          >
            {live ? <ClientCountdown endTime={market.endTime} /> : "RESOLVING"}
          </span>
        </div>

        {/* Question, landing-hero scale */}
        <PixelHeading
          as="h1"
          className="mt-auto pt-14 max-w-5xl text-[clamp(2.5rem,6.5vw,5.5rem)]"
          data-reveal
        >
          {market.title}
        </PixelHeading>

        {/* Consensus readout */}
        <div
          className="mt-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-4"
          data-reveal
        >
          <div className="flex flex-col gap-2 pb-2">
            <AnnotationLine side="left" label={`consensus // ${leader.label}`} />
            <MonoLabel className="pl-[4.75rem]">
              {live ? "live probability" : "final print"}
            </MonoLabel>
          </div>
          <div
            className="flex items-end gap-3 transition-colors duration-500"
            style={{ color: leader.color }}
          >
            <span className="font-pixel leading-none tracking-wide text-[clamp(3.5rem,9vw,7.5rem)]">
              {leader.pct != null ? (
                <RollingNumber value={leader.pct} decimals={1} minDecimals={0} suffix="%" />
              ) : (
                "—"
              )}
            </span>
            <span
              aria-hidden="true"
              className="blink mb-[0.4rem] transition-colors duration-500"
              style={{
                background: leader.color,
                width: "clamp(0.7rem, 1.6vw, 1.3rem)",
                height: "clamp(1.5rem, 3.6vw, 2.9rem)",
              }}
            />
          </div>
        </div>

        {/* System footer, landing-style */}
        <div className="mt-8 flex items-center justify-between" data-reveal>
          <MonoLabel>{`sys.id: ${market.id}`}</MonoLabel>
          <MonoLabel>{live ? "status: live" : "status: resolving"}</MonoLabel>
        </div>
      </div>
    </header>
  );
}

/** Hydration-safe countdown chip. */
function ClientCountdown({ endTime }: { endTime: string }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setText(countdown(endTime)), 0);
    return () => clearTimeout(t);
  }, [endTime]);
  return <>{text ?? "—"}</>;
}
