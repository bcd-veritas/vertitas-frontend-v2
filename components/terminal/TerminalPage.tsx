"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ApiMarket, OrderBookData, PricePoint } from "@/lib/markets/types";
import { closesLabel, countdown } from "@/lib/markets/format";
import { Topbar } from "../app/Topbar";
import { CategoryIcon } from "../app/categoryIcon";
import { MonoLabel } from "../landing/ui/MonoLabel";
import { RulesPanel } from "./RulesPanel";
import { RelatedMarkets } from "./RelatedMarkets";
import { ComingSoonPanel } from "./ComingSoon";
import { MarketComments } from "./MarketComments";
import { OrderBook } from "./OrderBook";
import { PriceChart } from "./PriceChart";

export function TerminalPage({
  market,
  related,
  books,
  series,
}: {
  market: ApiMarket;
  related: ApiMarket[];
  books: OrderBookData[];
  series: PricePoint[][];
}) {
  const live = market.status === "ACTIVE";

  console.log(market)

  return (
    <div className="dot-grid min-h-screen flex flex-col">
      <Topbar />
      <main className="mx-auto max-w-7xl px-5 sm:px-8 py-6 w-full flex-1">
        {/* Title strip */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-5">
          <Link
            href="/home"
            className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted hover:text-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded"
          >
            <ArrowLeft size={12} aria-hidden="true" /> markets
          </Link>
          <span className="hidden sm:flex items-center gap-1.5">
            <CategoryIcon category={market.category} size={11} />
            <MonoLabel>
              {`mkt.${(market.category ?? "open").replace(/\s+/g, "")} // closes ${closesLabel(market.endTime)}`}
            </MonoLabel>
          </span>
          <span className="ml-auto font-mono text-[11px] tracking-[0.14em] text-accent/80 tabular-nums">
            {live ? <ClientCountdown endTime={market.endTime} /> : "RESOLVING"}
          </span>
        </div>
        <h1 className="text-xl sm:text-2xl font-semibold text-fg leading-snug mb-6">
          {market.title}
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-5 items-start">
          {/* Main column */}
          <div className="flex flex-col gap-5 min-w-0">
            <PriceChart outcomes={market.outcomes} series={series} />
            <OrderBook outcomes={market.outcomes} books={books} />
            <MarketComments marketId={market.id} />
            <RelatedMarkets markets={related} />
          </div>

          {/* Rail */}
          <div className="flex flex-col gap-5 lg:sticky lg:top-20">
            <ComingSoonPanel heading="TRADE" minHeight="min-h-[320px]" />
            <RulesPanel market={market} />
          </div>
        </div>
      </main>
    </div>
  );
}

/** Hydration-safe countdown chip. */
function ClientCountdown({ endTime }: { endTime: string }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setText(countdown(endTime)), 0);
    return () => clearTimeout(t);
  }, [endTime]);
  return <>{text ?? "—"}</>;
}
