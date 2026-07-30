"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ApiMarket } from "@/lib/markets/types";
import { closesLabel, countdownPair, formatVol, multiplier, oneDp } from "@/lib/markets/format";
import { splitSides, type SplitSide } from "./splitSides";
import { CategoryIcon } from "../categoryIcon";
import { PixelLabel } from "../PixelLabel";
import { AnchorDetail } from "./AnchorDetail";

/** Under this share a mass cannot hold a label plus a 2.9rem figure without
 *  clipping mid-digit, so it drops the label and shrinks. Fires often — 90/10
 *  markets are common and settled books sit near 100/0 — so it is a normal
 *  state, not an error path. */
const TIGHT_PCT = 22;

/** ENDED = closed, awaiting the oracle ("resolving"). */
function statusWord(status: ApiMarket["status"]): string {
  switch (status) {
    case "ENDED":
      return "resolving";
    case "RESOLVED":
      return "resolved";
    case "CANCELLED":
      return "cancelled";
    default:
      return "open";
  }
}

function statusTone(status: ApiMarket["status"]): string {
  switch (status) {
    case "ENDED":
      return "text-amber-300";
    case "CANCELLED":
      return "text-no/70";
    default:
      return "text-muted";
  }
}

/** Resolving keeps an amber edge and stays legible; resolved and cancelled
 *  grey out so live markets win the eye. No hover variants here on purpose —
 *  the card itself is inert on hover so the only hover affordance is the
 *  yes/no masses. */
function cardTone(status: ApiMarket["status"]): string {
  switch (status) {
    case "ACTIVE":
      return "border-line";
    case "ENDED":
      return "border-amber-400/40";
    default:
      return "border-line opacity-60 saturate-50";
  }
}

/** Shares $1 buys at this price, and what they redeem for if the side wins.
 *  A winning share always pays exactly $1, so the two numbers are the same
 *  figure — stated both ways because "2.22 shares" and "$2.22 back" answer
 *  different questions. */
function payoutLines(pct: number, label: string): [string, string] {
  const shares = multiplier(pct / 100).replace("x", "");
  return [`$1 buys ${shares} shares`, `${label} wins → $${shares}`];
}

