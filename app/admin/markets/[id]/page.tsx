"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Frame } from "@/components/terminal/Frame";
import { TradingTab } from "@/components/admin/market/TradingTab";
import { centsLabel } from "@/lib/markets/format";
import { getMarketDetail } from "@/lib/admin/data";
import type { MarketDetail } from "@/lib/admin/types";

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "#7fae8b",
  ENDED: "#a89f9c",
  RESOLVED: "#f6dcd4",
  CANCELLED: "#c97a6d",
};

const TABS = ["Overview", "Trading", "Participants", "Resolution"] as const;
type Tab = (typeof TABS)[number];

const EXPLORER = "https://sepolia.etherscan.io/address/";

function Addr({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line/60 py-1.5">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted">{label}</span>
      <a
        href={`${EXPLORER}${value}`}
        target="_blank"
        rel="noreferrer"
        className="truncate font-mono text-[11px] text-fg hover:underline"
        title={value}
      >
        {value.slice(0, 10)}…{value.slice(-6)}
      </a>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line/60 py-1.5">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted">{label}</span>
      <span className="font-mono text-[11px] text-fg">{value}</span>
    </div>
  );
}

function Overview({ m }: { m: MarketDetail }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Frame label="Outcomes" className="p-4">
        <table className="w-full text-left text-sm">
          <thead className="font-mono text-[10px] uppercase tracking-wider text-muted">
            <tr><th className="pb-2 font-normal">Outcome</th><th className="text-right font-normal">Price</th><th className="text-right font-normal">Spread</th><th className="text-right font-normal">OI</th></tr>
          </thead>
          <tbody>
            {m.outcomes.map((o) => (
              <tr key={o.index} className="border-t border-line/60">
                <td className="py-2 text-fg">{o.label}</td>
                <td className="text-right font-mono text-xs tabular-nums text-fg/80">{o.price ? centsLabel(o.price) : "—"}</td>
                <td className="text-right font-mono text-xs tabular-nums text-muted">{o.spread ? centsLabel(o.spread) : "—"}</td>
                <td className="text-right font-mono text-xs tabular-nums text-muted">{o.openInterest ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Frame>

      <Frame label="Lifecycle" className="p-4">
        <Field label="Created" value={new Date(m.createdAt).toLocaleString()} />
        <Field label="Ends" value={new Date(m.endTime).toLocaleString()} />
        {m.resolvedAt ? <Field label="Resolved" value={new Date(m.resolvedAt).toLocaleString()} /> : null}
        {m.disputedAt ? <Field label="Disputed" value={new Date(m.disputedAt).toLocaleString()} /> : null}
        {m.winningOutcome != null ? <Field label="Winning outcome" value={String(m.winningOutcome)} /> : null}
        <Field label="Volume" value={m.volume} />
        <Field label="Fee (bps)" value={String(m.feeBps)} />
        <Field label="Resolution source" value={m.resolutionSource} />
      </Frame>
    </div>
  );
}

function Stub({ name }: { name: string }) {
  return (
    <Frame label={name} className="p-8">
      <p className="text-center font-mono text-xs text-muted">{name} monitoring — coming in a later slice.</p>
    </Frame>
  );
}

export default function MarketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tab, setTab] = useState<Tab>("Overview");

  const { data: m, isLoading, isError } = useQuery({
    queryKey: ["admin-market-detail", id],
    queryFn: () => getMarketDetail(id),
  });

  if (isLoading) return <p className="font-mono text-sm text-muted">Loading market…</p>;
  if (isError || !m) return <p className="font-mono text-sm text-muted">Market not found.</p>;

  const color = STATUS_COLOR[m.status] ?? "#a89f9c";

  return (
    <div className="flex flex-col gap-5">
      <header className="reveal-rise border border-line bg-surface/30 px-5 py-5">
        <Link href="/admin/markets" className="mb-2 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-fg">
          <ChevronLeft size={12} aria-hidden="true" /> Markets
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="font-pixel text-3xl uppercase leading-none tracking-wide text-fg">{m.title}</h1>
          <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color }}>{m.status}</span>
          {m.attention.map((a) => (
            <span key={a} className="border px-1 font-mono text-[9px] uppercase tracking-wider" style={{ color: "#c97a6d", borderColor: "#c97a6d" }}>{a.replace("_", " ")}</span>
          ))}
        </div>
        <p className="mt-1.5 font-mono text-[11px] text-muted">
          {m.resolverType} · {m.category ?? "uncategorized"}
        </p>
        <div className="mt-3">
          <Addr label="Market" value={m.marketAddress} />
          <Addr label="Contract" value={m.contractAddress} />
          <Addr label="Resolution router" value={m.resolutionRouter} />
          {m.conditionId ? <Field label="Condition id" value={`${m.conditionId.slice(0, 12)}…`} /> : null}
        </div>
      </header>

      <div className="flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`cursor-pointer border-b-2 px-4 py-2 font-mono text-[11px] uppercase tracking-wider transition-colors ${
              tab === t ? "border-fg text-fg" : "border-transparent text-muted hover:text-fg"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" ? (
        <Overview m={m} />
      ) : tab === "Trading" ? (
        <TradingTab marketId={id} />
      ) : (
        <Stub name={tab} />
      )}
    </div>
  );
}
