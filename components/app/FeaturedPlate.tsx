"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import type { FeaturedMarket } from "@/lib/markets/types";
import { closesLabel, formatVol, rankedOutcomes } from "@/lib/markets/format";
import { CHART_PALETTE } from "../charts/palette";
import { CategoryIcon } from "./categoryIcon";
import { MonoLabel } from "../landing/ui/MonoLabel";
import { FeaturedChart } from "./FeaturedChart";

function shortDate(iso: string): string {
  return new Date(iso)
    .toLocaleString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
    .toUpperCase();
}

function FeaturedCard({ market }: { market: FeaturedMarket }) {
  const ranked = rankedOutcomes(market);
  const top = ranked.slice(0, 4);
  const colorByOutcome = new Map<number, string>();
  ranked.forEach((r, i) => colorByOutcome.set(r.outcome.index, CHART_PALETTE[i % CHART_PALETTE.length]));
  const colorOf = (idx: number) => colorByOutcome.get(idx) ?? "var(--color-muted)";
  const comments = market.comments.slice(0, 3);
  const href = `/markets/${market.id}`;

  return (
    <article className="relative bg-surface/70 border border-line rounded-xl overflow-hidden">
      <span aria-hidden="true" className="absolute top-2.5 right-3 font-mono text-muted/40 text-xs select-none z-10">+</span>

      <div className="flex items-start justify-between gap-4 p-5 border-b border-line">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 mb-1.5">
            <CategoryIcon category={market.category} size={12} />
            <MonoLabel>{market.category ?? "open"}</MonoLabel>
          </div>
          <h3 className="text-lg sm:text-xl font-semibold text-fg leading-snug line-clamp-2 pr-4">
            <Link href={href} className="hover:text-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded">
              {market.title}
            </Link>
          </h3>
        </div>
        <Link
          href={href}
          aria-label="Open market"
          className="shrink-0 mt-0.5 text-muted hover:text-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded"
        >
          <ArrowUpRight size={18} aria-hidden="true" />
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.85fr)_1.15fr]">
        {/* Left column */}
        <div className="p-5 lg:border-r border-line flex flex-col gap-4">
          {/* Top-4 outcomes */}
          <div className="flex flex-col divide-y divide-line/50">
            {top.map((r) => (
              <div key={r.outcome.id} className="flex items-center gap-2.5 py-2.5">
                <span aria-hidden="true" className="w-2 h-2 rounded-full shrink-0" style={{ background: colorOf(r.outcome.index) }} />
                <span className="text-sm text-fg truncate">{r.outcome.label}</span>
                <span className="ml-auto font-mono text-lg font-bold tabular-nums text-fg shrink-0">
                  {r.pct != null ? `${r.pct}%` : "—"}
                </span>
              </div>
            ))}
          </div>

          <div>
            <MonoLabel className="block mb-2">comments</MonoLabel>
            {comments.length === 0 ? (
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted/70 py-2">
                no comments yet
              </p>
            ) : (
              <div className="flex flex-col divide-y divide-line/40">
                {comments.map((c) => (
                  <div key={c.id} className="py-2.5">
                    <p className="font-mono text-[11px] text-muted">
                      <span className="text-fg/85">{c.user?.username ?? "anon"}</span>
                      <span className="mx-1.5">·</span>
                      {shortDate(c.createdAt)}
                    </p>
                    <p className="text-sm text-fg/90 mt-1 leading-snug line-clamp-2">{c.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-5 border-t lg:border-t-0 border-line">
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-3">
            {top.map((r) => (
              <span key={r.outcome.id} className="inline-flex items-center gap-1.5 font-mono text-[11px]">
                <span aria-hidden="true" className="w-2 h-2 rounded-full" style={{ background: colorOf(r.outcome.index) }} />
                <span className="text-fg/80">{r.outcome.label}</span>
                <span className="text-muted tabular-nums">{r.pct != null ? `${r.pct}%` : "—"}</span>
              </span>
            ))}
          </div>
          <FeaturedChart
            series={market.chart}
            topIndexes={top.map((r) => r.outcome.index)}
            colorOf={colorOf}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-line font-mono text-[11px] uppercase tracking-[0.14em] text-muted tabular-nums">
        <span>{formatVol(market.volume)}</span>
        <span>Ends {closesLabel(market.endTime)}</span>
      </div>
    </article>
  );
}

const AUTOPLAY_MS = 5000;

export function FeaturedPlate({ markets }: { markets: FeaturedMarket[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const len = markets.length;
  const clamped = len > 0 ? index % len : 0;

  useEffect(() => {
    if (len <= 1 || paused) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % len), AUTOPLAY_MS);
    return () => clearTimeout(t);
  }, [index, paused, len]);

  if (len === 0) return null;

  const prev = () => setIndex((i) => (i - 1 + len) % len);
  const next = () => setIndex((i) => (i + 1) % len);

  return (
    <section
      aria-label="Featured markets"
      className="mx-auto max-w-7xl px-3 sm:px-4 pt-8 w-full"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-pixel text-xl sm:text-2xl tracking-wide text-fg">FEATURED MARKETS</h2>
        {len > 1 && (
          <div className="flex items-center gap-2">
            <button onClick={prev} aria-label="Previous market" className="pill pill-ghost p-1.5!">
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <span className="font-mono text-[11px] tabular-nums text-muted min-w-12 text-center">
              {clamped + 1} / {len}
            </span>
            <button onClick={next} aria-label="Next market" className="pill pill-ghost p-1.5!">
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      <div className="overflow-hidden">
        <div
          className="flex items-start transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${clamped * 100}%)` }}
        >
          {markets.map((m, i) => (
            <div key={m.id} className="w-full shrink-0" aria-hidden={i !== clamped}>
              <FeaturedCard market={m} />
            </div>
          ))}
        </div>
      </div>

      {len > 1 && (
        <div className="flex justify-center gap-1.5 mt-3">
          {markets.map((m, i) => (
            <button
              key={m.id}
              onClick={() => setIndex(i)}
              aria-label={`Go to featured market ${i + 1}`}
              aria-current={i === clamped}
              className={`h-1.5 rounded-full transition-all ${i === clamped ? "w-5 bg-accent" : "w-1.5 bg-line hover:bg-muted"
                }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
