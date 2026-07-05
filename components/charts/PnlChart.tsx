"use client";

import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { LineChart, EffectScatterChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  AxisPointerComponent,
  MarkLineComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
  LineChart,
  EffectScatterChart,
  GridComponent,
  TooltipComponent,
  AxisPointerComponent,
  MarkLineComponent,
  CanvasRenderer,
]);

export type PnlPoint = { t: number; usd: number };

function cssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function utcDay(t: number): string {
  const d = new Date(t);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** "$1.2k" / "-$412" / "$86" — compact mono axis labels. */
function fmtUsd(v: number): string {
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`;
  return `${sign}$${Math.round(abs)}`;
}

export function PnlChart({
  points,
  height = 240,
  onHoverValue,
}: {
  points: PnlPoint[];
  height?: number;
  /** Fires with the hovered point's usd while scrubbing, null on leave. */
  onHoverValue?: (usd: number | null) => void;
}) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ReturnType<typeof echarts.init> | null>(null);

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

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || points.length < 2) return;

    const up = points[points.length - 1].usd >= points[0].usd;
    const lineColor = cssVar(up ? "--color-yes" : "--color-no", up ? "#7fae8b" : "#c97a6d");
    const hairline = cssVar("--color-line", "rgba(255,255,255,0.08)");
    const mutedColor = cssVar("--color-muted", "#a89f9c");
    const surfaceColor = cssVar("--color-surface", "#221d1d");
    const bgColor = cssVar("--color-bg", "#161313");
    const fgColor = cssVar("--color-fg", "#f2efed");
    const monoFont = cssVar("--font-mono", "ui-monospace, monospace");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const last = points[points.length - 1];

    // Square mono pills the crosshair pins to both axes.
    const pointerLabel = {
      backgroundColor: surfaceColor,
      borderColor: hairline,
      borderWidth: 1,
      borderRadius: 0,
      shadowBlur: 0,
      color: fgColor,
      fontFamily: monoFont,
      fontSize: 9,
      padding: [3, 5] as [number, number],
    };

    chart.setOption(
      {
        animation: !reducedMotion,
        animationDuration: 300,
        grid: { left: 8, right: 52, top: 14, bottom: 24 },
        xAxis: {
          type: "time",
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: {
            color: mutedColor,
            fontFamily: monoFont,
            fontSize: 10,
            hideOverlap: true,
            formatter: (value: number) => utcDay(value),
          },
          axisPointer: {
            label: {
              ...pointerLabel,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter: (p: any) => utcDay(Number(p.value)),
            },
          },
        },
        yAxis: {
          type: "value",
          position: "right",
          scale: true,
          splitNumber: 2,
          axisLabel: {
            color: mutedColor,
            fontFamily: monoFont,
            fontSize: 10,
            formatter: (v: number) => fmtUsd(v),
          },
          splitLine: { lineStyle: { color: hairline, type: "solid" as const } },
          axisPointer: {
            label: {
              ...pointerLabel,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter: (p: any) => fmtUsd(Number(p.value)),
            },
          },
        },
        // Value lives in the RollingNumber readout above the chart; the
        // tooltip only carries the scrubbed date.
        tooltip: {
          trigger: "axis",
          axisPointer: {
            type: "cross",
            snap: true,
            lineStyle: { color: mutedColor, width: 1, opacity: 0.45 },
            crossStyle: { color: mutedColor, width: 1, opacity: 0.45 },
          },
          backgroundColor: surfaceColor,
          borderColor: hairline,
          borderWidth: 1,
          padding: [5, 7],
          extraCssText: "border-radius:0;box-shadow:none;",
          textStyle: { color: fgColor, fontFamily: monoFont, fontSize: 10 },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter: (params: any) => {
            const p = Array.isArray(params) ? params[0] : params;
            if (!p?.value) return "";
            return `<div style="font-size:10px;letter-spacing:.1em;opacity:.6;">${utcDay(p.value[0])}</div>`;
          },
        },
        series: [
          {
            type: "line" as const,
            data: points.map((p) => [p.t, p.usd]),
            color: lineColor,
            showSymbol: false,
            symbol: "circle",
            symbolSize: 5,
            lineStyle: { width: 1.5 },
            areaStyle: {
              // lineColor is a resolved hex token — append canvas-safe alpha.
              color: {
                type: "linear" as const,
                x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [
                  { offset: 0, color: `${lineColor}2E` },
                  { offset: 1, color: `${lineColor}00` },
                ],
              },
            },
            // Latest print pinned to the axis, terminal price-tag style.
            markLine: {
              silent: true,
              symbol: "none",
              animation: false,
              lineStyle: { color: lineColor, width: 1, type: [2, 3], opacity: 0.4 },
              label: {
                show: true,
                position: "end" as const,
                formatter: fmtUsd(last.usd),
                backgroundColor: lineColor,
                color: bgColor,
                fontFamily: monoFont,
                fontSize: 9,
                fontWeight: 700 as const,
                padding: [2, 4] as [number, number],
              },
              data: [{ yAxis: last.usd }],
            },
          },
          // Live dot on the newest print — rippling unless motion is reduced.
          {
            type: "effectScatter" as const,
            data: [[last.t, last.usd]],
            color: lineColor,
            symbolSize: 5,
            rippleEffect: reducedMotion
              ? { scale: 1, brushType: "stroke" as const }
              : { scale: 2.6, period: 3.2, brushType: "stroke" as const },
            silent: true,
            tooltip: { show: false },
            zlevel: 1,
          },
        ],
      },
      { notMerge: true },
    );
  }, [points]);

  // Hover scrub → report the nearest point's value upward (null on leave).
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !onHoverValue || points.length === 0) return;

    const onMove = (e: unknown) => {
      // Cross pointer reports both axes — take the time (x) axis entry.
      const axes = (e as { axesInfo?: { axisDim?: string; value?: number }[] }).axesInfo;
      const t = axes?.find((a) => a.axisDim === "x")?.value;
      if (typeof t !== "number") return;
      let nearest = points[0];
      for (const p of points) {
        if (Math.abs(p.t - t) < Math.abs(nearest.t - t)) nearest = p;
      }
      onHoverValue(nearest.usd);
    };
    const onLeave = () => onHoverValue(null);

    chart.on("updateAxisPointer", onMove);
    chart.getZr().on("globalout", onLeave);
    return () => {
      chart.off("updateAxisPointer", onMove);
      // getZr() throws after dispose; the dispose cleanup runs after this one.
      if (!chart.isDisposed()) chart.getZr().off("globalout", onLeave);
    };
  }, [points, onHoverValue]);

  return <div ref={elRef} style={{ height, width: "100%" }} />;
}
