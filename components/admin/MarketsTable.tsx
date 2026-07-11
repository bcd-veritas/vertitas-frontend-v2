"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, TriangleAlert } from "lucide-react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { Frame } from "@/components/terminal/Frame";
import { centsLabel, countdown, toCents } from "@/lib/markets/format";
import { getAdminMarkets } from "@/lib/admin/data";
import type { MarketHealth } from "@/lib/admin/types";
import { AMBER, ATTENTION_META, RESOLVER_LABEL, STATUS_COLOR } from "./statusMeta";

const RESOLVERS = ["UMA", "CHAINLINK_DATA_FEED", "CHAINLINK_DATA_STREAM", "ADMIN"];
const SORTS = [
  { key: "newest", label: "Newest" },
  { key: "closing", label: "Closing" },
  { key: "volume", label: "Volume" },
];

/** 6-dec USDC BigInt string -> "$31.4M" */
function compactVol(volume: string): string {
  const dollars = Number(BigInt(volume) / 1_000_000n);
  return `$${Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(dollars)}`;
}

/** Spread health: tight books read green, gappy ones red. */
function spreadColor(cents: number): string {
  if (cents <= 5) return "var(--color-yes)";
  if (cents > 15) return "var(--color-no)";
  return "rgba(242, 239, 237, 0.8)";
}

/** Countdown urgency: closing within 24h reads amber, closed goes quiet. */
function closesColor(label: string): string {
  if (label === "CLOSED") return "var(--color-muted)";
  return label.endsWith("D") ? "rgba(242, 239, 237, 0.7)" : AMBER;
}

/** Yes/No prices + a thin consensus split bar (yes-green share vs no-red). */
function ConsensusCell({ m }: { m: MarketHealth }) {
  const yes = m.yes.price ? toCents(m.yes.price) : null;
  return (
    <div className="min-w-[104px]">
      <div className="flex items-center justify-between gap-2 font-mono text-xs tabular-nums">
        <span className="text-yes">{m.yes.price ? centsLabel(m.yes.price) : "—"}</span>
        <span className="text-no">{m.no.price ? centsLabel(m.no.price) : "—"}</span>
      </div>
      <div className="mt-1 flex h-[3px] w-full overflow-hidden bg-fg/10" aria-hidden="true">
        {yes != null && (
          <>
            <span
              className="bg-yes transition-[width] duration-500"
              style={{ width: `${Math.min(100, Math.max(0, yes))}%` }}
            />
            <span className="flex-1 bg-no/70" />
          </>
        )}
      </div>
    </div>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i} className="border-t border-line/60">
          <td className="py-3 pr-3">
            <div className="h-3 animate-pulse bg-fg/10" style={{ width: `${55 + (i % 4) * 10}%` }} />
            <div className="mt-2 h-2 w-24 animate-pulse bg-fg/5" />
          </td>
          <td className="px-2"><div className="h-2.5 w-12 animate-pulse bg-fg/5" /></td>
          <td className="px-2"><div className="ml-auto h-2.5 w-20 animate-pulse bg-fg/5" /></td>
          <td className="px-2"><div className="ml-auto h-2.5 w-8 animate-pulse bg-fg/5" /></td>
          <td className="px-2"><div className="ml-auto h-2.5 w-12 animate-pulse bg-fg/5" /></td>
          <td className="pl-2"><div className="ml-auto h-2.5 w-10 animate-pulse bg-fg/5" /></td>
        </tr>
      ))}
    </>
  );
}

