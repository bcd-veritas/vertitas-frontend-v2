"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { ApiMarket } from "@/lib/markets/types";
import { PixelLabel } from "../PixelLabel";
import { PixelHeading } from "../../landing/ui/PixelHeading";
import { ExploreRow } from "./ExploreRow";
import {
  EXPLORE_SORTS,
  EXPLORE_STATUSES,
  exploreRows,
  type ExploreSort,
  type ExploreStatus,
} from "./exploreSort";

gsap.registerPlugin(useGSAP);

/** Rows revealed per infinite-scroll step, and the initial window. The whole
 *  list is already in memory — search and the price-derived sorts are only
 *  correct against the full set — so this pages the RENDER, not the API. */
const EXPLORE_BATCH = 50;

/** How many rows the entrance staggers. Roughly a tall viewport's worth —
 *  past that the rows are off screen, and staggering all fifty would run for
 *  two seconds to animate things nobody is looking at. */
const ENTRANCE_ROWS = 16;

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-full px-2.5 py-1.5 font-terminal text-[13px] leading-none uppercase tracking-[0.12em] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        on ? "bg-accent text-bg" : "text-muted hover:bg-white/5 hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}

export function ExploreList({
  markets,
  search,
  onResetSearch,
}: {
  markets: ApiMarket[];
  search: string;
  onResetSearch: () => void;
}) {
  const [sort, setSort] = useState<ExploreSort>("volume");
  const [status, setStatus] = useState<ExploreStatus>("all");

  const rows = useMemo(
    () => exploreRows(markets, { search, sort, status }),
    [markets, search, sort, status],
  );

  // Reveal window. Any change to what's being listed resets it to the first
  // batch — otherwise a search would land you 200 rows deep in 3 results.
  const [visibleCount, setVisibleCount] = useState(EXPLORE_BATCH);
  const filterKey = `${search}|${sort}|${status}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setVisibleCount(EXPLORE_BATCH);
  }
  const visible = rows.slice(0, visibleCount);
  const hasMore = visibleCount < rows.length;

  // One clock for every countdown on the page. Null until mount, because
  // Date.now() during render would not match what the server produced.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const t = setTimeout(tick, 0);
    const i = setInterval(tick, 1000);
    return () => {
      clearTimeout(t);
      clearInterval(i);
    };
  }, []);

  // A sentinel below the list grows the window when scrolled near; rootMargin
  // pre-loads the next batch before it reaches the viewport.
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((c) => Math.min(c + EXPLORE_BATCH, rows.length));
        }
      },
      { rootMargin: "600px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, rows.length]);

  const reset = () => {
    setSort("volume");
    setStatus("all");
    onResetSearch();
  };

  // Entrance. /explore is normally arrived at through the board's tunnel, which
  // scales the whole page up and hands over mid-zoom — so the list settles down
  // to size rather than cutting in, which reads as decelerating out of that
  // rather than as a new effect starting. It stands on its own from a cold URL
  // too. Mount only: rows revealed later by infinite scroll arrive under the
  // pointer already, and animating those would fight the scroll.
  const scope = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      const tl = gsap.timeline({ defaults: { ease: "power2.out" } });

      // Everything overlaps and the whole thing is done by ~1.05s. The tunnel's
      // zoom already spends 0.9s before this page exists, so a leisurely
      // entrance on top of it turns arriving into waiting.
      tl.from(scope.current, {
        opacity: 0,
        scale: 1.03,
        duration: 0.4,
        clearProps: "all",
      }).from(
        "[data-explore-head]",
        { opacity: 0, y: 10, duration: 0.35, stagger: 0.06, clearProps: "all" },
        0,
      );

      const rows = gsap.utils
        .toArray<HTMLElement>("[data-explore-row]")
        .slice(0, ENTRANCE_ROWS);
      if (!rows.length) return;

      tl.from(
        rows,
        { opacity: 0, y: 10, duration: 0.4, stagger: 0.03, clearProps: "all" },
        0.1,
      ).from(
        // The meters wipe open from the left, a beat behind their row. Only the
        // presentation is animated — the flex values in the DOM stay truthful
        // the whole way, so a stalled animation can never show a wrong split.
        rows.map((r) => r.querySelector("[data-explore-meter]")).filter(Boolean),
        {
          scaleX: 0,
          transformOrigin: "left center",
          duration: 0.42,
          stagger: 0.03,
          ease: "power3.out",
          clearProps: "all",
        },
        0.18,
      );
    },
    { scope },
  );

  return (
    <main ref={scope} className="mx-auto w-full max-w-6xl flex-1 px-3 py-8 sm:px-4">
      <div data-explore-head="" className="mb-5 flex flex-wrap items-end justify-between gap-2">
        <PixelHeading as="h1" className="text-3xl sm:text-4xl">
          Every market
        </PixelHeading>
        {/* Built as one string rather than JSX children: a bare `//` in a text
            node reads as a comment to the linter. */}
        <PixelLabel>
          {`${rows.length} market${rows.length === 1 ? "" : "s"} // ${
            EXPLORE_SORTS.find((s) => s.id === sort)!.label
          }`}
        </PixelLabel>
      </div>

      <div data-explore-head="" className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line pb-3">
        <div role="group" aria-label="Sort" className="flex flex-wrap gap-1">
          {EXPLORE_SORTS.map((s) => (
            <Chip key={s.id} on={sort === s.id} onClick={() => setSort(s.id)}>
              {s.label}
            </Chip>
          ))}
        </div>
        <div role="group" aria-label="Status" className="ml-auto flex flex-wrap gap-1">
          {EXPLORE_STATUSES.map((s) => (
            <Chip key={s.id} on={status === s.id} onClick={() => setStatus(s.id)}>
              {s.label}
            </Chip>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-line py-24 text-center">
          <PixelHeading className="text-3xl">No markets found</PixelHeading>
          <PixelLabel>
            {search.trim()
              ? `nothing matching "${search.trim()}"`
              : "try another status"}
          </PixelLabel>
          <button onClick={reset} className="pill pill-ghost mt-2 text-sm">
            Reset filters
          </button>
        </div>
      ) : (
        <>
          {/* The scan guide: a hairline at the meters' midpoint, so an even
              split is legible as a straight column without reading a digit. */}
          <div className="relative">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 hidden w-px bg-accent/15 lg:block"
              style={{ left: "calc(100% - 0.5rem - 2rem - 100px)" }}
            />
            {visible.map((m) => (
              <ExploreRow key={m.id} market={m} now={now} />
            ))}
          </div>

          {hasMore ? (
            <div ref={sentinelRef} className="flex justify-center py-10" aria-hidden="true">
              <span className="flex gap-1.5">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent/60" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent/60 [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent/60 [animation-delay:300ms]" />
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-3 py-8">
              <span aria-hidden="true" className="h-px flex-1 bg-line" />
              <PixelLabel className="tracking-[0.16em]!">
                {`end of list // ${rows.length} market${rows.length === 1 ? "" : "s"}`}
              </PixelLabel>
              <span aria-hidden="true" className="h-px flex-1 bg-line" />
            </div>
          )}
        </>
      )}
    </main>
  );
}
