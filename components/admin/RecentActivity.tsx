"use client";

import { useQuery } from "@tanstack/react-query";

import { Frame } from "@/components/terminal/Frame";
import { formatVol } from "@/lib/markets/format";
import { getRecentMarkets } from "@/lib/admin/data";

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "#7fae8b",
  ENDED: "#a89f9c",
  RESOLVED: "#f6dcd4",
  CANCELLED: "#c97a6d",
};

export function RecentActivity() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-recent-markets"],
    queryFn: () => getRecentMarkets(8),
    refetchInterval: 30_000,
  });

  return (
    <Frame label="Newest Markets" className="h-full p-4">
      {isLoading || !data ? (
        <p className="font-mono text-xs text-muted">Loading…</p>
      ) : data.items.length === 0 ? (
        <p className="font-mono text-xs text-muted">Nothing yet.</p>
      ) : (
        <ul className="flex flex-col">
          {data.items.map((m, i) => {
            const color = STATUS_COLOR[m.status] ?? "#a89f9c";
            return (
              <li
                key={m.id}
                className="group flex items-center gap-3 border-t border-line/60 py-2.5 first:border-t-0"
              >
                <span className="font-mono text-[10px] tabular-nums text-muted/60">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: color }}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate text-sm text-fg transition-colors group-hover:text-accent">
                  {m.title}
                </span>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted">
                  {formatVol(m.volume)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Frame>
  );
}
