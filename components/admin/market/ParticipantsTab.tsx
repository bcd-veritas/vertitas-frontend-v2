"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Frame } from "@/components/terminal/Frame";
import { centsLabel, sharesLabel } from "@/lib/markets/format";
import { getTopHolders } from "@/lib/markets/data";
import type { MarketHolder } from "@/lib/markets/types";
import type { MarketDetail } from "@/lib/admin/types";

function short(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function ParticipantsTab({ market }: { market: MarketDetail }) {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-holders", market.id, page],
    queryFn: () => getTopHolders(market.id, page, 20),
    refetchInterval: 30_000,
  });

  const labelFor = (index: number) =>
    market.outcomes.find((o) => o.index === index)?.label ?? `#${index}`;

  return (
    <div className="flex flex-col gap-5">
      <Frame label="Open interest" className="p-4">
        <div className="flex flex-wrap gap-6">
          {market.outcomes.map((o) => (
            <div key={o.index}>
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted">{o.label}</div>
              <div className="font-mono text-sm tabular-nums text-fg">
                {o.openInterest ? sharesLabel(o.openInterest) : "—"}
              </div>
            </div>
          ))}
          <div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted">Holders</div>
            <div className="font-mono text-sm tabular-nums text-fg">{data?.total ?? "—"}</div>
          </div>
        </div>
      </Frame>

      <Frame label="Top holders" className="p-4">
        {isLoading || !data ? (
          <p className="font-mono text-xs text-muted">Loading holders…</p>
        ) : data.items.length === 0 ? (
          <p className="font-mono text-xs text-muted">No holders yet.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="font-mono text-[10px] uppercase tracking-wider text-muted">
                  <tr>
                    <th className="pb-2 pr-2 font-normal">#</th>
                    <th className="px-2 font-normal">Holder</th>
                    <th className="px-2 font-normal">Side</th>
                    <th className="px-2 text-right font-normal">Shares</th>
                    <th className="pl-2 text-right font-normal">Avg cost</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((h: MarketHolder, i: number) => (
                    <tr key={h.id} className="border-t border-line/60">
                      <td className="py-1.5 pr-2 font-mono text-[11px] text-muted">
                        {(page - 1) * 20 + i + 1}
                      </td>
                      <td className="px-2 font-mono text-[11px] text-fg" title={h.walletAddress}>
                        {h.user?.username ?? short(h.walletAddress)}
                      </td>
                      <td className="px-2 font-mono text-[10px] uppercase tracking-wider text-fg/80">
                        {labelFor(h.outcomeIndex)}
                      </td>
                      <td className="px-2 text-right font-mono text-xs tabular-nums text-fg/80">
                        {sharesLabel(h.availableAmount)}
                      </td>
                      <td className="pl-2 text-right font-mono text-xs tabular-nums text-muted">
                        {h.averageCost ? centsLabel(h.averageCost) : "—"}
                      </td>
                    </tr>
                  ))}
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
    </div>
  );
}
