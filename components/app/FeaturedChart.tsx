"use client";

import { useMemo } from "react";
import type { FeaturedChartSeries } from "@/lib/markets/types";

const PRICE_SCALE = 100_000_000;
const W = 640;
const H = 300;
const PAD = { t: 16, r: 46, b: 24, l: 10 };

function timeLabel(t: number): string {
  return new Date(t)
    .toLocaleString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
    .toUpperCase();
}

export function FeaturedChart({
  series,
  colorOf,
}: {
  series: FeaturedChartSeries[];
  colorOf: (outcomeIndex: number) => string;
}) {
  const geom = useMemo(() => {
    const withPoints = series.filter((s) => s.points.length > 0);
    const flat = withPoints.flatMap((s) =>
      s.points.map((p) => ({
        t: +new Date(p.t),
        y: (Number(p.price) / PRICE_SCALE) * 100,
      })),
    );
    if (flat.length === 0) return null;

    const t0 = Math.min(...flat.map((p) => p.t));
    const t1 = Math.max(...flat.map((p) => p.t));
    const maxData = Math.max(...flat.map((p) => p.y));
    const maxY = Math.max(10, Math.ceil((maxData * 1.15) / 10) * 10);

    const x = (t: number) =>
      PAD.l + ((t - t0) / Math.max(1, t1 - t0)) * (W - PAD.l - PAD.r);
    const y = (v: number) => PAD.t + (1 - v / maxY) * (H - PAD.t - PAD.b);

    const lines = withPoints.map((s) => {
      const pts = s.points
        .map((p) => ({
          x: x(+new Date(p.t)),
          y: y((Number(p.price) / PRICE_SCALE) * 100),
        }))
        .sort((a, b) => a.x - b.x);
      const d = pts
        .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
        .join(" ");
      return { outcomeIndex: s.outcomeIndex, d, last: pts[pts.length - 1] };
    });

    return { x, y, maxY, t0, t1, lines };
  }, [series]);

  if (!geom) {
    return (
      <div className="h-[260px] flex items-center justify-center font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
        no price history yet
      </div>
    );
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" role="img" aria-label="Outcome price history">
      {/* gridlines + right axis */}
      {[0, geom.maxY / 2, geom.maxY].map((v) => (
        <g key={v}>
          <line
            x1={PAD.l}
            x2={W - PAD.r}
            y1={geom.y(v)}
            y2={geom.y(v)}
            stroke="var(--color-line)"
            strokeDasharray="2 4"
          />
          <text
            x={W - PAD.r + 6}
            y={geom.y(v) + 3}
            className="fill-[var(--color-muted)]"
            fontSize="9"
            fontFamily="var(--font-mono)"
          >
            {Math.round(v)}%
          </text>
        </g>
      ))}
      {/* time labels */}
      {[geom.t0, (geom.t0 + geom.t1) / 2, geom.t1].map((t, i) => (
        <text
          key={i}
          x={geom.x(t)}
          y={H - 6}
          textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}
          className="fill-[var(--color-muted)]"
          fontSize="9"
          fontFamily="var(--font-mono)"
        >
          {timeLabel(t)}
        </text>
      ))}
      {/* series lines */}
      {geom.lines.map((l) => {
        const color = colorOf(l.outcomeIndex);
        return (
          <g key={l.outcomeIndex}>
            <path d={l.d} fill="none" stroke={color} strokeWidth="1.5" />
            {l.last && <circle cx={l.last.x} cy={l.last.y} r="3" fill={color} />}
          </g>
        );
      })}
    </svg>
  );
}
