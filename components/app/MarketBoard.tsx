"use client";

import { useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { ApiMarket } from "@/lib/markets/types";
import { getMarkets } from "@/lib/markets/data";
import { MarketCard } from "./MarketCard";
import { MonoLabel } from "../landing/ui/MonoLabel";
import { PixelHeading } from "../landing/ui/PixelHeading";

gsap.registerPlugin(useGSAP);

type Sort = "volume" | "closing" | "newest";
const SORTS: { id: Sort; label: string }[] = [
  { id: "volume", label: "Volume" },
  { id: "closing", label: "Closing soon" },
  { id: "newest", label: "Newest" },
];

const statusRank = (m: ApiMarket) => (m.status === "ACTIVE" ? 0 : 1);

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
  const [sort, setSort] = useState<Sort>("volume");
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
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((m) => m.title.toLowerCase().includes(q));
    return [...list].sort((a, b) => {
      const rank = statusRank(a) - statusRank(b);
      if (rank !== 0) return rank;
      switch (sort) {
        case "volume": {
          const d = BigInt(b.volume) - BigInt(a.volume);
          return d > 0n ? 1 : d < 0n ? -1 : 0;
        }
        case "closing":
          return +new Date(a.endTime) - +new Date(b.endTime);
        case "newest":
          return +new Date(b.createdAt) - +new Date(a.createdAt);
      }
    });
  }, [boardMarkets, search, sort]);

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
    onResetSearch();
  };

  return (
    <main className="mx-auto max-w-7xl px-3 sm:px-4 py-8 w-full flex-1">
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
                    className={`absolute -bottom-px left-2 right-2 h-[2px] rounded-full ${catColor(c).bg}`}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-1 pb-2">
          <MonoLabel className="mr-2 hidden sm:inline">sort //</MonoLabel>
          {SORTS.map(({ id, label }) => {
            const on = sort === id;
            return (
              <button
                key={id}
                onClick={() => setSort(id)}
                aria-pressed={on}
                className={`px-2.5 py-1 rounded-md font-mono text-[11px] uppercase tracking-[0.14em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${on ? "bg-accent text-bg font-semibold" : "text-muted hover:text-fg/80"
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
          : `${filtered.length} market${filtered.length === 1 ? "" : "s"} // live`}
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
          {filtered.map((m) => (
            <MarketCard key={m.id} market={m} />
          ))}
        </div>
      )}
    </main>
  );
}
