"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import type {
  ApiOutcome,
  FeaturedComment,
  MarketHolder,
  MarketResolution,
  MarketTrade,
} from "@/lib/markets/types";
import {
  getMarketComments,
  getMarketResolution,
  getMarketTrades,
  getTopHolders,
} from "@/lib/markets/data";
import {
  cancelUserOrder,
  getUserMarketOpenOrders,
  getUserMarketPositions,
  type UserMarketOrder,
  type UserMarketPosition,
} from "@/lib/profile/data";
import { centsLabel, sharesLabel } from "@/lib/markets/format";
import { Frame } from "./Frame";

type TabId = "comments" | "holders" | "activity" | "yours";
const TABS: { id: TabId; label: string }[] = [
  { id: "comments", label: "Comments" },
  { id: "holders", label: "Top Holders" },
  { id: "activity", label: "Activity" },
];

/** Stable UTC date — no relative-time hydration risk. */
function shortDate(iso: string): string {
  return new Date(iso)
    .toLocaleString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
    .toUpperCase();
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="w-7 h-7 rounded-full bg-accent/10 border border-accent/25 flex items-center justify-center font-mono text-[10px] text-accent uppercase shrink-0">
      {name.slice(0, 2)}
    </span>
  );
}

function CommentRow({ c, reply = false }: { c: FeaturedComment; reply?: boolean }) {
  const name = c.user?.username ?? "anon";
  const wallet = c.user?.walletAddress;
  return (
    <div className={`flex gap-3 py-3 ${reply ? "ml-10" : ""}`}>
      <Avatar name={name} />
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[11px] text-muted">
          <span className="text-fg/85">{name}</span>
          {wallet && (
            <>
              <span className="mx-1.5">·</span>
              {`${wallet.slice(0, 6)}…${wallet.slice(-4)}`}
            </>
          )}
          <span className="mx-1.5">·</span>
          {shortDate(c.createdAt)}
        </p>
        <p className="text-sm text-fg/90 mt-1 leading-relaxed">{c.content}</p>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="py-8 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-muted/70">
      {text}
    </p>
  );
}

/** Yes/No chip toned by LABEL (never index) — the project-wide convention. */
function OutcomeChip({ label }: { label: string }) {
  const l = label.trim().toLowerCase();
  const tone =
    l === "yes"
      ? "bg-yes/10 text-yes"
      : l === "no"
        ? "bg-no/10 text-no"
        : "bg-fg/10 text-fg/80";
  return (
    <span className={`px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] shrink-0 ${tone}`}>
      {label}
    </span>
  );
}

function walletShort(w: string): string {
  return `${w.slice(0, 6)}…${w.slice(-4)}`;
}

