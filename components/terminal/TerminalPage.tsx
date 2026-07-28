"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import type { ApiMarket, OrderBookData, PricePoint } from "@/lib/markets/types";
import { binaryYesOutcome, rankedOutcomes } from "@/lib/markets/format";
import { getOrderBook, getPriceHistory } from "@/lib/markets/data";
import { useTradeBlips } from "@/lib/markets/useTradeBlips";
import { useMarketRoom, useTokenRoom } from "@/lib/realtime/hooks";
import { usePrefersReducedMotion } from "../landing/usePrefersReducedMotion";
import { Topbar } from "../app/Topbar";
import { rankRows, colorMap } from "./rank";
import { TerminalHero, type LeaderReadout } from "./TerminalHero";
import { RulesPanel } from "./RulesPanel";
import { RelatedMarkets } from "./RelatedMarkets";
import { MarketComments } from "./MarketComments";
import { OracleDesk } from "./oracle/OracleDesk";
import { OutcomesPanel, type TradeSelection } from "./OutcomesPanel";
import { PriceChart } from "./PriceChart";
import { ResolutionPanel } from "./ResolutionPanel";
import { TradePanel } from "./TradePanel";

gsap.registerPlugin(ScrollTrigger, useGSAP);

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
  const [selection, setSelection] = useState<TradeSelection | null>(() => {
    // Binary markets always arm the YES outcome (the No row is a phantom the
    // page hides); otherwise default to the top-priced outcome.
    const top = binaryYesOutcome(market.outcomes) ?? rankedOutcomes(market)[0]?.outcome;
    return top ? { outcomeId: top.id, side: "yes" } : null;
  });
  const binary = binaryYesOutcome(market.outcomes) != null;

  // Live copies of the server-rendered data; socket dirty-signals refresh
  // them through the same REST fetchers the server used.
  const [liveBooks, setLiveBooks] = useState(books);
  const [liveSeries, setLiveSeries] = useState(series);
  const [liveStatus, setLiveStatus] = useState(market.status);
  const [feedNonce, setFeedNonce] = useState(0);

  // Debounced (trailing 250ms): one crossed order produces a burst of
  // dirty-signals (book + activity + user), and a settlement sweep cancels
  // many orders at once — collapse each burst into a single refetch so the
  // middleware's rate limiter isn't chewed through by our own echoes.
  const booksTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seriesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refetchBooks = useCallback(() => {
    if (booksTimer.current) clearTimeout(booksTimer.current);
    booksTimer.current = setTimeout(() => {
      Promise.all(market.outcomes.map((o) => getOrderBook(o.tokenId))).then(
        (next) => setLiveBooks(next),
      );
    }, 250);
  }, [market.outcomes]);

  const refetchSeries = useCallback(() => {
    if (seriesTimer.current) clearTimeout(seriesTimer.current);
    seriesTimer.current = setTimeout(() => {
      Promise.all(market.outcomes.map((o) => getPriceHistory(o.tokenId))).then(
        (next) => setLiveSeries(next),
      );
    }, 250);
  }, [market.outcomes]);

  useEffect(() => {
    return () => {
      if (booksTimer.current) clearTimeout(booksTimer.current);
      if (seriesTimer.current) clearTimeout(seriesTimer.current);
    };
  }, []);

  useTokenRoom(market.outcomes[0]?.tokenId ?? null, refetchBooks);
  useTokenRoom(market.outcomes[1]?.tokenId ?? null, refetchBooks);
  useMarketRoom(market.id, {
    onUpdate: (p) => {
      // kind "book": the token rooms already cover binary markets — only
      // refetch here for >2-outcome markets whose extra tokens have no room.
      // kind "activity": trades landed — series/feeds move, books came via
      // the token signal. No kind: catch-up (mount/reconnect) — refresh all.
      if (p?.kind === "book") {
        if (market.outcomes.length > 2) refetchBooks();
        return;
      }
      if (p?.kind !== "activity") refetchBooks();
      refetchSeries();
      setFeedNonce((n) => n + 1);
    },
    // ACTIVE→ENDED ("resolving") arrives here so the rail swaps TradePanel for
    // ResolutionPanel's "determining winner" state live — no refresh. RESOLVED
    // keeps its own richer event below.
    onStatus: (p) => {
      if (p.status === "ENDED" || p.status === "RESOLVED") setLiveStatus(p.status);
    },
    onResolved: () => setLiveStatus("RESOLVED"),
  });

  // Live fill tape for the chart overlay — feedNonce already ticks on every
  // activity signal (and catch-up), so blips ride the existing refetch cycle.
  const blips = useTradeBlips(market.id, market.outcomes, feedNonce);

  // One ranking, one palette: hero, chart, tower, and ticket all read from it.
  const rows = useMemo(
    () => rankRows(market.outcomes, liveBooks, liveSeries),
    [market.outcomes, liveBooks, liveSeries],
  );
  const colors = useMemo(() => colorMap(rows), [rows]);

  // Expanded tower row — while open, the whole page focuses on it: the hero
  // readout rolls to its chance, and the waves + ticket retint to its color.
  // Auto-expand the first (top-ranked) row on load.
  const [openKey, setOpenKey] = useState<string | null>(
    () => rows[0]?.outcome.id ?? null,
  );

  // Buy/Sell lives here so the trade ticket AND the outcomes-list buttons
  // (Buy Yes/No ↔ Sell Yes/No) stay in lockstep.
  const [action, setAction] = useState<"buy" | "sell">("buy");

  // Hero focus: the expanded row, else the armed selection (so collapsing a
  // row keeps its readout), else the market leader.
  const focusRow =
    (openKey && rows.find((r) => r.outcome.id === openKey)) ||
    (selection && rows.find((r) => r.outcome.id === selection.outcomeId)) ||
    rows[0];
  const leader: LeaderReadout = focusRow
    ? { label: focusRow.outcome.label, pct: focusRow.pct, color: focusRow.color }
    : { label: "—", pct: null, color: "var(--color-accent)" };

  const selectedColor = selection ? colors[selection.outcomeId] : undefined;
  const ticketColor = openKey ? colors[openKey] ?? selectedColor : selectedColor;

  // Expansion and selection stay coupled both ways: expanding a row arms the
  // ticket with YES on that outcome, and picking a side on any row expands
  // that row. Collapsing / deselecting leaves the counterpart in place.
  const handleOpenChange = (key: string | null) => {
    setOpenKey(key);
    if (key) setSelection({ outcomeId: key, side: "yes" });
  };
  const handleSelect = (s: TradeSelection | null) => {
    setSelection(s);
    if (s) setOpenKey(s.outcomeId);
  };

  const scope = useRef<HTMLDivElement>(null);
  const reduceMotion = usePrefersReducedMotion();

  // Landing-style motion: hero elements stagger in on load, panels rise as
  // they enter the viewport. Reduced motion keeps plain, shorter fades.
  useGSAP(
    () => {
      gsap.from("[data-reveal]", {
        opacity: 0,
        y: reduceMotion ? 0 : 24,
        duration: reduceMotion ? 0.3 : 0.7,
        ease: "power2.out",
        stagger: reduceMotion ? 0 : 0.09,
      });
      gsap.utils.toArray<HTMLElement>("[data-rise]").forEach((el) => {
        gsap.from(el, {
          opacity: 0,
          y: reduceMotion ? 0 : 20,
          duration: reduceMotion ? 0.3 : 0.6,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 92%", once: true },
        });
      });
    },
    { scope, dependencies: [reduceMotion] },
  );

  return (
    <div ref={scope} className="dot-grid min-h-screen flex flex-col">
      <Topbar />
      <TerminalHero market={market} leader={leader} />

      <main className="mx-auto max-w-7xl px-3 sm:px-4 pt-8 pb-10 w-full flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-x-6 gap-y-8 items-start">
          {/* Main column */}
          <div className="flex flex-col gap-8 min-w-0">
            <OracleDesk market={{ ...market, status: liveStatus }} />
            <div data-rise>
              <PriceChart
                outcomes={market.outcomes}
                series={liveSeries}
                colors={colors}
                blips={blips}
              />
            </div>
            <div data-rise>
              <OutcomesPanel
                rows={rows}
                selection={selection}
                onSelect={handleSelect}
                openKey={openKey}
                onOpenChange={handleOpenChange}
                binary={binary}
                action={action}
              />
            </div>
            <div data-rise>
              <MarketComments
                marketId={market.id}
                outcomes={market.outcomes}
                refreshNonce={feedNonce}
              />
            </div>
            <div data-rise>
              <RelatedMarkets markets={related} />
            </div>
          </div>

          {/* Rail. On mobile the wrapper dissolves (`contents`) so the trade
              ticket can jump above the chart via `order-first`, while rules
              stay at the bottom; from lg it's the sticky side column again. */}
          <div className="contents lg:flex lg:flex-col lg:gap-8 lg:sticky lg:top-20">
            <div data-rise className="order-first lg:order-none">
              {liveStatus === "ACTIVE" ? (
                <TradePanel
                  market={market}
                  selection={selection}
                  books={liveBooks}
                  accent={ticketColor}
                  binary={binary}
                  action={action}
                  onActionChange={setAction}
                />
              ) : (
                <ResolutionPanel market={{ ...market, status: liveStatus }} />
              )}
            </div>
            <div data-rise>
              <RulesPanel market={market} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
