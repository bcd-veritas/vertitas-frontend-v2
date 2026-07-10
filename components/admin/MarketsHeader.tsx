"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useQuery } from "@tanstack/react-query";

import { usePrefersReducedMotion } from "@/components/landing/usePrefersReducedMotion";
import { getAdminStats } from "@/lib/admin/data";
import { BLUE, STATUS_COLOR } from "./statusMeta";
import type { StatsResponse } from "@/lib/admin/types";

const TILES: {
  key: string;
  label: string;
  color: string;
  pick: (s: StatsResponse) => number;
}[] = [
  { key: "", label: "All", color: BLUE, pick: (s) => s.markets.total },
  { key: "ACTIVE", label: "Active", color: STATUS_COLOR.ACTIVE, pick: (s) => s.markets.active },
  { key: "ENDED", label: "Ended", color: STATUS_COLOR.ENDED, pick: (s) => s.markets.ended },
  { key: "RESOLVED", label: "Resolved", color: STATUS_COLOR.RESOLVED, pick: (s) => s.markets.resolved },
  { key: "CANCELLED", label: "Cancelled", color: STATUS_COLOR.CANCELLED, pick: (s) => s.markets.cancelled },
];

/**
 * Census count-up. No ScrollTrigger — the strip is always above the fold,
 * and gating on scroll left the tween frozen at its first frames here.
 */
function CensusValue({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const reduce = usePrefersReducedMotion();

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || reduce) return;
      const counter = { v: 0 };
      el.textContent = "0";
      gsap.to(counter, {
        v: value,
        duration: 0.9,
        ease: "power2.out",
        onUpdate: () => {
          el.textContent = Math.round(counter.v).toLocaleString("en-US");
        },
      });
    },
    { dependencies: [value, reduce], revertOnUpdate: true },
  );

  return (
    <span ref={ref} className="tabular-nums">
      {value.toLocaleString("en-US")}
    </span>
  );
}

/**
 * Markets control-room header: pixel title + live poll indicator, with a
 * status census strip along the bottom. Each census tile is a filter — it
 * drives the board's status query (click again to clear).
 */
export function MarketsHeader({
  status,
  onStatusChange,
}: {
  status: string;
  onStatusChange: (status: string) => void;
}) {
  const { data } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: getAdminStats,
    refetchInterval: 30_000,
  });

  return (
    <header className="reveal-rise relative overflow-hidden border border-line bg-surface/30">
      <div className="dot-grid pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, var(--color-accent), transparent)" }}
        aria-hidden="true"
      />

      <div className="relative flex items-end justify-between gap-4 px-5 pb-4 pt-5">
        <div>
          <h1 className="font-pixel text-4xl uppercase leading-none tracking-wide text-fg">
            Markets
          </h1>
          <p className="mt-1.5 font-mono text-[11px] text-muted">
            Monitor every market — status, liquidity, and what needs attention
          </p>
        </div>
        <div className="flex items-center gap-2 pb-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-yes" aria-hidden="true" />
          Live · 30s
        </div>
      </div>

      <div
        className="relative grid grid-cols-5 divide-x divide-line border-t border-line"
        role="group"
        aria-label="Filter by status"
      >
        {TILES.map((t) => {
          const active = status === t.key;
          const value = data ? t.pick(data) : null;
          return (
            <button
              key={t.key}
              onClick={() => onStatusChange(active ? "" : t.key)}
              aria-pressed={active}
              className={`group relative px-4 py-3 text-left transition-colors ${
                active ? "bg-fg/[0.05]" : "hover:bg-fg/[0.03]"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span
                  className="h-1.5 w-1.5 shrink-0"
                  style={{ background: t.color }}
                  aria-hidden="true"
                />
                <span
                  className={`font-mono text-[10px] uppercase tracking-[0.18em] transition-colors ${
                    active ? "text-fg" : "text-muted group-hover:text-fg"
                  }`}
                >
                  {t.label}
                </span>
              </span>
              <span className="mt-1.5 block font-pixel text-3xl leading-none tabular-nums text-fg">
                {value == null ? <span className="text-muted">—</span> : <CensusValue value={value} />}
              </span>
              <span
                className="absolute inset-x-0 bottom-0 h-0.5 transition-opacity duration-300"
                style={{ background: t.color, opacity: active ? 1 : 0 }}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>
    </header>
  );
}
