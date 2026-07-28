"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { ApiMarket } from "@/lib/markets/types";
import { getMarkets } from "@/lib/markets/data";
import { MarketCard } from "./MarketCard";
import { MonoLabel } from "../landing/ui/MonoLabel";
import { PixelHeading } from "../landing/ui/PixelHeading";

gsap.registerPlugin(useGSAP);

type StatusFilter = "all" | "active" | "resolving" | "resolved";
const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "resolving", label: "Resolving" },
  { id: "resolved", label: "Resolved" },
];
/** Filter id → the market status it matches (ENDED = resolving, awaiting the
 *  oracle outcome). "all" applies no status filter. */
const STATUS_MATCH: Record<
  Exclude<StatusFilter, "all">,
  ApiMarket["status"]
> = {
  active: "ACTIVE",
  resolving: "ENDED",
  resolved: "RESOLVED",
};

const statusRank = (m: ApiMarket) => (m.status === "ACTIVE" ? 0 : 1);

/** Cards revealed per infinite-scroll step (and the initial window). */
const MARKETS_BATCH = 12;

const CATEGORY_COLORS: Record<string, { text: string; inactive: string; bg: string }> = {
  "all": { text: "text-accent", inactive: "text-accent/40 hover:text-accent", bg: "bg-accent" },
  "crypto": { text: "text-orange-400", inactive: "text-orange-400/40 hover:text-orange-400", bg: "bg-orange-400" },
  "politics": { text: "text-red-400", inactive: "text-red-400/40 hover:text-red-400", bg: "bg-red-400" },
  "sports": { text: "text-emerald-400", inactive: "text-emerald-400/40 hover:text-emerald-400", bg: "bg-emerald-400" },
  "macro": { text: "text-blue-400", inactive: "text-blue-400/40 hover:text-blue-400", bg: "bg-blue-400" },
  "equities": { text: "text-violet-400", inactive: "text-violet-400/40 hover:text-violet-400", bg: "bg-violet-400" },
  "tech": { text: "text-cyan-400", inactive: "text-cyan-400/40 hover:text-cyan-400", bg: "bg-cyan-400" },
};
function catColor(c: string | null) {
  return CATEGORY_COLORS[c?.toLowerCase() ?? ""] ?? { text: "text-accent", inactive: "text-accent/40 hover:text-accent", bg: "bg-accent" };
}

