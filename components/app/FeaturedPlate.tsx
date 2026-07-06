"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { FeaturedMarket } from "@/lib/markets/types";
import { closesLabel, formatVol, rankedOutcomes } from "@/lib/markets/format";
import { CHART_PALETTE } from "../charts/palette";
import { CategoryIcon } from "./categoryIcon";
import { MonoLabel } from "../landing/ui/MonoLabel";
import { PixelHeading } from "../landing/ui/PixelHeading";
import { usePrefersReducedMotion } from "../landing/usePrefersReducedMotion";

gsap.registerPlugin(useGSAP);

const AUTOPLAY_MS = 5000;
/** Fixed resample count — every slide's terrain shares it so morphs align. */
const SAMPLES = 64;
const VIEW_W = 100;
const VIEW_H = 40;

/** Fixed-point price (1e8 == 100%) → 0–100 pct. */
const toPct = (price: string) => Number(price) / 1_000_000;

function shortDate(iso: string): string {
  return new Date(iso)
    .toLocaleString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
    .toUpperCase();
}

/** Step-hold resample (a print holds until the next trade), oldest-first. */
function samplePcts(points: { t: number; pct: number }[], n: number): number[] | null {
  if (points.length < 2) return null;
  const t0 = points[0].t;
  const t1 = points[points.length - 1].t;
  if (t1 <= t0) return null;
  const out: number[] = [];
  let idx = 0;
  for (let i = 0; i < n; i++) {
    const t = t0 + ((t1 - t0) * i) / (n - 1);
    while (idx + 1 < points.length && points[idx + 1].t <= t) idx++;
    out.push(points[idx].pct);
  }
  return out;
}

const FLAT = Array.from({ length: SAMPLES }, () => 3);

type SlideStat = {
  id: string;
  label: string;
  pct: number | null;
  color: string;
  rank: number;
  /** Whether this outcome has a drawable series in the terrain. */
  hasSeries: boolean;
};
type Slide = {
  market: FeaturedMarket;
  color: string;
  stats: SlideStat[];
  /** Leader terrain, resampled; FLAT when the market has no prints yet. */
  leaderYs: number[];
  hasHistory: boolean;
  /** Secondary top-outcome lines (rank 1+), resampled. */
  lines: { ys: number[]; color: string; rank: number }[];
  maxPct: number;
};

function toY(pct: number, maxPct: number): number {
  return VIEW_H - 1.5 - (pct / maxPct) * (VIEW_H - 6);
}

function linePath(ys: number[], maxPct: number): string {
  return ys
    .map((p, i) => `${i === 0 ? "M" : "L"}${((i / (ys.length - 1)) * VIEW_W).toFixed(2)},${toY(p, maxPct).toFixed(2)}`)
    .join(" ");
}

function areaPath(ys: number[], maxPct: number): string {
  return `${linePath(ys, maxPct)} L${VIEW_W},${VIEW_H} L0,${VIEW_H} Z`;
}

/**
 * The band's terrain: the leading outcome's price history as a filled
 * area hugging the bottom of the hero. Paths are written via refs and
 * GSAP-morphed between slides (flat → first slide on load, so the terrain
 * "rises" once). Secondary lines crossfade per slide instead of morphing.
 */
function Terrain({
  slide,
  reduced,
  highlight,
}: {
  slide: Slide;
  reduced: boolean;
  /** Rank (0 = leader) of the outcome to spotlight, null for the normal mix. */
  highlight: number | null;
}) {
  const areaRef = useRef<SVGPathElement>(null);
  const lineRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const state = useRef<{ ys: number[]; max: number }>({ ys: FLAT.slice(), max: 20 });

  useGSAP(
    () => {
      const apply = (ys: number[], max: number) => {
        areaRef.current?.setAttribute("d", areaPath(ys, max));
        lineRef.current?.setAttribute("d", linePath(ys, max));
        dotRef.current?.setAttribute("cy", String(toY(ys[ys.length - 1], max)));
      };
      const target = { ys: slide.leaderYs, max: slide.maxPct };
      if (reduced) {
        state.current = { ys: target.ys.slice(), max: target.max };
        apply(target.ys, target.max);
        return;
      }
      const fromYs = state.current.ys.slice();
      const fromMax = state.current.max;
      const interp = gsap.utils.interpolate(fromYs, target.ys);
      const obj = { p: 0 };
      gsap.to(obj, {
        p: 1,
        duration: 1,
        ease: "power2.inOut",
        onUpdate: () => {
          const ys = interp(obj.p) as number[];
          const max = fromMax + (target.max - fromMax) * obj.p;
          state.current = { ys, max };
          apply(ys, max);
        },
      });
    },
    { dependencies: [slide, reduced] },
  );

  const colorTransition = {
    transition:
      "stroke 800ms ease, fill 800ms ease, stroke-opacity 300ms ease, fill-opacity 300ms ease",
  } as const;

  // Spotlight mix: the hovered outcome goes full strength, the rest recede.
  const leaderDimmed = highlight != null && highlight !== 0;

  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="none"
      className="absolute inset-x-0 bottom-0 h-[72%] w-full pointer-events-none"
    >
      {/* Secondary top-outcome lines — crossfade per slide. */}
      <g key={slide.market.id} className="terrain-lines">
        {slide.lines.map((l) => (
          <path
            key={l.rank}
            d={linePath(l.ys, slide.maxPct)}
            fill="none"
            stroke={l.color}
            strokeWidth={highlight === l.rank ? 2 : 1}
            strokeOpacity={highlight == null ? 0.35 : highlight === l.rank ? 1 : 0.12}
            vectorEffect="non-scaling-stroke"
            style={colorTransition}
          />
        ))}
      </g>
      <path
        ref={areaRef}
        fill={slide.color}
        fillOpacity={highlight === 0 ? 0.2 : leaderDimmed ? 0.05 : 0.12}
        style={colorTransition}
      />
      <path
        ref={lineRef}
        fill="none"
        stroke={slide.color}
        strokeWidth={2}
        strokeOpacity={leaderDimmed ? 0.25 : 1}
        vectorEffect="non-scaling-stroke"
        style={colorTransition}
      />
      <circle
        ref={dotRef}
        cx={VIEW_W}
        r={0.6}
        fill={slide.color}
        fillOpacity={leaderDimmed ? 0.25 : 1}
        style={colorTransition}
      />
    </svg>
  );
}

