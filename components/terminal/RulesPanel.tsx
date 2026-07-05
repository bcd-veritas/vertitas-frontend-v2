import type { ApiMarket } from "@/lib/markets/types";

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
    <section className="relative bg-surface/70 border border-line rounded-xl p-5" aria-label="Rules and resolution">
      <span aria-hidden="true" className="absolute top-2.5 right-3 font-mono text-muted/40 text-xs select-none">+</span>
      <h2 className="font-pixel text-xl tracking-wide text-fg mb-3">RULES // RESOLUTION</h2>
      {market.description && (
        <p className="text-sm text-muted leading-relaxed mb-4">{market.description}</p>
      )}
      <LeaderRow k="status" v={market.status} />
      <LeaderRow k="resolution_source" v={trunc(market.resolutionSource, 18, 8)} />
      <LeaderRow k="condition_id" v={trunc(market.conditionId)} />
      <LeaderRow k="tick_size" v="1¢" />
      <LeaderRow k="min_order" v="1 SHARE" />
      <LeaderRow k="fee" v={`${market.feeBps} BPS`} />
      <LeaderRow k="settlement" v="USDC" />
      <LeaderRow k="outcomes" v={`${market.outcomes.length} (BINARY)`} />
      <LeaderRow k="market_id" v={trunc(market.id, 8, 4)} />
    </section>
  );
}
