"use client";

import { useMemo, useState } from "react";
import type { ApiOutcome, PricePoint } from "@/lib/markets/types";
import { ProbabilityChart, type ChartSeries } from "../charts/ProbabilityChart";
import { CHART_PALETTE } from "../charts/palette";

type Timeframe = "24H" | "7D" | "ALL";
const TIMEFRAMES: Timeframe[] = ["24H", "7D", "ALL"];
const WINDOW_MS: Record<Timeframe, number | null> = {
  "24H": 24 * 60 * 60 * 1000,
  "7D": 7 * 24 * 60 * 60 * 1000,
  ALL: null,
};

/** Fixed-point price (1e8 == 100%) → 0–100 pct. */
const toPct = (price: string) => Number(price) / 1_000_000;

type Ranked = {
  key: string;
  label: string;
  color: string;
  /** Full history, oldest-first, already converted. */
  points: { t: number; pct: number }[];
  /** Latest traded pct (readout + ranking). */
  lastPct: number;
};

export function PriceChart({
  outcomes,
  series,
}: {
  outcomes: ApiOutcome[];
  series: PricePoint[][];
}) {
  const [tf, setTf] = useState<Timeframe>("ALL");
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [highlight, setHighlight] = useState<string | null>(null);

  // Top-4 by latest trade price (ties → outcome order). Outcomes without data drop out.
  const ranked = useMemo<Ranked[]>(() => {
    const withData = outcomes
      .map((o, i) => {
        const pts = (series[i] ?? [])
          .map((p) => ({ t: +new Date(p.createdAt), pct: toPct(p.price) }))
          .sort((a, b) => a.t - b.t);
        return { outcome: o, pts };
      })
      .filter((e) => e.pts.length > 0);

    withData.sort(
      (a, b) =>
        b.pts[b.pts.length - 1].pct - a.pts[a.pts.length - 1].pct ||
        a.outcome.index - b.outcome.index,
    );

    return withData.slice(0, 4).map((e, rank) => ({
      key: e.outcome.id,
      label: e.outcome.label,
      color: CHART_PALETTE[rank % CHART_PALETTE.length],
      points: e.pts,
      lastPct: e.pts[e.pts.length - 1].pct,
    }));
  }, [outcomes, series]);

  // Timeframe window anchored to the newest print across ranked series (never Date.now()).
  const windowed = useMemo<ChartSeries[]>(() => {
    const windowMs = WINDOW_MS[tf];
    const anchor = Math.max(0, ...ranked.map((r) => r.points[r.points.length - 1]?.t ?? 0));
    return ranked.map((r) => ({
      key: r.key,
      label: r.label,
      color: r.color,
      points: windowMs == null ? r.points : r.points.filter((p) => anchor - p.t <= windowMs),
    }));
  }, [ranked, tf]);

  const visibleWithData = windowed.filter((s) => !hidden.has(s.key) && s.points.length >= 2);

  const toggleHidden = (key: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <section
      className="relative bg-surface/70 border border-line rounded-xl overflow-hidden"
      aria-label="Price chart"
    >
      <span
        aria-hidden="true"
        className="absolute top-2.5 right-3 font-mono text-muted/40 text-xs select-none"
      >
        +
      </span>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-2">
        <h2 className="font-pixel text-xl tracking-wide text-fg">PRICE CHART</h2>
        <div role="tablist" aria-label="Timeframe" className="flex items-center gap-1">
          {TIMEFRAMES.map((f) => {
            const on = tf === f;
            return (
              <button
                key={f}
                role="tab"
                aria-selected={on}
                onClick={() => setTf(f)}
                className={`px-2 py-1 rounded font-mono text-[11px] tracking-[0.14em] transition-colors ${
                  on ? "text-fg bg-fg/5" : "text-muted hover:text-fg/80"
                }`}
              >
                {f}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend chips: hover = highlight + dim others, click = hide/show. */}
      {ranked.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-5 pb-2">
          {ranked.map((r) => {
            const off = hidden.has(r.key);
            return (
              <button
                key={r.key}
                aria-pressed={!off}
                onClick={() => toggleHidden(r.key)}
                onMouseEnter={() => setHighlight(r.key)}
                onMouseLeave={() => setHighlight(null)}
                onFocus={() => setHighlight(r.key)}
                onBlur={() => setHighlight(null)}
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border font-mono text-[11px] uppercase tracking-[0.1em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                  off
                    ? "border-line text-muted/50"
                    : "border-line/80 text-fg/85 hover:border-line"
                }`}
              >
                <span
                  aria-hidden="true"
                  className="w-2 h-2 rounded-full"
                  style={{ background: r.color, opacity: off ? 0.3 : 1 }}
                />
                {r.label}
                <span className={`tabular-nums ${off ? "text-muted/40" : "text-muted"}`}>
                  {Math.round(r.lastPct)}%
                </span>
              </button>
            );
          })}
        </div>
      )}

      {visibleWithData.length === 0 ? (
        <p className="py-16 text-center font-mono text-[11px] uppercase tracking-[0.24em] text-muted/70">
          no prints in window
        </p>
      ) : (
        <div className="px-2 pb-3">
          <ProbabilityChart
            series={windowed}
            height={260}
            highlightKey={highlight}
            hiddenKeys={hidden}
          />
        </div>
      )}
    </section>
  );
}