export function FeaturedPlate({ markets }: { markets: FeaturedMarket[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [highlight, setHighlight] = useState<number | null>(null);
  const reduced = usePrefersReducedMotion();
  const contentRef = useRef<HTMLDivElement>(null);

  const len = markets.length;
  const clamped = len > 0 ? index % len : 0;

  // React-sanctioned "adjust state during render" — a stale spotlight must
  // not carry over to the next slide's outcomes.
  const [prevClamped, setPrevClamped] = useState(clamped);
  if (prevClamped !== clamped) {
    setPrevClamped(clamped);
    setHighlight(null);
  }

  // Per-slide derived data: rank colors rotate with the slide index so the
  // leader always matches the terrain color and the band retints per slide.
  const slides = useMemo<Slide[]>(
    () =>
      markets.map((market, i) => {
        const top = rankedOutcomes(market).slice(0, 4);
        const colorOf = (rank: number) => CHART_PALETTE[(rank + i) % CHART_PALETTE.length];
        const sampled = top.map((r) => {
          const series = market.chart.find((s) => s.outcomeIndex === r.outcome.index);
          const pts = (series?.points ?? [])
            .map((p) => ({ t: +new Date(p.t), pct: toPct(p.price) }))
            .sort((a, b) => a.t - b.t);
          return samplePcts(pts, SAMPLES);
        });
        const allPcts = sampled.flatMap((ys) => ys ?? []);
        const maxPct = Math.max(12, ...allPcts) * 1.15;
        return {
          market,
          color: colorOf(0),
          stats: top.map((r, rank) => ({
            id: r.outcome.id,
            label: r.outcome.label,
            pct: r.pct,
            color: colorOf(rank),
            rank,
            hasSeries: sampled[rank] != null,
          })),
          leaderYs: sampled[0] ?? FLAT,
          hasHistory: sampled[0] != null,
          lines: sampled
            .slice(1)
            .map((ys, j) => (ys ? { ys, color: colorOf(j + 1), rank: j + 1 } : null))
            .filter((l): l is Slide["lines"][number] => l != null),
          maxPct,
        };
      }),
    [markets],
  );

  useEffect(() => {
    if (len <= 1 || paused) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % len), AUTOPLAY_MS);
    return () => clearTimeout(t);
  }, [index, paused, len]);

  // Overlay content dips and rises on each slide change.
  useGSAP(
    () => {
      if (reduced || !contentRef.current) return;
      gsap.fromTo(
        contentRef.current,
        { autoAlpha: 0, y: 14 },
        { autoAlpha: 1, y: 0, duration: 0.5, ease: "power2.out" },
      );
    },
    { dependencies: [clamped, reduced] },
  );

  if (len === 0) return null;

  const prev = () => setIndex((i) => (i - 1 + len) % len);
  const next = () => setIndex((i) => (i + 1) % len);

  const slide = slides[clamped];
  const market = slide.market;
  const comments = market.comments.slice(0, 3);
  const href = `/markets/${market.id}`;

  return (
    <section
      aria-label="Featured markets"
      className="relative border-b border-line overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <Terrain slide={slide} reduced={reduced} highlight={highlight} />

      <div className="relative z-10 mx-auto max-w-7xl px-3 sm:px-4 pt-8 pb-12 w-full min-h-[75vh] flex flex-col">
        {/* Header row: heading + carousel controls with autoplay progress. */}
        <div className="flex items-center justify-between mb-6">
          <PixelHeading className="text-xl sm:text-2xl">FEATURED MARKETS</PixelHeading>
          {len > 1 && (
            <div className="flex flex-col items-end gap-1.5">
              <div className="flex items-center gap-2">
                <button onClick={prev} aria-label="Previous market" className="pill pill-ghost p-1.5!">
                  <ChevronLeft size={16} aria-hidden="true" />
                </button>
                <span className="font-mono text-[11px] tabular-nums text-muted min-w-12 text-center">
                  {String(clamped + 1).padStart(2, "0")} / {String(len).padStart(2, "0")}
                </span>
                <button onClick={next} aria-label="Next market" className="pill pill-ghost p-1.5!">
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              </div>
              <span aria-hidden="true" className="block h-0.5 w-24 bg-line overflow-hidden">
                <span
                  key={`${clamped}-${paused}`}
                  className="featured-progress block h-full"
                  style={{
                    background: slide.color,
                    animationDuration: `${AUTOPLAY_MS}ms`,
                    animationPlayState: paused ? "paused" : "running",
                  }}
                />
              </span>
            </div>
          )}
        </div>

        {/* Slide content — fades per slide over the morphing terrain. */}
        <div ref={contentRef} className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.9fr)] gap-x-12 gap-y-6">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-3">
              <CategoryIcon category={market.category} size={12} />
              <MonoLabel>
                {`${market.category ?? "open"} // closes ${closesLabel(market.endTime)}`}
              </MonoLabel>
            </div>

            <h3 className="font-pixel uppercase leading-[0.95] tracking-wide text-fg text-[clamp(1.9rem,4vw,3.4rem)]">
              <Link
                href={href}
                className="hover:text-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                {market.title}
              </Link>
              <Link
                href={href}
                aria-label="Open market"
                className="inline-flex align-baseline ml-2 text-muted hover:text-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                <ArrowUpRight size={22} aria-hidden="true" />
              </Link>
            </h3>

            {/* Top outcomes as big colored readouts, leader = terrain color.
                Hovering a priced outcome spotlights its line in the terrain;
                unpriced ("—") readouts stay inert. */}
            <div className="mt-6 flex flex-wrap gap-x-10 gap-y-3">
              {slide.stats.map((s) => {
                const interactive = s.pct != null && s.hasSeries;
                return (
                  <span
                    key={s.id}
                    className={`min-w-0 ${interactive ? "cursor-pointer" : ""}`}
                    onMouseEnter={interactive ? () => setHighlight(s.rank) : undefined}
                    onMouseLeave={interactive ? () => setHighlight(null) : undefined}
                  >
                    <MonoLabel className="block truncate max-w-40">{s.label}</MonoLabel>
                    <span
                      className="block font-mono text-3xl sm:text-4xl font-bold tabular-nums leading-tight transition-opacity duration-300"
                      style={{
                        color: s.pct != null ? s.color : "var(--color-muted)",
                        opacity: highlight == null || highlight === s.rank ? 1 : 0.35,
                      }}
                    >
                      {s.pct != null ? `${s.pct}%` : "—"}
                    </span>
                  </span>
                );
              })}
            </div>

            {!slide.hasHistory && (
              <MonoLabel className="block mt-4 text-muted/70">no price history yet</MonoLabel>
            )}
          </div>

          {/* Comments column */}
          <div className="min-w-0 lg:border-l lg:border-line/60 lg:pl-6">
            <MonoLabel className="block mb-1">comments</MonoLabel>
            {comments.length === 0 ? (
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted/70 py-2">
                no comments yet
              </p>
            ) : (
              <div className="flex flex-col divide-y divide-line/40">
                {comments.map((c) => (
                  <div key={c.id} className="py-2">
                    <p className="font-mono text-[11px] text-muted">
                      <span className="text-fg/85">{c.user?.username ?? "anon"}</span>
                      <span className="mx-1.5">·</span>
                      {shortDate(c.createdAt)}
                    </p>
                    <p className="text-sm text-fg/90 mt-0.5 leading-snug line-clamp-2">{c.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Band corners: volume + ends, pinned under the terrain. */}
        <div className="mt-auto pt-8 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.14em] text-muted tabular-nums">
          <span>{formatVol(market.volume)}</span>
          <span>Ends {closesLabel(market.endTime)}</span>
        </div>
      </div>

      {len > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex gap-1.5">
          {markets.map((m, i) => (
            <button
              key={m.id}
              onClick={() => setIndex(i)}
              aria-label={`Go to featured market ${i + 1}`}
              aria-current={i === clamped}
              className="h-1.5 transition-all"
              style={{
                width: i === clamped ? 20 : 6,
                background: i === clamped ? slides[i].color : "var(--color-line)",
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}
