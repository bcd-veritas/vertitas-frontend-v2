"use client";

import { useEffect, useState } from "react";
import type { ApiMarket } from "@/lib/markets/types";

/** Live local clock — fills after mount (hydration-safe). */
function LocalTime() {
  const [time, setTime] = useState<string | null>(null);
  useEffect(() => {
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    const id = setInterval(tick, 1000);
    const t = setTimeout(tick, 0);
    return () => {
      clearInterval(id);
      clearTimeout(t);
    };
  }, []);
  return <>{time ?? "--:--:--"}</>;
}

function ColHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-fg border-b border-line pb-2 mb-3">
      {children}
    </h3>
  );
}

function LeaderRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline gap-2 py-1 font-mono text-[11px]">
      <span className="text-muted uppercase tracking-[0.1em] shrink-0">{k}</span>
      <span aria-hidden="true" className="flex-1 border-b border-dotted border-line translate-y-[-2px]" />
      <span className="text-fg/80 tabular-nums shrink-0">{v}</span>
    </div>
  );
}

/** Hatched load bar (reference: SYSTEM LOAD VOLUMETRICS). */
function LoadBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="py-1.5">
      <div className="flex justify-between font-mono text-[11px] mb-1">
        <span className="text-muted uppercase tracking-[0.1em]">{label}</span>
        <span className="text-fg/80 tabular-nums">{pct}%</span>
      </div>
      <div className="h-2 w-full border-b border-line/60 relative">
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 text-accent"
          style={{
            width: `${pct}%`,
            backgroundImage:
              "repeating-linear-gradient(45deg, currentColor 0 1.5px, transparent 1.5px 5px)",
          }}
        />
      </div>
    </div>
  );
}

const PROTOCOL_ROWS: [string, string][] = [
  ["ORACLE_FEED", "CHAINLINK"],
  ["FALLBACK", "UMA_VOTE"],
  ["SETTLEMENT", "USDC"],
  ["FEE", "100 BPS"],
  ["DISPUTE_WINDOW", "48H"],
  ["VOTE_QUORUM", "30%"],
];

const EVENT_LOG: [string, string][] = [
  ["14:08:31.470", "ORACLE_SYNC [0x625115]"],
  ["14:08:29.636", "ORDER_FILL [0x83CF6C]"],
  ["14:08:28.636", "MKT_CREATE [0x4EF93D]"],
  ["14:08:26.636", "BOND_POST [0xBBF9D8]"],
  ["14:08:24.637", "VOTE_CAST [0x585867]"],
  ["14:08:22.634", "SETTLE_OK [0xD853DA]"],
];

/** Dot-matrix decorative field (reference: MEMORY MATRIX). */
const MATRIX_CELLS = 112;
const MATRIX_LIT = 20;
// Deterministic initial "lit" cells so SSR and client agree; the random
// walk starts after mount.
const MATRIX_SEED = [3, 11, 17, 26, 38, 44, 57, 63, 71, 82, 96, 104];

function MemoryMatrix() {
  const [lit, setLit] = useState<ReadonlySet<number>>(() => new Set(MATRIX_SEED));

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      setLit((prev) => {
        const next = new Set(prev);
        // Retire a couple of random allocations, light up replacements.
        const current = [...next];
        for (let k = 0; k < 2 && current.length > 0; k++) {
          const idx = current.splice(Math.floor(Math.random() * current.length), 1)[0];
          next.delete(idx);
        }
        while (next.size < MATRIX_LIT) {
          next.add(Math.floor(Math.random() * MATRIX_CELLS));
        }
        return next;
      });
    }, 420);
    return () => clearInterval(id);
  }, []);

  return (
    <div aria-hidden="true" className="grid grid-cols-[repeat(28,1fr)] gap-1.5 w-full max-w-md">
      {Array.from({ length: MATRIX_CELLS }, (_, i) => (
        <span
          key={i}
          // className={`aspect-square rounded-full transition-colors duration-700 ${lit.has(i) ? "bg-accent/80" : "bg-fg/10"
          className={`w-2 h-2 rounded-full transition-colors duration-700 ${lit.has(i) ? "bg-accent/80" : "bg-fg/10"
            }`}
        />
      ))}
    </div>
  );
}

