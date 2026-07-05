"use client";

import { useMemo } from "react";
import type { FeaturedChartSeries } from "@/lib/markets/types";
import { ProbabilityChart, type ChartSeries } from "../charts/ProbabilityChart";

/** Fixed-point price (1e8 == 100%) → 0–100 pct. */
const toPct = (price: string) => Number(price) / 1_000_000;

export function FeaturedChart({
  series,
  topIndexes,
  colorOf,
}: {
  series: FeaturedChartSeries[];
  /** Outcome indexes of the card's top-4 list, in rank order — the chart shows exactly these. */
  topIndexes: number[];
  colorOf: (outcomeIndex: number) => string;
}) {
  const chartSeries = useMemo<ChartSeries[]>(() => {
    return topIndexes
      .map((idx) => series.find((s) => s.outcomeIndex === idx))
      .filter((s): s is FeaturedChartSeries => s != null && s.points.length >= 2)
      .map((s) => ({
        key: String(s.outcomeIndex),
        label: s.label,
        color: colorOf(s.outcomeIndex),
        points: s.points
          .map((p) => ({ t: +new Date(p.t), pct: toPct(p.price) }))
          .sort((a, b) => a.t - b.t),
      }));
  }, [series, topIndexes, colorOf]);

  if (chartSeries.length === 0) {
    return (
      <div className="h-65 flex items-center justify-center font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
        no price history yet
      </div>
    );
  }

  return <ProbabilityChart series={chartSeries} height={260} />;
}
