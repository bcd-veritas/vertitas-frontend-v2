"use client";

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

function priceLabel(p: string | null) {
  return p ? centsLabel(p) : "—";
}

function Row({ m }: { m: MarketHealth }) {
  const color = STATUS_COLOR[m.status] ?? "#a89f9c";
  return (
    <tr className="border-t border-line/60 transition-colors hover:bg-fg/[0.03]">
      <td className="max-w-0 py-2.5 pr-3">
        <div className="truncate text-fg">{m.title}</div>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span
            className="h-1 w-1 rounded-full"
            style={{ background: color }}
            aria-hidden="true"
          />
          <span
            className="font-mono text-[10px] uppercase tracking-wider"
            style={{ color }}
          >
            {m.status}
          </span>
        </div>
      </td>
      <td className="px-2 text-right font-mono text-xs tabular-nums text-yes">
        {priceLabel(m.yes.price)}
      </td>
      <td className="px-2 text-right font-mono text-xs tabular-nums text-no">
        {priceLabel(m.no.price)}
      </td>
      <td className="px-2 text-right font-mono text-xs tabular-nums text-muted">
        {m.yes.spread ? centsLabel(m.yes.spread) : "—"}
      </td>
      <td className="px-2 text-right font-mono text-xs tabular-nums text-fg/80">
        {formatVol(m.volume)}
      </td>
      <td className="pl-2 text-right font-mono text-xs tabular-nums text-muted">
        {countdown(m.endTime)}
      </td>
    </tr>
  );
}

export function MarketHealthTable() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-markets", 1, 20],
    queryFn: () => getAdminMarkets(1, 20),
    refetchInterval: 30_000,
  });

  return (
    <Frame
      label="Market Health"
      right={
        data ? (
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
            {data.total} total
          </span>
        ) : null
      }
      className="p-4"
    >
      {isLoading || !data ? (
        <p className="font-mono text-xs text-muted">Loading markets…</p>
      ) : data.items.length === 0 ? (
        <p className="font-mono text-xs text-muted">No markets yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-left text-sm">
            <thead className="font-mono text-[10px] uppercase tracking-wider text-muted">
              <tr>
                <th className="w-[42%] pb-2 pr-3 font-normal">Market</th>
                <th className="px-2 text-right font-normal">Yes</th>
                <th className="px-2 text-right font-normal">No</th>
                <th className="px-2 text-right font-normal">Spread</th>
                <th className="px-2 text-right font-normal">Volume</th>
                <th className="pl-2 text-right font-normal">Closes</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((m) => (
                <Row key={m.id} m={m} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Frame>
  );
}