/**
 * Telemetry footer (journal-of-systems style): black band with dot-matrix
 * count + memory matrix, then four dense mono data columns.
 */
export function SystemFooter({ markets }: { markets: ApiMarket[] }) {
  const active = markets.filter((m) => m.status === "ACTIVE");

  const byCategory = new Map<string, { count: number; vol: bigint }>();
  let totalVol = 0n;
  for (const m of markets) {
    const key = m.category ?? "Other";
    const cur = byCategory.get(key) ?? { count: 0, vol: 0n };
    cur.count += 1;
    cur.vol += BigInt(m.volume);
    totalVol += BigInt(m.volume);
    byCategory.set(key, cur);
  }
  const catRows = [...byCategory.entries()].sort((a, b) => (b[1].vol > a[1].vol ? 1 : -1));
  const loadRows = catRows
    .slice(0, 4)
    .map(([cat, { vol }]) => ({
      label: `VOL.${cat.replace(/\s+/g, "_")}`,
      pct: totalVol > 0n ? Math.round(Number((vol * 100n) / totalVol)) : 0,
    }));

  return (
    <footer className="mt-14 border-t border-line" aria-label="System status">
      {/* Band: big count + memory matrix */}
      <div className="bg-[#141010] border-b border-line">
        <div className="mx-auto max-w-7xl px-3 sm:px-4 py-8 flex flex-col md:flex-row md:items-center gap-8">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2">
              markets.online
            </p>
            <p className="font-pixel text-7xl sm:text-8xl leading-none text-fg tabular-nums">
              {active.length}
            </p>
          </div>
          <div className="md:ml-auto md:text-right">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-3">
              memory matrix <span className="text-fg/60">{`// allocated ${markets.length * 292}`}</span>
            </p>
            <MemoryMatrix />
          </div>
        </div>
      </div>

      {/* Meta strip */}
      <div className="border-b border-line">
        <div className="mx-auto max-w-7xl px-3 sm:px-4 py-3 grid grid-cols-2 sm:grid-cols-3 gap-4 font-mono text-[11px]">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted">system operation</p>
            <p className="text-fg/80 mt-0.5">VERITAS // MARKETS</p>
          </div>
          <div className="hidden sm:block sm:text-center">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted">active protocol</p>
            <p className="text-fg/80 mt-0.5">TRUTH.ENGINE_V1</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted">local time</p>
            <p className="text-fg/80 mt-0.5 tabular-nums">
              <LocalTime />
            </p>
          </div>
        </div>
      </div>

      {/* Data columns */}
      <div className="mx-auto max-w-7xl px-3 sm:px-4 py-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-10 gap-y-8">
        <div>
          <ColHeading>markets // index</ColHeading>
          {catRows.map(([cat, { count }]) => (
            <LeaderRow key={cat} k={cat} v={String(count)} />
          ))}
          <LeaderRow k="TOTAL" v={String(markets.length)} />
        </div>

        <div>
          <ColHeading>protocol // config</ColHeading>
          {PROTOCOL_ROWS.map(([k, v]) => (
            <LeaderRow key={k} k={k} v={v} />
          ))}
        </div>

        <div>
          <ColHeading>volume // load</ColHeading>
          {loadRows.map((r) => (
            <LoadBar key={r.label} label={r.label} pct={r.pct} />
          ))}
        </div>

        <div>
          <ColHeading>event log // trace</ColHeading>
          {EVENT_LOG.map(([t, msg]) => (
            <div key={t} className="flex justify-between gap-3 py-1 font-mono text-[11px]">
              <span className="text-muted tabular-nums shrink-0">{t}</span>
              <span className="text-fg/70 truncate">{msg}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto max-w-7xl px-3 sm:px-4 py-4 flex flex-wrap justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          <span>© 2026 veritas — prediction markets</span>
          <span>built on-chain // settled by truth</span>
        </div>
      </div>
    </footer>
  );
}
