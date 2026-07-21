"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

import type { ApiOutcome, MarketHolder, MarketTrade } from "@/lib/markets/types";
import { getMarketTrades, getTopHolders } from "@/lib/markets/data";
import { Frame } from "./Frame";
import { HoldersList } from "./discussion/HoldersList";
import { ActivityList } from "./discussion/ActivityList";
import { YourPosition } from "./discussion/YourPosition";
import { CommentsPanel } from "./discussion/comments/CommentsPanel";

type TabId = "comments" | "holders" | "activity" | "yours";
const TABS: { id: TabId; label: string }[] = [
  { id: "comments", label: "Comments" },
  { id: "holders", label: "Top Holders" },
  { id: "activity", label: "Activity" },
];

/** The market DISCUSSION panel: a thin tab switcher over Comments (live CRUD),
 *  Top Holders, Activity, and the connected wallet's own position. Each tab
 *  owns its own data; this component only routes between them. */
export function MarketComments({
  marketId,
  outcomes,
  refreshNonce = 0,
}: {
  marketId: string;
  outcomes: ApiOutcome[];
  /** Ticks on realtime market-activity signals — refetches the open tab. */
  refreshNonce?: number;
}) {
  const { isConnected } = useAccount();
  const [tab, setTab] = useState<TabId>("comments");
  const [holders, setHolders] = useState<MarketHolder[] | null>(null);
  const [trades, setTrades] = useState<MarketTrade[] | null>(null);

  const labelFor = (index: number) =>
    outcomes.find((o) => o.index === index)?.label ?? `#${index}`;

  // "Your Position" only makes sense with a connected wallet.
  const tabs: { id: TabId; label: string }[] = isConnected
    ? [...TABS, { id: "yours", label: "Your Position" }]
    : TABS;

  // Holders/activity fetch lazily on first visit to their tab (and refetch on
  // every revisit — cheap, and the data goes stale as trades land). The
  // refreshNonce dep re-pulls an OPEN tab when the socket layer signals
  // market activity, so trades landing while you watch appear live.
  useEffect(() => {
    if (tab !== "holders") return;
    let alive = true;
    getTopHolders(marketId)
      .then((r) => alive && setHolders(r.items))
      .catch(() => alive && setHolders([]));
    return () => {
      alive = false;
    };
  }, [tab, marketId, refreshNonce]);

  useEffect(() => {
    if (tab !== "activity") return;
    let alive = true;
    getMarketTrades(marketId)
      .then((t) => alive && setTrades(t))
      .catch(() => alive && setTrades([]));
    return () => {
      alive = false;
    };
  }, [tab, marketId, refreshNonce]);

  return (
    <Frame label="DISCUSSION" ariaLabel="Market discussion">
      <div role="tablist" aria-label="Sections" className="flex items-center gap-1 px-4 border-b border-line">
        {tabs.map(({ id, label }) => {
          const on = tab === id;
          return (
            <button
              key={id}
              role="tab"
              aria-selected={on}
              onClick={() => setTab(id)}
              className={`relative px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors ${
                on ? "text-fg" : "text-muted hover:text-fg/80"
              }`}
            >
              {label}
              {on && (
                <span aria-hidden="true" className="absolute -bottom-px left-2 right-2 h-[2px] bg-accent" />
              )}
            </button>
          );
        })}
      </div>

      <div className="px-5 py-2">
        {tab === "comments" && <CommentsPanel marketId={marketId} />}
        {tab === "holders" && <HoldersList holders={holders} labelFor={labelFor} />}
        {tab === "activity" && <ActivityList trades={trades} labelFor={labelFor} />}
        {tab === "yours" && <YourPosition marketId={marketId} labelFor={labelFor} />}
      </div>
    </Frame>
  );
}
