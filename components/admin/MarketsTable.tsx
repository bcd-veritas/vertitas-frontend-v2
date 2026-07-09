"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { Frame } from "@/components/terminal/Frame";
import { centsLabel, countdown, formatVol } from "@/lib/markets/format";
import { getAdminMarkets } from "@/lib/admin/data";
import type { MarketHealth } from "@/lib/admin/types";

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "#7fae8b",
  ENDED: "#a89f9c",
  RESOLVED: "#f6dcd4",
  CANCELLED: "#c97a6d",
};

const ATTENTION: Record<string, { label: string; color: string }> = {
  unresolved: { label: "unresolved", color: "#c97a6d" },
  disputed: { label: "disputed", color: "#c97a6d" },
  no_book: { label: "no book", color: "#a89f9c" },
};

const STATUSES = ["ACTIVE", "ENDED", "RESOLVED", "CANCELLED"];
const RESOLVERS = ["UMA", "CHAINLINK_DATA_FEED", "CHAINLINK_DATA_STREAM", "ADMIN"];

function priceLabel(p: string | null) {
  return p ? centsLabel(p) : "—";
}

export function MarketsTable() {
  const [status, setStatus] = useState("");
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

  const { data, isLoading } = useQuery({
    queryKey: ["admin-markets-list", page, status, resolverType, debouncedCat, sort, debounced],
    queryFn: () =>
      getAdminMarkets(page, 20, {
        status,
        resolverType,
        category: debouncedCat,
        search: debounced,
        sort,
      }),
    refetchInterval: 30_000,
  });

  const rows = (data?.items ?? []).filter(
    (m) => !attentionOnly || m.attention.length > 0,
  );

  const selectCls =
    "cursor-pointer border border-line bg-transparent px-2 py-1.5 font-mono text-[10px] uppercase tracking-wider text-fg focus:border-fg focus:outline-none";

  return (
    <Frame
      label="Markets"
      right={
        data ? (
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
            {data.total} total
          </span>
        ) : null
      }
      className="p-4"
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title…"
          className="w-44 border border-line bg-transparent px-3 py-1.5 font-mono text-xs text-fg placeholder:text-muted focus:border-fg focus:outline-none"
        />
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Category…"
          className="w-32 border border-line bg-transparent px-3 py-1.5 font-mono text-xs text-fg placeholder:text-muted focus:border-fg focus:outline-none"
        />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={selectCls}>
          <option value="">all status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={resolverType} onChange={(e) => { setResolverType(e.target.value); setPage(1); }} className={selectCls}>
          <option value="">all resolvers</option>
          {RESOLVERS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} className={selectCls}>
          <option value="newest">newest</option>
          <option value="closing">closing soon</option>
          <option value="volume">volume</option>
        </select>
        <button
          onClick={() => setAttentionOnly((v) => !v)}
          className={`cursor-pointer border px-2 py-1.5 font-mono text-[10px] uppercase tracking-wider ${
            attentionOnly ? "border-fg bg-fg/10 text-fg" : "border-line text-muted hover:text-fg"
          }`}
        >
          needs attention
        </button>
      </div>

      {isLoading || !data ? (
        <p className="font-mono text-xs text-muted">Loading markets…</p>
      ) : rows.length === 0 ? (
        <p className="font-mono text-xs text-muted">No markets match.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left text-sm">
              <thead className="font-mono text-[10px] uppercase tracking-wider text-muted">
                <tr>
                  <th className="w-[38%] pb-2 pr-3 font-normal">Market</th>
                  <th className="px-2 font-normal">Resolver</th>
                  <th className="px-2 text-right font-normal">Yes</th>
                  <th className="px-2 text-right font-normal">No</th>
                  <th className="px-2 text-right font-normal">Volume</th>
                  <th className="pl-2 text-right font-normal">Closes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m: MarketHealth) => {
                  const color = STATUS_COLOR[m.status] ?? "#a89f9c";
                  return (
                    <tr key={m.id} className="border-t border-line/60 transition-colors hover:bg-fg/[0.03]">
                      <td className="max-w-0 py-2.5 pr-3">
                        <Link href={`/admin/markets/${m.id}`} className="block truncate text-fg hover:underline">
                          {m.title}
                        </Link>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span className="h-1 w-1 rounded-full" style={{ background: color }} aria-hidden="true" />
                          <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color }}>
                            {m.status}
                          </span>
                          {m.attention.map((a) => {
                            const meta = ATTENTION[a];
                            if (!meta) return null;
                            return (
                              <span key={a} className="border px-1 font-mono text-[9px] uppercase tracking-wider" style={{ color: meta.color, borderColor: meta.color }}>
                                {meta.label}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-2 font-mono text-[10px] uppercase tracking-wider text-muted">{m.resolverType}</td>
                      <td className="px-2 text-right font-mono text-xs tabular-nums text-yes">{priceLabel(m.yes.price)}</td>
                      <td className="px-2 text-right font-mono text-xs tabular-nums text-no">{priceLabel(m.no.price)}</td>
                      <td className="px-2 text-right font-mono text-xs tabular-nums text-fg/80">{formatVol(m.volume)}</td>
                      <td className="pl-2 text-right font-mono text-xs tabular-nums text-muted">{countdown(m.endTime)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-muted">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="cursor-pointer border border-line px-2 py-1 disabled:cursor-default disabled:opacity-40 hover:enabled:border-fg hover:enabled:text-fg"
            >
              Prev
            </button>
            <span>Page {data.page} / {Math.max(1, data.totalPages)}</span>
            <button
              onClick={() => setPage((p) => (data.totalPages > p ? p + 1 : p))}
              disabled={page >= data.totalPages}
              className="cursor-pointer border border-line px-2 py-1 disabled:cursor-default disabled:opacity-40 hover:enabled:border-fg hover:enabled:text-fg"
            >
              Next
            </button>
          </div>
        </>
      )}
    </Frame>
  );
}
