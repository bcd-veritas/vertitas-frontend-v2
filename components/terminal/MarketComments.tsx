"use client";

import { useEffect, useState } from "react";
import type { FeaturedComment } from "@/lib/markets/types";
import { getMarketComments } from "@/lib/markets/data";
import { ComingSoonBody } from "./ComingSoon";

type TabId = "comments" | "holders" | "activity";
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

export function MarketComments({ marketId }: { marketId: string }) {
  const [tab, setTab] = useState<TabId>("comments");
  const [comments, setComments] = useState<FeaturedComment[] | null>(null);

  useEffect(() => {
    let alive = true;
    getMarketComments(marketId)
      .then((c) => alive && setComments(c))
      .catch(() => alive && setComments([]));
    return () => {
      alive = false;
    };
  }, [marketId]);

  return (
    <section className="relative bg-surface/70 border border-line rounded-xl" aria-label="Market discussion">
      <span aria-hidden="true" className="absolute top-2.5 right-3 font-mono text-muted/40 text-xs select-none">+</span>
      <div role="tablist" aria-label="Sections" className="flex items-center gap-1 px-4 pt-2 border-b border-line">
        {TABS.map(({ id, label }) => {
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
                <span aria-hidden="true" className="absolute -bottom-px left-2 right-2 h-[2px] bg-accent rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      <div className="px-5 py-2">
        {tab === "comments" && <CommentsList comments={comments} />}
        {tab === "holders" && <ComingSoonBody />}
        {tab === "activity" && <ComingSoonBody />}
      </div>
    </section>
  );
}
