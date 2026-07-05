"use client";

import { useId, useRef, useState } from "react";
import type { ApiOutcome, PricePoint } from "@/lib/markets/types";
import { toCents } from "@/lib/markets/format";

const W = 640;
const H = 240;
const PAD_X = 10;
const PAD_TOP = 14;
const PAD_BOTTOM = 26;

type Timeframe = "24H" | "7D" | "ALL";
const TIMEFRAMES: Timeframe[] = ["24H", "7D", "ALL"];
const WINDOW_MS: Record<Timeframe, number | null> = {
  "24H": 24 * 60 * 60 * 1000,
  "7D": 7 * 24 * 60 * 60 * 1000,
  ALL: null,
};

// Index 0/1 keep the yes/no palette; 2+ get muted hues that fit the warm dark theme.
const OUTCOME_COLOR = [
  "var(--color-yes)",
  "var(--color-no)",
  "#8fb4c9", // slate blue
  "#c9b27a", // ochre
  "#a68fc9", // violet
];

type XY = { x: number; y: number; cents: number; t: number };

/** "62¢ · JUL 12 14:03" hover readout (UTC — SSR-stable, though hover is client-only anyway). */
function readoutLabel(p: XY): string {
  const d = new Date(p.t);
  const month = d
    .toLocaleString("en-US", { month: "short", timeZone: "UTC" })
    .toUpperCase();
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${Math.round(p.cents)}¢ · ${month} ${d.getUTCDate()} ${hh}:${mm}`;
}

/** Short UTC axis label: "JUL 12" for multi-day windows, "14:03" inside a day. */
function axisTimeLabel(t: number, spanMs: number): string {
  const d = new Date(t);
  if (spanMs <= 26 * 60 * 60 * 1000) {
    return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  }
  const month = d
    .toLocaleString("en-US", { month: "short", timeZone: "UTC" })
    .toUpperCase();
  return `${month} ${d.getUTCDate()}`;
}

export function PriceChart({
  outcomes,
  series,
}: {
  outcomes: ApiOutcome[];
  series: PricePoint[][];
}) {
  const [sel, setSel] = useState(0);
  const [tf, setTf] = useState<Timeframe>("ALL");
  const [hover, setHover] = useState<XY | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  // Unique per instance so two charts on one page can't share a gradient.
  // useId output can contain characters invalid in url(#...) refs; strip them.
  const gradientId = `chart-fade-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const all = series[sel] ?? [];
  // Anchor the window to the newest print (deterministic on server + client).
  const anchor = all.length > 0 ? new Date(all[all.length - 1].createdAt).getTime() : 0;
  const windowMs = WINDOW_MS[tf];
  const points = windowMs == null ? all : all.filter((p) => anchor - new Date(p.createdAt).getTime() <= windowMs);

  const color = OUTCOME_COLOR[sel] ?? OUTCOME_COLOR[0];

  // ---- scales ----
  const t0 = points.length > 0 ? new Date(points[0].createdAt).getTime() : 0;
  const t1 = points.length > 0 ? new Date(points[points.length - 1].createdAt).getTime() : 1;
  const tSpan = Math.max(t1 - t0, 1);

  const centsVals = points.map((p) => toCents(p.price));
  let loC = Math.min(...(centsVals.length ? centsVals : [0]));
  let hiC = Math.max(...(centsVals.length ? centsVals : [100]));
  // Pad to at least a 10¢ range so a flat series doesn't fill the panel.
  if (hiC - loC < 10) {
    const mid = (hiC + loC) / 2;
    loC = Math.max(0, mid - 5);
    hiC = Math.min(100, mid + 5);
  }
  const cSpan = Math.max(hiC - loC, 1);

  const plotW = W - PAD_X * 2;
  const plotH = H - PAD_TOP - PAD_BOTTOM;
  const xy: XY[] = points.map((p) => {
    const t = new Date(p.createdAt).getTime();
    const cents = toCents(p.price);
    return {
      x: PAD_X + ((t - t0) / tSpan) * plotW,
      y: PAD_TOP + (1 - (cents - loC) / cSpan) * plotH,
      cents,
      t,
    };
  });

  const line = xy.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area =
    xy.length > 1
      ? `${line} ${xy[xy.length - 1].x.toFixed(1)},${(PAD_TOP + plotH).toFixed(1)} ${xy[0].x.toFixed(1)},${(PAD_TOP + plotH).toFixed(1)}`
      : "";

  // 3 price gridline labels: hi / mid / lo.
  const priceTicks = [hiC, (hiC + loC) / 2, loC];
  // 3 time labels: start / mid / end.
  const timeTicks = xy.length > 1 ? [t0, t0 + tSpan / 2, t1] : [];

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    if (xy.length === 0 || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let nearest = xy[0];
    for (const p of xy) {
      if (Math.abs(p.x - px) < Math.abs(nearest.x - px)) nearest = p;
    }
    setHover(nearest);
  }

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
        <div className="flex items-center gap-3">
          <div role="tablist" aria-label="Outcome" className="flex items-center gap-1">
            {outcomes.map((o, i) => {
              const on = sel === i;
              return (
                <button
                  key={o.id}
                  role="tab"
                  aria-selected={on}
                  onClick={() => {
                    setSel(i);
                    setHover(null);
                  }}
                  className={`px-2.5 py-1 rounded font-mono text-[11px] uppercase tracking-[0.14em] transition-colors ${
                    on
                      ? "bg-accent/10 text-accent border border-accent/25"
                      : "text-muted hover:text-fg/80 border border-transparent"
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
          <div role="tablist" aria-label="Timeframe" className="flex items-center gap-1">
            {TIMEFRAMES.map((f) => {
              const on = tf === f;
              return (
                <button
                  key={f}
                  role="tab"
                  aria-selected={on}
                  onClick={() => {
                    setTf(f);
                    setHover(null);
                  }}
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
      </div>

      {xy.length < 2 ? (
        <p className="py-16 text-center font-mono text-[11px] uppercase tracking-[0.24em] text-muted/70">
          no prints in window
        </p>
      ) : (
        <div className="px-2 pb-3">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-auto block"
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
            role="img"
            aria-label={`${outcomes[sel]?.label ?? ""} price history`}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.18" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* price gridlines + labels */}
            {priceTicks.map((c) => {
              const y = PAD_TOP + (1 - (c - loC) / cSpan) * plotH;
              return (
                <g key={c}>
                  <line
                    x1={PAD_X}
                    x2={W - PAD_X}
                    y1={y}
                    y2={y}
                    stroke="rgba(255,255,255,0.06)"
                    strokeDasharray="2 4"
                  />
                  <text
                    x={W - PAD_X}
                    y={y - 4}
                    textAnchor="end"
                    className="font-mono"
                    fontSize="10"
                    fill="var(--color-muted)"
                  >
                    {Math.round(c)}&#162;
                  </text>
                </g>
              );
            })}

            {/* area fade + price line */}
            <polygon points={area} fill={`url(#${gradientId})`} />
            <polyline
              points={line}
              fill="none"
              stroke={color}
              strokeWidth="1.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {/* time axis labels */}
            {timeTicks.map((t, i) => (
              <text
                key={t}
                x={PAD_X + ((t - t0) / tSpan) * plotW}
                y={H - 8}
                textAnchor={i === 0 ? "start" : i === timeTicks.length - 1 ? "end" : "middle"}
                className="font-mono"
                fontSize="10"
                fill="var(--color-muted)"
              >
                {axisTimeLabel(t, tSpan)}
              </text>
            ))}

            {/* hover crosshair */}
            {hover && (
              <g>
                <line
                  x1={hover.x}
                  x2={hover.x}
                  y1={PAD_TOP}
                  y2={PAD_TOP + plotH}
                  stroke="rgba(255,255,255,0.18)"
                />
                <circle cx={hover.x} cy={hover.y} r="3" fill={color} />
              </g>
            )}
          </svg>
          <p className="h-4 px-3 font-mono text-[11px] tabular-nums text-muted">
            {hover ? readoutLabel(hover) : " "}
          </p>
        </div>
      )}
    </section>
  );
}