function Mass({
  side,
  index,
  href,
  state,
  onEnter,
  onLeave,
}: {
  side: SplitSide;
  index: number;
  href: string;
  /** Which of the two sides the pointer is on, from the parent. */
  state: "idle" | "expanded" | "collapsed";
  onEnter: () => void;
  onLeave: () => void;
}) {
  const expanded = state === "expanded";
  const collapsed = state === "collapsed";
  // Tight is about the RESTING layout only. While either side is hovered the
  // split is a fixed 70/30, so both sides clear TIGHT_PCT and neither needs
  // the squeezed treatment — a sliver gets its label back on hover.
  const tight = state === "idle" && side.pct < TIGHT_PCT;
  const bg = side.tone === "yes" ? "bg-yes/25" : "bg-no/20";
  const fg = side.tone === "yes" ? "text-yes" : "text-no";
  // Index drives the edge, not tone/pct — label and figure stay pinned to this
  // side's OWN outer corner (first bottom-left, second bottom-right), so
  // expanding does not slide them across the card.
  const edge = index === 0 ? "items-start text-left" : "items-end text-right";
  const [buys, wins] = payoutLines(side.pct, side.label);

  return (
    // A link, not a div, and z-10 to sit ABOVE the title's stretched-link
    // overlay (`after:absolute inset-0`, which spans the whole card). Without
    // the raise the overlay eats the pointer and a mass can never be hovered;
    // without the link the top 200px of every card would stop being clickable.
    // tabIndex -1 keeps the title as the single tab stop — the mass block is
    // aria-hidden, so a focusable control in here would be a focus trap.
    <Link
      href={href}
      tabIndex={-1}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      // flex-grow is animatable, so driving it from state gives the expansion
      // for free. Held in React rather than CSS because the inline grow value
      // would otherwise outrank any hover utility.
      className={`@container relative z-10 flex min-w-0 flex-col justify-end overflow-hidden transition-[flex-grow] duration-300 ease-out ${bg} ${edge} ${
        tight ? "px-2 py-4" : "p-4"
      }`}
      // 70/30 on hover: the other side keeps a real presence rather than
      // vanishing, so the card still reads as a two-sided market. flexBasis 0
      // makes these grow values behave as exact percentages.
      style={{
        flexGrow: expanded ? 70 : collapsed ? 30 : side.pct,
        flexBasis: 0,
      }}
    >
      {/* Payout, centred in the expanded side. Rendered only while expanded so
       *  it cannot bleed out of a collapsed sliver. */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 px-3 text-center transition-opacity duration-200 ${
          expanded ? "opacity-100 delay-150" : "opacity-0"
        }`}
      >
        <span className="font-terminal text-[13px] tracking-[0.1em] text-fg/70 uppercase">
          {buys}
        </span>
        <span className={`font-pixel text-[1.05rem] font-medium tracking-[0.06em] uppercase ${fg}`}>
          {wins}
        </span>
      </span>

      {!tight && (
        <PixelLabel className="text-[13px]! font-normal! tracking-[0.16em]! text-fg/70 whitespace-nowrap">
          {side.label}
        </PixelLabel>
      )}
      {/* Sized off the mass's own rendered pixel width (via cqi), not a
       *  percentage-of-card guess — at narrow breakpoints a "wide" mass can
       *  still be too few pixels for a 2.9rem figure, and TIGHT_PCT alone
       *  can't see that. Caps match the design spec at generous widths. */}
      <span
        className={`font-pixel font-medium tabular-nums leading-[0.9] whitespace-nowrap ${fg} ${
          tight
            ? "text-[clamp(0.85rem,15cqi,1.35rem)]"
            : "text-[clamp(0.85rem,20cqi,2.9rem)]"
        }`}
      >
        {oneDp(side.pct)}
      </span>
    </Link>
  );
}

/** Shared neutral mass — used both when no outcome has a usable price and
 *  when the market is cancelled (which is not "unpriced": it simply cannot
 *  pay out, so it gets its own copy rather than reusing "no price yet"). */
function NeutralMass({ text }: { text: string }) {
  return (
    <div className="flex min-h-[200px] w-full items-end bg-muted/20 p-4">
      <PixelLabel className="text-[13px]!">{text}</PixelLabel>
    </div>
  );
}

/** ENDED-only mass: the market is closed and waiting on the oracle, so the
 *  frozen yes/no split would misrepresent stale prices as live odds. A
 *  single amber hatch reads as "texture, not a price" — with a slow sweep
 *  (mirroring .dot-scan) as a working signal, not an attention grab. */
function ResolvingMass() {
  return (
    <div className="relative flex min-h-[200px] w-full items-center justify-center overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0 text-amber-400/40"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, currentColor 0 1.5px, transparent 1.5px 5px)",
        }}
      />
      <div aria-hidden="true" className="resolving-sweep absolute inset-0 text-amber-300/70" />
      {/* text-amber-300 needs `!` like its siblings: PixelLabel's own
          text-muted is emitted later in the stylesheet and wins otherwise. */}
      {/* 15px, so above the =<13px band trialling VT323 — pinned back to the
          pixel face, overriding PixelLabel's base family. */}
      <PixelLabel className="relative font-pixel! text-[15px]! font-semibold! tracking-[0.14em]! text-amber-300!">
        resolving
      </PixelLabel>
    </div>
  );
}

export function SplitCard({
  market,
  wide = false,
}: {
  market: ApiMarket;
  wide?: boolean;
}) {
  const live = market.status === "ACTIVE";
  const ended = market.status === "ENDED";
  const cancelled = market.status === "CANCELLED";
  const word = statusWord(market.status);
  const href = `/markets/${market.id}`;
  const sides = splitSides(market);

  // Hydration-sensitive: the countdown depends on Date.now(), so it fills in
  // after mount rather than during render. Ticks every second; React bails
  // out of re-rendering when countdownPair returns the same string (a card
  // showing days won't re-render every second).
  // Which side the pointer is on. Lives here rather than in each Mass because
  // expanding one side requires collapsing the other — a mass can't know that
  // about its sibling from CSS alone.
  const [hovered, setHovered] = useState<number | null>(null);

  const [clock, setClock] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => setClock(countdownPair(market.endTime));
    const t = setTimeout(tick, 0);
    const i = setInterval(tick, 1000);
    return () => {
      clearTimeout(t);
      clearInterval(i);
    };
  }, [market.endTime]);

  const caption = (
    <div
      className={`flex flex-1 flex-col gap-2.5 p-5 ${wide ? "border-b border-line lg:border-r lg:border-b-0" : ""}`}
    >
      <div className="flex min-w-0 items-center gap-1.5 pr-5">
        <CategoryIcon category={market.category} />
        <PixelLabel className="truncate text-[13px]! tracking-[0.14em]!">
          {live
            ? `mkt.${(market.category ?? "open").replace(/\s+/g, "")} // closes ${closesLabel(market.endTime)}`
            : `mkt.${word} // ${market.category ?? "open"}`}
        </PixelLabel>
      </div>

      <h3 className="font-pixel font-medium line-clamp-3 text-[1.4rem] leading-[1.02] tracking-[0.03em] text-fg uppercase">
        <Link
          href={href}
          className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
        >
          {market.title}
        </Link>
      </h3>

      {/* Screen readers get the odds as text; the masses are decorative. */}
      <p className="sr-only">
        {ended
          ? "Market resolving — closed and awaiting the oracle outcome."
          : cancelled
            ? "Market cancelled — no payout."
            : sides
              ? sides
                  .map(
                    (s) =>
                      `${s.label} ${oneDp(s.pct)} percent, pays ${multiplier(s.pct / 100)}`,
                  )
                  .join(", ")
              : "No price yet."}
      </p>

      <div className="mt-auto flex items-baseline justify-between gap-3 pt-1">
        <PixelLabel className="text-[13px]! tracking-[0.12em]! tabular-nums">
          {formatVol(market.volume)}
        </PixelLabel>
        <PixelLabel
          className={`text-[13px]! tracking-[0.12em]! tabular-nums ${
            live ? "text-accent/80" : statusTone(market.status)
          }`}
        >
          {live ? (clock ?? "—") : word.toUpperCase()}
        </PixelLabel>
      </div>
    </div>
  );

  return (
    <article
      className={`market-card group relative flex flex-col overflow-hidden rounded-xl border bg-surface/[0.78] has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-accent has-[a:focus-visible]:outline-offset-2 ${
        wide ? "sm:col-span-2 lg:col-span-4" : "sm:col-span-1 lg:col-span-2"
      } ${cardTone(market.status)}`}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-2 right-3 z-20 font-terminal text-[13px] text-fg/35 select-none"
      >
        +
      </span>

      {/* Mass block — widths are the odds */}
      <div className="flex min-h-[200px]" aria-hidden="true">
        {ended ? (
          <ResolvingMass />
        ) : cancelled ? (
          <NeutralMass text="cancelled — no payout" />
        ) : sides ? (
          sides.map((s, i) => (
            <Mass
              key={i}
              side={s}
              index={i}
              href={href}
              state={
                hovered === null ? "idle" : hovered === i ? "expanded" : "collapsed"
              }
              onEnter={() => setHovered(i)}
              onLeave={() => setHovered(null)}
            />
          ))
        ) : (
          <NeutralMass text="no price yet" />
        )}
      </div>

      {wide ? (
        <div className="grid flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,15rem)]">
          {caption}
          <AnchorDetail marketId={market.id} />
        </div>
      ) : (
        caption
      )}
    </article>
  );
}
