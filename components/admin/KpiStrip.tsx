"use client";

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { CountUp } from "@/components/profile/CountUp";
import { getAdminStats } from "@/lib/admin/data";

function KpiCard({
  label,
  value,
  sub,
  accent,
  delay,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent: string;
  delay: number;
}) {
  return (
    <div
      className="reveal-rise group relative overflow-hidden border border-line bg-surface/40 p-4"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* corner ticks in the card's accent */}
      <span
        className="absolute -left-px -top-px h-2.5 w-2.5 border-l-2 border-t-2"
        style={{ borderColor: accent }}
        aria-hidden="true"
      />
      <span
        className="absolute -right-px -top-px h-2.5 w-2.5 border-r-2 border-t-2"
        style={{ borderColor: accent }}
        aria-hidden="true"
      />
      <div className="flex items-center gap-2">
        <span
          className="h-1.5 w-1.5"
          style={{ background: accent }}
          aria-hidden="true"
        />
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          {label}
        </span>
      </div>
      <div className="mt-3 font-pixel text-[2.75rem] leading-none tabular-nums text-fg">
        {value}
      </div>
      <div className="mt-2 min-h-[16px] font-mono text-[11px] text-muted">
        {sub}
      </div>
      <div
        className="absolute inset-x-0 bottom-0 h-0.5 opacity-50 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: accent }}
        aria-hidden="true"
      />
    </div>
  );
}

export function KpiStrip() {
  const { data } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: getAdminStats,
    refetchInterval: 30_000,
  });

  const dash = <span className="text-muted">—</span>;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <KpiCard
        label="Markets"
        accent="#f6dcd4"
        delay={0}
        value={data ? <CountUp value={data.markets.total} /> : dash}
        sub={
          data
            ? `${data.markets.active} active · ${data.markets.resolved} resolved`
            : null
        }
      />
      <KpiCard
        label="Volume"
        accent="#7FB3FF"
        delay={80}
        value={
          data ? (
            <CountUp value={Number(data.volumeTotal) / 1e6} prefix="$" />
          ) : (
            dash
          )
        }
        sub={data ? "all markets" : null}
      />
      <KpiCard
        label="Trades"
        accent="#7fae8b"
        delay={160}
        value={data ? <CountUp value={data.tradesTotal} /> : dash}
        sub={data ? "matched fills" : null}
      />
      <KpiCard
        label="Users"
        accent="#F6C177"
        delay={240}
        value={data ? <CountUp value={data.usersTotal} /> : dash}
        sub={data ? "registered wallets" : null}
      />
    </div>
  );
}
