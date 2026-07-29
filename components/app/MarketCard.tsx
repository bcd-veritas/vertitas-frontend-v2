"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ApiMarket } from "@/lib/markets/types";
import { closesLabel, countdown, formatVol, multiplier, oneDp, rankedOutcomes } from "@/lib/markets/format";
import { CategoryIcon } from "./categoryIcon";
import { MonoLabel } from "../landing/ui/MonoLabel";

/** Non-live state word for the card's tag. ENDED = closed and awaiting the
 *  oracle outcome ("resolving"); RESOLVED = outcome settled. */
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

/** Footer tint: resolving reads amber (in progress), cancelled negative,
 *  resolved muted. */
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

/** Card chrome per status. Resolving gets an amber tint and only a light dim so
 *  it stands out from the fully-greyed resolved/cancelled cards; live cards keep
 *  the accent hover. */
function cardTone(status: ApiMarket["status"]): string {
  switch (status) {
    case "ACTIVE":
      return "border-line hover:border-accent/60 hover:bg-surface";
    case "ENDED":
      return "border-amber-400/40 opacity-90 hover:border-amber-400/70 hover:bg-surface";
    default:
      return "border-line opacity-60 saturate-50";
  }
}

/** Yes→green, No→red; for multi-outcome markets the leader is green, rest red. */
function colorFor(label: string, rank: number): { text: string; bar: string } {
  const l = label.toLowerCase();
  if (l === "yes") return { text: "text-yes", bar: "bg-yes" };
  if (l === "no") return { text: "text-no", bar: "bg-no" };
  return rank === 0 ? { text: "text-yes", bar: "bg-yes" } : { text: "text-no", bar: "bg-no" };
}

function OutcomeRow({
  label,
  pct,
  href,
  active,
  color,
}: {
  label: string;
  pct: number | null;
  href: string;
  active: boolean;
  color: { text: string; bar: string };
}) {
  const mult = multiplier(pct != null ? pct / 100 : null);
  const pctText = pct != null ? `${oneDp(pct)}%` : "—";
  const barWidth = pct != null ? Math.max(4, pct) : 0;

  const row = (
    <>
      <span className="relative shrink-0 min-w-0">
        {active && pct != null && (
          <span
            aria-hidden="true"
            className="absolute -left-3.5 font-mono text-xs text-accent opacity-0 group-hover/row:opacity-100 transition-opacity"
          >
            &gt;
          </span>
        )}
        <span className="text-sm text-fg truncate max-w-36 inline-block align-bottom">{label}</span>
      </span>
      {/* dotted leader */}
      <span aria-hidden="true" className="flex-1 border-b border-dotted border-line mx-3 translate-y-0.75" />
      <span className="font-mono text-[11px] text-muted tabular-nums shrink-0">{mult}</span>
      <span
        className={`font-mono text-xl font-bold tabular-nums w-14 text-right shrink-0 ${pct != null ? color.text : "text-muted"
          }`}
      >
        {pctText}
      </span>
    </>
  );

  // Unpriced or non-live → static row (no link, no bar).
  if (!active || pct == null) {
    return (
      <div className="relative flex items-baseline py-2.5 opacity-60">
        {row}
        {pct != null && (
          <span
            aria-hidden="true"
            className={`absolute left-0 -bottom-0.5 h-0.5 rounded-full ${color.bar} opacity-40`}
            style={{ width: `${barWidth}%` }}
          />
        )}
      </div>
    );
  }
  return (
    <Link
      href={href}
      className="group/row relative z-10 flex items-baseline py-2.5 px-2 -mx-2 rounded hover:bg-fg/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      aria-label={`Trade ${label} at ${oneDp(pct)}%`}
    >
      {row}
      <span
        aria-hidden="true"
        className={`absolute left-0 -bottom-0.5 h-0.5 rounded-full ${color.bar} group-hover/row:brightness-125 transition-all`}
        style={{ width: `${barWidth}%` }}
      />
    </Link>
  );
}

export function MarketCard({
  market,
  featured = false,
}: {
  market: ApiMarket;
  featured?: boolean;
}) {
  const live = market.status === "ACTIVE";
  const word = statusWord(market.status);
  const href = `/markets/${market.id}`;
  const ranked = rankedOutcomes(market).slice(0, 2);
  const leadPct = ranked[0]?.pct ?? null;
  const secondPct = ranked[1]?.pct ?? null;

  // Rail: proportional split of the top-2 chances; muted when we can't price both.
  const railPriced = live && leadPct != null && secondPct != null;
  const total = (leadPct ?? 0) + (secondPct ?? 0);
  const leadWidth = total > 0 ? ((leadPct ?? 0) / total) * 100 : 50;

  const [clock, setClock] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setClock(countdown(market.endTime)), 0);
    return () => clearTimeout(t);
  }, [market.endTime]);

  return (
    <article
      className={`market-card group relative flex flex-col bg-surface/70 border rounded-xl overflow-hidden transition-colors cursor-pointer ${cardTone(market.status)}`}
    >
      {/* Probability rail — split at the leading outcome's share of the top-2 */}
      <div
        aria-hidden="true"
        className={`flex w-full transition-all ${featured ? "h-0.5" : "h-px group-hover:h-0.5"}`}
      >
        {railPriced ? (
          <>
            <span className="bg-yes" style={{ width: `${leadWidth}%` }} />
            <span className="bg-no" style={{ width: `${100 - leadWidth}%` }} />
          </>
        ) : (
          <span className="bg-muted/50 w-full" />
        )}
      </div>

      {/* + registration mark */}
      <span aria-hidden="true" className="absolute top-2.5 right-3 font-mono text-muted/40 text-xs select-none">
        +
      </span>

      <div className="flex flex-col flex-1 p-5">
        {/* Eyebrow: MKT.CATEGORY // CLOSES ... */}
        <div className="flex items-center gap-1.5 mb-3 pr-5">
          <CategoryIcon category={market.category} />
          <MonoLabel className="truncate">
            {live
              ? `mkt.${(market.category ?? "open").replace(/\s+/g, "")} // closes ${closesLabel(market.endTime)}`
              : `mkt.${word} // ${market.category ?? "open"}`}
            {featured && <span className="text-accent"> ★ featured</span>}
          </MonoLabel>
        </div>

        {/* Title — stretched link covers the card */}
        <h3 className={`font-semibold text-fg leading-snug line-clamp-2 ${featured ? "text-2xl" : "text-lg"}`}>
          <Link
            href={href}
            className="focus-visible:outline-none after:absolute after:inset-0 after:content-['']"
          >
            {market.title}
          </Link>
        </h3>

        {/* Top-2 outcome rows */}
        <div className="mt-4 flex flex-col divide-y divide-line/50">
          {ranked.map((r, i) => (
            <OutcomeRow
              key={r.outcome.id}
              label={r.outcome.label}
              pct={r.pct}
              href={href}
              active={live}
              color={colorFor(r.outcome.label, i)}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="mt-auto pt-3 border-t border-line flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted tabular-nums">
            {formatVol(market.volume)}
          </span>
          <span className={`font-mono text-[11px] tracking-[0.14em] tabular-nums ${live ? "text-accent/80" : statusTone(market.status)}`}>
            {live ? (clock ?? "—") : word.toUpperCase()}
          </span>
        </div>
      </div>
    </article>
  );
}
