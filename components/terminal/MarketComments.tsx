"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccount } from "wagmi";

import type { ApiOutcome, MarketHolder, MarketTrade, FeaturedComment } from "@/lib/markets/types";
import { getMarketComments, getMarketTradesPage, getTopHolders } from "@/lib/markets/data";
import {
  getUserMarketOpenOrders,
  getUserMarketPositions,
  type UserMarketOrder,
  type UserMarketPosition,
} from "@/lib/profile/data";
import { useUserRoom } from "@/lib/realtime/hooks";
import { Frame } from "./Frame";
import { DiscussionTabs } from "./discussion/DiscussionTabs";
import { HoldersList } from "./discussion/HoldersList";
import { ActivityList } from "./discussion/ActivityList";
import { YourPosition } from "./discussion/YourPosition";
import { CommentsPanel } from "./discussion/comments/CommentsPanel";

export type HolderPosition = { label: string; shares: number };
export type HoldersMap = Map<string, HolderPosition>;

type TabId = "comments" | "holders" | "activity" | "yours";

/** First page of the Activity tape. */
const ACTIVITY_PAGE = 12;

export function MarketComments({
  marketId,
  outcomes,
  refreshNonce = 0,
}: {
  marketId: string;
  outcomes: ApiOutcome[];
  refreshNonce?: number;
}) {
  const { address, isConnected } = useAccount();
  const [tab, setTab] = useState<TabId>("comments");

  const [holders, setHolders] = useState<MarketHolder[] | null>(null);
  const [holderTotal, setHolderTotal] = useState(0);
  const [trades, setTrades] = useState<MarketTrade[] | null>(null);
  const [tradeTotal, setTradeTotal] = useState(0);
  const [comments, setComments] = useState<FeaturedComment[] | null>(null);
  const [positions, setPositions] = useState<UserMarketPosition[] | null>(null);
  const [orders, setOrders] = useState<UserMarketOrder[] | null>(null);

  const labelFor = useCallback(
    (index: number) => outcomes.find((o) => o.index === index)?.label ?? `#${index}`,
    [outcomes],
  );

  // Comments are unaffected by trade activity, and useMarketCommentStream
  // already delivers create/edit/delete/like live — so this fetches once per
  // market, never on refreshNonce (a fill cannot change the comment list).
  useEffect(() => {
    let alive = true;
    getMarketComments(marketId)
      .then((c) => alive && setComments(c))
      .catch(() => alive && setComments([]));
    return () => {
      alive = false;
    };
  }, [marketId]);

  // Mirrors the current trade count without adding `trades` to the effect
  // below's deps (that would re-arm the debounce on every fetch this effect
  // itself causes). Updated after render, same idiom as lib/realtime's
  // useLatest — never touched during render.
  const tradesRef = useRef<MarketTrade[] | null>(null);
  useEffect(() => {
    tradesRef.current = trades;
  }, [trades]);

  const holdersTradesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Holders + trades DO react to market activity (a fill can change either),
  // but refreshNonce ticks 1-2x on cold mount and again on every reconnect —
  // undebounced this burst turns into a request storm and starves the
  // middleware's rate limiter. Mirrors TerminalPage's refetchBooks/refetchSeries:
  // a trailing 250ms debounce via a ref timer, cleared on unmount.
  useEffect(() => {
    let alive = true;
    if (holdersTradesTimer.current) clearTimeout(holdersTradesTimer.current);
    holdersTradesTimer.current = setTimeout(() => {
      getTopHolders(marketId, 1, 20).then((r) => {
        if (!alive) return;
        setHolders(r.items);
        setHolderTotal(r.total);
      });
      // Preserve any pages the user already loaded via "load more" instead of
      // snapping the visible list back to the first page.
      const limit = Math.max(ACTIVITY_PAGE, tradesRef.current?.length ?? 0);
      getMarketTradesPage(marketId, 1, limit).then((r) => {
        if (!alive) return;
        setTrades(r.items);
        setTradeTotal(r.total);
      });
    }, 250);
    return () => {
      alive = false;
      if (holdersTradesTimer.current) clearTimeout(holdersTradesTimer.current);
    };
  }, [marketId, refreshNonce]);

  // The wallet's own stake. Lifted out of YourPosition so the tab bar can show
  // its dot without opening the tab — these are the same two calls that
  // component used to make on first visit, relocated rather than added.
  // Keyed on [address, marketId] only: useUserRoom below already fires on
  // every fill/cancel/settlement for this wallet, so keying this on
  // refreshNonce too would double-fetch on every one of the wallet's own fills.
  useEffect(() => {
    let alive = true;
    if (!address) {
      Promise.resolve().then(() => {
        if (!alive) return;
        setPositions(null);
        setOrders(null);
      });
      return () => {
        alive = false;
      };
    }
    getUserMarketPositions(address, marketId).then((p) => alive && setPositions(p));
    getUserMarketOpenOrders(address, marketId).then((o) => alive && setOrders(o));
    return () => {
      alive = false;
    };
  }, [address, marketId]);

  // Fills, cancels and settlement all signal the wallet's room.
  useUserRoom(isConnected ? address : null, () => {
    if (!address) return;
    getUserMarketPositions(address, marketId).then(setPositions);
    getUserMarketOpenOrders(address, marketId).then(setOrders);
  });

  // One reduction of the holders response, used by the comments list for its
  // position chips — the same fetch serving two tabs, never a second request.
  const holdersMap = useMemo<HoldersMap>(() => {
    const m: HoldersMap = new Map();
    for (const h of holders ?? []) {
      const key = h.walletAddress.toLowerCase();
      const shares =
        Number(BigInt(h.availableAmount) + BigInt(h.lockedAmount)) / 1e6;
      const prev = m.get(key);
      // A wallet can hold both sides; the chip shows the larger holding.
      if (!prev || shares > prev.shares) m.set(key, { label: labelFor(h.outcomeIndex), shares });
    }
    return m;
  }, [holders, labelFor]);

  const hasStake = (positions?.length ?? 0) > 0 || (orders?.length ?? 0) > 0;

  const tabs: { id: string; label: string; count?: number; dot?: boolean }[] = [
    { id: "comments", label: "Comments", count: comments?.length ?? 0 },
    { id: "holders", label: "Top Holders", count: holderTotal },
    { id: "activity", label: "Activity", count: tradeTotal },
    ...(isConnected
      ? [{ id: "yours", label: "Your Position", dot: hasStake }]
      : []),
  ];

  return (
    <Frame label="DISCUSSION" ariaLabel="Market discussion">
      <DiscussionTabs tabs={tabs} active={tab} onSelect={(id) => setTab(id as TabId)} />
      <div className="px-5 py-2">
        {tab === "comments" && (
          <CommentsPanel
            marketId={marketId}
            comments={comments}
            holdersMap={holdersMap}
            onCommentsChange={setComments}
          />
        )}
        {tab === "holders" && <HoldersList holders={holders} outcomes={outcomes} labelFor={labelFor} />}
        {tab === "activity" && (
          <ActivityList
            marketId={marketId}
            trades={trades}
            total={tradeTotal}
            labelFor={labelFor}
            onMore={setTrades}
          />
        )}
        {tab === "yours" && (
          <YourPosition
            marketId={marketId}
            labelFor={labelFor}
            positions={positions}
            orders={orders}
            onOrdersChange={setOrders}
            onPositionsChange={setPositions}
            outcomes={outcomes}
          />
        )}
      </div>
    </Frame>
  );
}