export function MarketsTable({
  status,
  onStatusChange,
}: {
  status: string;
  onStatusChange: (status: string) => void;
}) {
  const [resolverType, setResolverType] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("newest");
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [debouncedCat, setDebouncedCat] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setDebouncedCat(category);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search, category]);

  // Status is owned by the header census strip; new filter -> first page.
  // React-sanctioned "adjust state during render" (same pattern as the
  // terminal's TradePanel/Collapsible) — no effect, no cascading render.
  const [prevStatus, setPrevStatus] = useState(status);
  if (status !== prevStatus) {
    setPrevStatus(status);
    setPage(1);
  }

  const { data, isLoading, isPlaceholderData } = useQuery({
    queryKey: ["admin-markets-list", page, status, resolverType, debouncedCat, sort, debounced],
    queryFn: () =>
      getAdminMarkets(page, 20, {
        status,
        resolverType,
        category: debouncedCat,
        search: debounced,
        sort,
      }),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });

  const attentionCount = (data?.items ?? []).filter((m) => m.attention.length > 0).length;
  const rows = (data?.items ?? []).filter(
    (m) => !attentionOnly || m.attention.length > 0,
  );

  const resetFilters = () => {
    setSearch("");
    setCategory("");
    setResolverType("");
    setSort("newest");
    setAttentionOnly(false);
    setPage(1);
    onStatusChange("");
  };

  const inputCls =
    "border border-line bg-transparent px-3 py-2 font-mono text-[13px] text-fg placeholder:text-muted focus:border-fg focus:outline-none";

  return (
    <Frame
      label="Market board"
      right={
        data ? (
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
            {data.total} total
          </span>
        ) : null
      }
      className="p-4"
    >
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <div className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title…"
            className={`${inputCls} w-56 pl-8`}
          />
        </div>
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Category…"
          className={`${inputCls} w-36`}
        />
        <select
          value={resolverType}
          onChange={(e) => { setResolverType(e.target.value); setPage(1); }}
          className="cursor-pointer border border-line bg-transparent px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-fg focus:border-fg focus:outline-none"
        >
          <option value="">all resolvers</option>
          {RESOLVERS.map((r) => (
            <option key={r} value={r}>{RESOLVER_LABEL[r] ?? r}</option>
          ))}
        </select>

        <div className="flex border border-line" role="group" aria-label="Sort">
          {SORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => { setSort(s.key); setPage(1); }}
              aria-pressed={sort === s.key}
              className={`px-3 py-2 font-mono text-[11px] uppercase tracking-wider transition-colors ${
                sort === s.key ? "bg-fg/10 text-fg" : "text-muted hover:text-fg"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setAttentionOnly((v) => !v)}
          aria-pressed={attentionOnly}
          className={`ml-auto flex items-center gap-2 border px-3 py-2 font-mono text-[11px] uppercase tracking-wider transition-colors active:translate-y-px ${
            attentionOnly
              ? "border-no bg-no/15 text-no"
              : "border-fg/25 bg-fg/[0.04] text-fg/80 hover:border-no/70 hover:bg-no/10 hover:text-no"
          }`}
        >
          <TriangleAlert size={12} className="text-no" aria-hidden="true" />
          Needs attention
          <span
            className={`border px-1.5 leading-tight tabular-nums ${
              attentionOnly ? "border-no/60 bg-no/20" : "border-fg/20 bg-fg/5"
            }`}
          >
            {attentionCount}
          </span>
        </button>
      </div>

      <div
        className={`overflow-x-auto transition-opacity duration-200 ${
          isPlaceholderData ? "opacity-50" : ""
        }`}
      >
        <table className="w-full table-fixed text-left text-sm">
          <thead className="font-mono text-[10px] uppercase tracking-wider text-muted">
            <tr>
              <th className="w-[36%] pb-2 pr-3 font-normal">Market</th>
              <th className="w-[11%] px-2 font-normal">Resolver</th>
              <th className="w-[15%] px-2 font-normal">Yes / No</th>
              <th className="px-2 text-right font-normal">Spread</th>
              <th className="px-2 text-right font-normal">Volume</th>
              <th className="pl-2 text-right font-normal">Closes</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <SkeletonRows />
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="relative my-2 overflow-hidden border border-line/60 py-10 text-center">
                    <div className="dot-grid pointer-events-none absolute inset-0 opacity-30" aria-hidden="true" />
                    <p className="relative font-mono text-xs text-muted">No markets match these filters.</p>
                    <button
                      onClick={resetFilters}
                      className="relative mt-3 border border-line px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted transition-colors hover:border-fg hover:text-fg"
                    >
                      Reset filters
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((m: MarketHealth, i) => {
                const color = STATUS_COLOR[m.status] ?? "#a89f9c";
                const spread = m.yes.spread ? toCents(m.yes.spread) : null;
                const closes = countdown(m.endTime);
                return (
                  <tr
                    key={m.id}
                    className="reveal-rise group border-t border-line/60 transition-colors hover:bg-fg/[0.04]"
                    style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}
                  >
                    <td className="relative max-w-0 py-2.5 pl-2.5 pr-3">
                      <span
                        className="absolute inset-y-[7px] left-0 w-[3px] opacity-60 transition-opacity group-hover:opacity-100"
                        style={{ background: color }}
                        aria-hidden="true"
                      />
                      <Link href={`/admin/markets/${m.id}`} className="block truncate text-fg hover:underline">
                        {m.title}
                      </Link>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color }}>
                          {m.status}
                        </span>
                        {m.category && (
                          <span className="border border-line px-1 font-mono text-[9px] uppercase tracking-wider text-muted">
                            {m.category}
                          </span>
                        )}
                        {m.attention.map((a) => {
                          const meta = ATTENTION_META[a];
                          if (!meta) return null;
                          return (
                            <span
                              key={a}
                              className="border px-1 font-mono text-[9px] uppercase tracking-wider"
                              style={{ color: meta.color, borderColor: meta.color }}
                            >
                              {meta.label}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td
                      className="px-2 font-mono text-[10px] uppercase tracking-wider text-muted"
                      title={m.resolverType}
                    >
                      {RESOLVER_LABEL[m.resolverType] ?? m.resolverType}
                    </td>
                    <td className="px-2">
                      <ConsensusCell m={m} />
                    </td>
                    <td
                      className="px-2 text-right font-mono text-xs tabular-nums"
                      style={{ color: spread == null ? "var(--color-muted)" : spreadColor(spread) }}
                    >
                      {m.yes.spread ? centsLabel(m.yes.spread) : "—"}
                    </td>
                    <td className="px-2 text-right font-mono text-xs tabular-nums text-fg/80">
                      {compactVol(m.volume)}
                    </td>
                    <td
                      className="pl-2 text-right font-mono text-xs tabular-nums"
                      style={{ color: closesColor(closes) }}
                    >
                      {closes}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {data && data.totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-muted">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="border border-line px-2.5 py-1 transition-colors disabled:cursor-default disabled:opacity-40 hover:enabled:border-fg hover:enabled:text-fg"
          >
            Prev
          </button>
          <span>Page {data.page} / {Math.max(1, data.totalPages)}</span>
          <button
            onClick={() => setPage((p) => (data.totalPages > p ? p + 1 : p))}
            disabled={page >= data.totalPages}
            className="border border-line px-2.5 py-1 transition-colors disabled:cursor-default disabled:opacity-40 hover:enabled:border-fg hover:enabled:text-fg"
          >
            Next
          </button>
        </div>
      )}
    </Frame>
  );
}
