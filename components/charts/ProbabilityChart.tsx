"use client";

import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer]);

export type ChartPoint = { t: number; pct: number };
export type ChartSeries = {
  /** Stable id (outcome id or index) used for highlight/hide. */
  key: string;
  label: string;
  /** Resolved CSS color (hex/rgb) — CSS vars must be resolved by the caller. */
  color: string;
  /** Oldest-first. */
  points: ChartPoint[];
};

/** Resolve a CSS custom property off :root at call time (client only). */
function cssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** "JUL 12" beyond ~a day of span, "14:03" within it. Always UTC. */
function utcAxisLabel(t: number, spanMs: number): string {
  const d = new Date(t);
  if (spanMs <= 26 * 60 * 60 * 1000) {
    return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  }
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** Tooltip header: "JUL 12 · 14:03" (UTC). */
function utcTooltipHeader(t: number): string {
  const d = new Date(t);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()} · ${hh}:${mm}`;
}

export function ProbabilityChart({
  series,
  height = 260,
  highlightKey = null,
  hiddenKeys,
  className,
}: {
  series: ChartSeries[];
  height?: number;
  /** Legend-chip hover: emphasize this series, blur the rest. */
  highlightKey?: string | null;
  /** Legend-chip click: series to omit entirely. */
  hiddenKeys?: ReadonlySet<string>;
  className?: string;
}) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  // Init once; resize with the container; dispose on unmount.
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    const chart = echarts.init(el);
    chartRef.current = chart;
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(el);
    return () => {
      ro.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  // (Re)build the option whenever data or visibility changes.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const visible = series.filter((s) => !(hiddenKeys?.has(s.key)) && s.points.length >= 2);
    if (visible.length === 0) return; // callers gate emptiness; belt-and-braces no-op

    // Trade prints land at different timestamps per series, but ECharts' axis
    // tooltip and snap dots only group series sharing an exact x. Resample
    // every series onto the union time grid, forward-filling (a price holds
    // until the next print), so scrubbing reads a value for EVERY visible
    // line at any position — and every line extends to the newest print,
    // Kalshi-style. Leading nulls (before a series' first print) stay gaps.
    const grid = Array.from(
      new Set(visible.flatMap((s) => s.points.map((p) => p.t))),
    ).sort((a, b) => a - b);
    const filledBySeries = visible.map((s) => {
      const vals: (number | null)[] = [];
      let i = -1;
      for (const t of grid) {
        while (i + 1 < s.points.length && s.points[i + 1].t <= t) i++;
        vals.push(i >= 0 ? s.points[i].pct : null);
      }
      return vals;
    });

    const allPts = visible.flatMap((s) => s.points);
    const t0 = Math.min(...allPts.map((p) => p.t));
    const t1 = Math.max(...allPts.map((p) => p.t));
    const spanMs = Math.max(1, t1 - t0);
    const maxData = Math.max(...allPts.map((p) => p.pct));
    const maxY = Math.max(10, Math.ceil((maxData * 1.15) / 10) * 10);

    const lineColor = cssVar("--color-line", "rgba(255,255,255,0.08)");
    const mutedColor = cssVar("--color-muted", "#a89f9c");
    const surfaceColor = cssVar("--color-surface", "#221d1d");
    const fgColor = cssVar("--color-fg", "#f2efed");
    const monoFont = cssVar("--font-mono", "ui-monospace, monospace");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    chart.setOption(
      {
        animation: !reducedMotion,
        animationDuration: 300,
        animationDurationUpdate: 200,
        grid: { left: 8, right: 46, top: 14, bottom: 24 },
        xAxis: {
          type: "time",
          min: t0,
          max: t1,
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: {
            color: mutedColor,
            fontFamily: monoFont,
            fontSize: 9,
            hideOverlap: true,
            formatter: (value: number) => utcAxisLabel(value, spanMs),
          },
        },
        yAxis: {
          type: "value",
          position: "right",
          min: 0,
          max: maxY,
          interval: maxY / 2,
          axisLabel: {
            color: mutedColor,
            fontFamily: monoFont,
            fontSize: 9,
            formatter: (v: number) => `${Math.round(v)}%`,
          },
          splitLine: { lineStyle: { color: lineColor, type: [2, 4] } },
        },
        tooltip: {
          trigger: "axis",
          axisPointer: { type: "line", lineStyle: { color: mutedColor, width: 1, opacity: 0.5 } },
          backgroundColor: surfaceColor,
          borderColor: lineColor,
          borderWidth: 1,
          padding: [8, 10],
          textStyle: { color: fgColor, fontFamily: monoFont, fontSize: 11 },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter: (params: any) => {
            const rows = (Array.isArray(params) ? params : [params])
              .filter((p: { value?: [number, number | null] }) => p.value?.[1] != null)
              .sort((a, b) => (b.value?.[1] ?? 0) - (a.value?.[1] ?? 0))
              .map(
                (p) =>
                  `<div style="display:flex;align-items:center;gap:6px;margin-top:2px;">` +
                  `<span style="width:7px;height:7px;border-radius:9999px;background:${p.color};display:inline-block;"></span>` +
                  `<span style="opacity:.75;text-transform:uppercase;letter-spacing:.08em;font-size:10px;">${p.seriesName}</span>` +
                  `<span style="margin-left:auto;padding-left:14px;font-variant-numeric:tabular-nums;">${Math.round(p.value[1])}%</span>` +
                  `</div>`,
              )
              .join("");
            const t = (Array.isArray(params) ? params[0] : params)?.value?.[0];
            return (
              `<div style="font-size:10px;letter-spacing:.1em;opacity:.6;">${t != null ? utcTooltipHeader(t) : ""}</div>` + rows
            );
          },
        },
        series: visible.map((s, si) => {
          const filled = filledBySeries[si];
          const data: unknown[] = grid.map((t, gi) => [t, filled[gi]]);
          // Last point renders a persistent dot (Kalshi-style live end marker).
          const lastVal = filled[filled.length - 1];
          data[data.length - 1] = {
            value: [grid[grid.length - 1], lastVal],
            symbol: "circle",
            symbolSize: 6,
          };
          return {
            id: s.key,
            name: s.label,
            type: "line" as const,
            data,
            color: s.color,
            // Hidden until hover/tooltip — gives the "snap dot" on scrub.
            showSymbol: false,
            symbol: "circle",
            symbolSize: 5,
            lineStyle: { width: 1.5 },
            emphasis: { focus: "series" as const },
            blur: { lineStyle: { opacity: 0.15 }, itemStyle: { opacity: 0.15 } },
          };
        }),
      },
      { notMerge: true },
    );
  }, [series, hiddenKeys]);

  // External highlight (legend-chip hover) → same emphasis/blur as line hover.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.dispatchAction({ type: "downplay" });
    if (highlightKey != null && !(hiddenKeys?.has(highlightKey))) {
      chart.dispatchAction({ type: "highlight", seriesId: highlightKey });
    }
  }, [highlightKey, hiddenKeys, series]);

  return <div ref={elRef} className={className} style={{ height, width: "100%" }} />;
}