export function MarketBoard({
  categories,
  markets,
  search,
  onResetSearch,
}: {
  categories: string[]
  markets: ApiMarket[];
  search: string;
  onResetSearch: () => void;
}) {
  const [category, setCategory] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [boardMarkets, setBoardMarkets] = useState<ApiMarket[]>(markets);
  const [loading, setLoading] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const reqId = useRef(0);

  const marketCategories = useMemo(() => {
    // const present = new Set(markets.map((m) => m.category).filter(Boolean) as string[]);
    return ["All", ...categories];
  }, [categories]);

  const selectCategory = (c: string) => {
    if (c === category) return;
    setCategory(c);
    const id = ++reqId.current;
    setLoading(true);
    getMarkets(c === "All" ? undefined : c)
      .then((data) => {
        if (reqId.current === id) setBoardMarkets(data);
      })
      .catch(() => {
        if (reqId.current === id) setBoardMarkets([]);
      })
      .finally(() => {
        if (reqId.current === id) setLoading(false);
      });
  };

  const filtered = useMemo(() => {
    let list = boardMarkets.filter((m) => !m.isFeatured);
    if (statusFilter !== "all") {
      const target = STATUS_MATCH[statusFilter];
      list = list.filter((m) => m.status === target);
    }
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((m) => m.title.toLowerCase().includes(q));
    // Live markets first, then by traded volume (within any active filter the
    // status is uniform, so this is just a volume sort).
    return [...list].sort((a, b) => {
      const rank = statusRank(a) - statusRank(b);
      if (rank !== 0) return rank;
      const d = BigInt(b.volume) - BigInt(a.volume);
      return d > 0n ? 1 : d < 0n ? -1 : 0;
    });
  }, [boardMarkets, search, statusFilter]);

  // Infinite scroll — reveal the client-filtered list in batches instead of
  // rendering every card at once. Search / sort / category stay client-side, so
  // we grow a slice of `filtered` rather than fetching pages; any filter change
  // resets the window to the first batch.
  const [visibleCount, setVisibleCount] = useState(MARKETS_BATCH);
  const filterKey = `${category}|${statusFilter}|${search}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setVisibleCount(MARKETS_BATCH);
  }
  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  // A sentinel below the grid bumps the window when scrolled near; rootMargin
  // pre-loads the next batch before it reaches the viewport. Re-armed whenever
  // the match count changes so the closure's length stays current.
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((c) => Math.min(c + MARKETS_BATCH, filtered.length));
        }
      },
      { rootMargin: "600px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, filtered.length]);

  // One-time entrance stagger (not on re-filter).
  useGSAP(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.from(".market-card", {
      opacity: 0,
      y: 16,
      duration: 0.5,
      stagger: 0.05,
      ease: "power2.out",
      clearProps: "all",
    });
  }, { scope: gridRef });

  const reset = () => {
    selectCategory("All");
    setStatusFilter("all");
    onResetSearch();
  };

  return (
    <main className="mx-auto max-w-7xl px-3 sm:px-4 py-8 w-full flex-1">
      {/* Section header — names the board so it reads as its own section. */}
      <div className="flex flex-wrap items-end justify-between gap-2 mb-5">
        <PixelHeading className="text-3xl sm:text-4xl">All Markets</PixelHeading>
        <MonoLabel>browse // filter // sort</MonoLabel>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-line pb-0 mb-6">
        <div role="tablist" aria-label="Category" className="flex flex-wrap items-center">
          {marketCategories.map((c) => {
            const on = category === c;
            return (
              <button
                key={c}
                role="tab"
                aria-selected={on}
                onClick={() => selectCategory(c)}
                className={`relative px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded-t ${on ? catColor(c).text : catColor(c).inactive
                  }`}
              >
                {c}
                {on && (
                  <span
                    aria-hidden="true"
                    className={`absolute -bottom-px left-2 right-2 h-0.5 rounded-full ${catColor(c).bg}`}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-1 pb-2">
          <MonoLabel className="mr-2 hidden sm:inline">status //</MonoLabel>
          {STATUS_FILTERS.map(({ id, label }) => {
            const on = statusFilter === id;
            return (
              <button
                key={id}
                onClick={() => setStatusFilter(id)}
                aria-pressed={on}
                className={`px-2.5 py-1 rounded-md border font-mono text-[11px] uppercase tracking-[0.14em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${on ? "bg-accent text-bg border-accent font-semibold" : "border-fg/20 bg-fg/[0.04] text-muted hover:text-fg/90 hover:border-fg/45 hover:bg-fg/8"
                  }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Count */}
      <MonoLabel className="block mb-5">
        {loading
          ? "loading //"
          : `${filtered.length} market${filtered.length === 1 ? "" : "s"} // ${statusFilter === "all" ? "shown" : statusFilter}`}
      </MonoLabel>

      {!loading && filtered.length === 0 ? (
        <div className="border border-line rounded-xl py-24 flex flex-col items-center gap-4 text-center">
          <PixelHeading className="text-3xl">No markets found</PixelHeading>
          <MonoLabel>try another category or search term</MonoLabel>
          <button onClick={reset} className="pill pill-ghost mt-2 text-sm">
            Reset filters
          </button>
        </div>
      ) : (
        <div
          ref={gridRef}
          className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 transition-opacity ${loading ? "opacity-40 pointer-events-none" : "opacity-100"
            }`}
        >
          {visible.map((m) => (
            <MarketCard key={m.id} market={m} />
          ))}
        </div>
      )}

      {/* Infinite-scroll sentinel — pulses while more cards remain to reveal. */}
      {!loading && hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-10" aria-hidden="true">
          <span className="flex gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-accent/60 animate-pulse" />
            <span className="h-1.5 w-1.5 rounded-full bg-accent/60 animate-pulse [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 rounded-full bg-accent/60 animate-pulse [animation-delay:300ms]" />
          </span>
        </div>
      )}
    </main>
  );
}