function HoldersList({
  holders,
  labelFor,
}: {
  holders: MarketHolder[] | null;
  labelFor: (index: number) => string;
}) {
  if (holders === null) return <EmptyState text="loading…" />;
  if (holders.length === 0) return <EmptyState text="no holders yet" />;
  return (
    <div className="divide-y divide-line/50">
      {holders.map((h) => {
        const name = h.user?.username ?? "anon";
        const shares = (
          BigInt(h.availableAmount) + BigInt(h.lockedAmount)
        ).toString();
        return (
          <div key={h.id} className="flex items-center gap-3 py-3">
            <Avatar name={name} />
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[11px] text-fg/85 truncate">
                {name}
                <span className="mx-1.5 text-muted">·</span>
                <span className="text-muted">{walletShort(h.walletAddress)}</span>
              </p>
              <p className="font-mono text-[11px] text-muted mt-0.5">
                avg cost{" "}
                <span className="tabular-nums text-fg/70">
                  {h.averageCost != null ? centsLabel(h.averageCost) : "—"}
                </span>
              </p>
            </div>
            <OutcomeChip label={labelFor(h.outcomeIndex)} />
            <span className="font-mono text-sm tabular-nums text-fg/85 shrink-0">
              {sharesLabel(shares)}
              <span className="text-muted text-[10px] uppercase ml-1">sh</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ActivityList({
  trades,
  labelFor,
}: {
  trades: MarketTrade[] | null;
  labelFor: (index: number) => string;
}) {
  if (trades === null) return <EmptyState text="loading…" />;
  if (trades.length === 0) return <EmptyState text="no trades yet" />;
  return (
    <div className="divide-y divide-line/50">
      {trades.map((t) => (
        <div key={t.id} className="flex items-center gap-3 py-3">
          <OutcomeChip label={labelFor(t.outcomeIndex)} />
          <p className="font-mono text-[11px] text-muted min-w-0 flex-1 truncate">
            <span className="tabular-nums text-fg/85">
              {sharesLabel(t.quantity)}
            </span>{" "}
            sh @{" "}
            <span className="tabular-nums text-fg/85">{centsLabel(t.price)}</span>
            <span className="mx-1.5">·</span>
            {walletShort(t.buyerWallet)}
            <span className="mx-1 text-muted/60">←</span>
            {walletShort(t.sellerWallet)}
          </p>
          <span className="font-mono text-[11px] text-muted shrink-0">
            {shortDate(t.createdAt)}
          </span>
        </div>
      ))}
    </div>
  );
}

/** buy/sell tone for a resting order's side. */
function SideBadge({ side }: { side: "BID" | "ASK" }) {
  const buy = side === "BID";
  return (
    <span
      className={`px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] shrink-0 ${
        buy ? "bg-accent/10 text-accent" : "bg-fg/10 text-fg/70"
      }`}
    >
      {buy ? "buy" : "sell"}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="pt-4 pb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted/70">
      {children}
    </p>
  );
}

/** The connected wallet's stake in THIS market: holdings per outcome + resting
 *  orders (cancellable), plus a resolved banner with winnings. Self-contained —
 *  owns its fetches so the parent stays a thin tab switcher. */
function YourPosition({
  marketId,
  labelFor,
}: {
  marketId: string;
  labelFor: (index: number) => string;
}) {
  const { address, isConnected } = useAccount();
  const [positions, setPositions] = useState<UserMarketPosition[] | null>(null);
  const [orders, setOrders] = useState<UserMarketOrder[] | null>(null);
  const [resolution, setResolution] = useState<MarketResolution | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

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
    getUserMarketPositions(address, marketId).then(
      (p) => alive && setPositions(p),
    );
    getUserMarketOpenOrders(address, marketId).then(
      (o) => alive && setOrders(o),
    );
    getMarketResolution(marketId).then((r) => alive && setResolution(r));
    return () => {
      alive = false;
    };
  }, [address, marketId]);

  async function handleCancel(id: string) {
    if (!address) return;
    setCancelling(id);
    const ok = await cancelUserOrder(id, address);
    setCancelling(null);
    if (!ok) return;
    setOrders((prev) => (prev ? prev.filter((o) => o.id !== id) : prev));
    // Cancelling an ASK returns shares to the position — refresh holdings.
    getUserMarketPositions(address, marketId).then(setPositions);
  }

  if (!isConnected || !address)
    return <EmptyState text="connect wallet to see your position" />;
  if (positions === null || orders === null)
    return <EmptyState text="loading…" />;

  const winningOutcome = resolution?.resolution?.winningOutcome ?? null;
  const resolved = winningOutcome !== null;

  return (
    <div>
      {resolved && (
        <div className="mt-3 flex items-center gap-2 border border-line/70 bg-fg/[0.02] px-3 py-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            resolved
          </span>
          <OutcomeChip label={labelFor(winningOutcome)} />
          <span className="font-mono text-[11px] text-fg/60">won</span>
        </div>
      )}

      <SectionLabel>Holdings</SectionLabel>
      {positions.length === 0 ? (
        <EmptyState
          text={
            resolved
              ? "settled — winnings paid to your balance"
              : "no shares in this market"
          }
        />
      ) : (
        <div className="divide-y divide-line/50">
          {positions.map((p) => {
            const won = resolved && p.outcomeIndex === winningOutcome;
            return (
              <div key={p.outcomeIndex} className="flex items-center gap-3 py-3">
                <OutcomeChip label={labelFor(p.outcomeIndex)} />
                <div className="min-w-0 flex-1" />
                {won && (
                  <span className="font-mono text-[11px] tabular-nums text-yes shrink-0">
                    won ${(Number(p.shares) / 1e8).toFixed(2)}
                  </span>
                )}
                <span className="font-mono text-sm tabular-nums text-fg/85 shrink-0">
                  {sharesLabel(p.shares)}
                  <span className="text-muted text-[10px] uppercase ml-1">sh</span>
                </span>
              </div>
            );
          })}
        </div>
      )}

      <SectionLabel>Open Orders</SectionLabel>
      {orders.length === 0 ? (
        <EmptyState text="no open orders" />
      ) : (
        <div className="divide-y divide-line/50">
          {orders.map((o) => (
            <div key={o.id} className="flex items-center gap-3 py-3">
              <SideBadge side={o.side} />
              <OutcomeChip label={labelFor(o.outcomeIndex)} />
              <p className="font-mono text-[11px] text-muted min-w-0 flex-1 truncate">
                <span className="tabular-nums text-fg/85">
                  {sharesLabel(o.remaining)}
                </span>{" "}
                sh @{" "}
                <span className="tabular-nums text-fg/85">
                  {centsLabel(o.price)}
                </span>
              </p>
              <button
                type="button"
                onClick={() => handleCancel(o.id)}
                disabled={cancelling === o.id}
                className="font-mono text-[10px] uppercase tracking-[0.1em] text-no/80 hover:text-no disabled:opacity-40 transition-colors shrink-0"
              >
                {cancelling === o.id ? "…" : "cancel"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CommentsList({ comments }: { comments: FeaturedComment[] | null }) {
  if (comments === null) {
    return (
      <p className="py-8 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-muted/70">
        loading…
      </p>
    );
  }
  if (comments.length === 0) {
    return (
      <p className="py-8 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-muted/70">
        no comments yet
      </p>
    );
  }
  return (
    <div className="divide-y divide-line/50">
      {comments.map((c) => (
        <div key={c.id}>
          <CommentRow c={c} />
          {c.replies.map((r) => (
            <CommentRow key={r.id} c={r} reply />
          ))}
        </div>
      ))}
    </div>
  );
}

export function MarketComments({
  marketId,
  outcomes,
}: {
  marketId: string;
  outcomes: ApiOutcome[];
}) {
  const { isConnected } = useAccount();
  const [tab, setTab] = useState<TabId>("comments");
  const [comments, setComments] = useState<FeaturedComment[] | null>(null);
  const [holders, setHolders] = useState<MarketHolder[] | null>(null);
  const [trades, setTrades] = useState<MarketTrade[] | null>(null);

  const labelFor = (index: number) =>
    outcomes.find((o) => o.index === index)?.label ?? `#${index}`;

  // "Your Position" only makes sense with a connected wallet.
  const tabs: { id: TabId; label: string }[] = isConnected
    ? [...TABS, { id: "yours", label: "Your Position" }]
    : TABS;

  useEffect(() => {
    let alive = true;
    getMarketComments(marketId)
      .then((c) => alive && setComments(c))
      .catch(() => alive && setComments([]));
    return () => {
      alive = false;
    };
  }, [marketId]);

  // Holders/activity fetch lazily on first visit to their tab (and refetch on
  // every revisit — cheap, and the data goes stale as trades land).
  useEffect(() => {
    if (tab !== "holders") return;
    let alive = true;
    getTopHolders(marketId)
      .then((r) => alive && setHolders(r.items))
      .catch(() => alive && setHolders([]));
    return () => {
      alive = false;
    };
  }, [tab, marketId]);

  useEffect(() => {
    if (tab !== "activity") return;
    let alive = true;
    getMarketTrades(marketId)
      .then((t) => alive && setTrades(t))
      .catch(() => alive && setTrades([]));
    return () => {
      alive = false;
    };
  }, [tab, marketId]);

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
        {tab === "comments" && <CommentsList comments={comments} />}
        {tab === "holders" && <HoldersList holders={holders} labelFor={labelFor} />}
        {tab === "activity" && <ActivityList trades={trades} labelFor={labelFor} />}
        {tab === "yours" && <YourPosition marketId={marketId} labelFor={labelFor} />}
      </div>
    </Frame>
  );
}
