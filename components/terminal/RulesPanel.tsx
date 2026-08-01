import type { ApiMarket } from "@/lib/markets/types";
import { oneDp } from "@/lib/markets/format";
import { Frame } from "./Frame";

function trunc(v: string | null, head = 10, tail = 6): string {
  if (!v) return "—";
  return v.length <= head + tail ? v : `${v.slice(0, head)}…${v.slice(-tail)}`;
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

export function RulesPanel({ market }: { market: ApiMarket }) {
  return (
    <Frame label="RULES // RESOLUTION" ariaLabel="Rules and resolution">
      <div className="px-5 pb-5 pt-1">
      {market.description && (
        <p className="text-sm text-muted leading-relaxed mb-4">{market.description}</p>
      )}
      <LeaderRow k="status" v={market.status} />
      <LeaderRow k="resolution_source" v={trunc(market.resolutionSource, 18, 8)} />
      <LeaderRow k="condition_id" v={trunc(market.conditionId)} />
      <LeaderRow k="tick_size" v={`${oneDp(Number(market.tickSize) / 10_000)}¢`} />
      <LeaderRow
        k="min_order"
        v={`${oneDp(Number(market.minOrderSize) / 1_000_000)} ${Number(market.minOrderSize) === 1_000_000 ? "SHARE" : "SHARES"}`}
      />
      <LeaderRow k="fee" v={`${market.feeBps} BPS`} />
      <LeaderRow k="settlement" v="VTK" />
      <LeaderRow
        k="outcomes"
        v={`${market.outcomes.length} (${market.outcomes.length === 2 ? "BINARY" : "MULTI"})`}
      />
      <LeaderRow k="market_id" v={trunc(market.id, 8, 4)} />
      </div>
    </Frame>
  );
}
