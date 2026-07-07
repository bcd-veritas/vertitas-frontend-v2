"use client";

import { useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import type { ApiMarket, OrderBookData, PricePoint } from "@/lib/markets/types";
import { binaryYesOutcome, rankedOutcomes } from "@/lib/markets/format";
import { usePrefersReducedMotion } from "../landing/usePrefersReducedMotion";
import { Topbar } from "../app/Topbar";
import { rankRows, colorMap } from "./rank";
import { TerminalHero, type LeaderReadout } from "./TerminalHero";
import { RulesPanel } from "./RulesPanel";
import { RelatedMarkets } from "./RelatedMarkets";
import { MarketComments } from "./MarketComments";
import { OutcomesPanel, type TradeSelection } from "./OutcomesPanel";
import { PriceChart } from "./PriceChart";
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

  // Expanded tower row — while open, the whole page focuses on it: the hero
  // readout rolls to its chance, and the waves + ticket retint to its color.
  const [openKey, setOpenKey] = useState<string | null>(null);

  // One ranking, one palette: hero, chart, tower, and ticket all read from it.
  const rows = useMemo(
    () => rankRows(market.outcomes, books, series),
    [market.outcomes, books, series],
  );
  const colors = useMemo(() => colorMap(rows), [rows]);

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
            <div data-rise>
              <PriceChart outcomes={market.outcomes} series={series} colors={colors} />
            </div>
            <div data-rise>
              <OutcomesPanel
                rows={rows}
                selection={selection}
                onSelect={handleSelect}
                openKey={openKey}
                onOpenChange={handleOpenChange}
                binary={binary}
              />
            </div>
            <div data-rise>
              <MarketComments marketId={market.id} />
            </div>
            <div data-rise>
              <RelatedMarkets markets={related} />
            </div>
          </div>

          {/* Rail */}
          <div className="flex flex-col gap-8 lg:sticky lg:top-20">
            <div data-rise>
              <TradePanel
                market={market}
                selection={selection}
                books={books}
                accent={ticketColor}
                binary={binary}
              />
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
