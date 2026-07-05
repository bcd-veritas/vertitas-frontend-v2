"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import type { ApiOutcome, OrderBookData, PricePoint } from "@/lib/markets/types";
import { toCents } from "@/lib/markets/format";
import { ProbabilityChart, type ChartSeries } from "../charts/ProbabilityChart";
import { CHART_PALETTE } from "../charts/palette";
import { ComingSoonBody } from "./ComingSoon";
import { Ladder } from "./Ladder";

const EMPTY_BOOK: OrderBookData = { bids: [], asks: [] };

/**
 * Animated expand/collapse via the grid-rows 0fr→1fr trick (animates to auto
 * height, no measuring). Children stay mounted while the close animation
 * plays, then unmount on transitionend — preserving the tab-reset-on-close
 * behavior. Under prefers-reduced-motion the transition is disabled; the
 * closed row is still hidden (0fr + overflow-hidden) and marked aria-hidden.
 */
function Collapsible({ open, children }: { open: boolean; children: ReactNode }) {
  const [mounted, setMounted] = useState(open);
  // React-sanctioned "adjust state during render" — mount immediately on open.
  if (open && !mounted) setMounted(true);

  return (
    <div
      className="grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none"
      style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      aria-hidden={!open}
      onTransitionEnd={(e) => {
        if (e.target === e.currentTarget && !open) setMounted(false);
      }}
    >
      <div className="overflow-hidden min-h-0">{mounted ? children : null}</div>
    </div>
  );
}

type Row = {
  outcome: ApiOutcome;
  book: OrderBookData;
  /** Oldest-first trade history for this outcome. */
  history: PricePoint[];
  /** Probability 0–100: latest trade, else book midpoint, else null. */
  pct: number | null;
  /** Cost to buy YES = best ask (whole cents), null when no asks. */
  yesCents: number | null;
  /** Cost to buy NO = 100 − best bid (whole cents), null when no bids. */
  noCents: number | null;
  /** Rank color — matches the main chart's palette for the top-4. */
  color: string;
};

function deriveRows(
  outcomes: ApiOutcome[],
  books: OrderBookData[],
  series: PricePoint[][],
): Row[] {
  const rows = outcomes.map((outcome, i): Row => {
    const book = books[i] ?? EMPTY_BOOK;
    const history = series[i] ?? [];
    const bestBid = book.bids[0] ? toCents(book.bids[0].price) : null;
    const bestAsk = book.asks[0] ? toCents(book.asks[0].price) : null;
    const lastTrade =
      history.length > 0 ? toCents(history[history.length - 1].price) : null;
    const pct =
      lastTrade ?? (bestBid != null && bestAsk != null ? (bestBid + bestAsk) / 2 : null);

    return {
      outcome,
      book,
      history,
      pct,
      yesCents: bestAsk != null ? Math.round(bestAsk) : null,
      noCents: bestBid != null ? Math.round(100 - bestBid) : null,
      color: "", // assigned after sorting, by rank
    };
  });

  rows.sort((a, b) => {
    if (a.pct == null && b.pct == null) return a.outcome.index - b.outcome.index;
    if (a.pct == null) return 1;
    if (b.pct == null) return -1;
    return b.pct - a.pct || a.outcome.index - b.outcome.index;
  });
  rows.forEach((row, rank) => {
    row.color = rank < CHART_PALETTE.length ? CHART_PALETTE[rank] : "var(--color-muted)";
  });

  return rows;
}

type TabId = "book" | "graph" | "resolution";
const TABS: { id: TabId; label: string }[] = [
  { id: "book", label: "Order Book" },
  { id: "graph", label: "Graph" },
  { id: "resolution", label: "Resolution" },
];

/** Mounted only while its row is open — closing resets the tab to Order Book. */
function Expansion({ row }: { row: Row }) {
  const [tab, setTab] = useState<TabId>("book");

  const graphSeries = useMemo<ChartSeries[]>(
    () => [
      {
        key: row.outcome.id,
        label: row.outcome.label,
        color: row.color,
        points: row.history.map((p) => ({
          t: +new Date(p.createdAt),
          pct: toCents(p.price),
        })),
      },
    ],
    [row],
  );
  const hasGraph = graphSeries[0].points.length >= 2;

  return (
    <div className="border-t border-line/50 bg-bg/30">
      <div
        role="tablist"
        aria-label="Outcome detail"
        className="flex items-center gap-1 px-4 pt-1 border-b border-line/50"
      >
        {TABS.map(({ id, label }) => {
          const on = tab === id;
          return (
            <button
              key={id}
              role="tab"
              aria-selected={on}
              onClick={() => setTab(id)}
              className={`relative px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded-t ${
                on ? "text-fg" : "text-muted hover:text-fg/80"
              }`}
            >
              {label}
              {on && (
                <span
                  aria-hidden="true"
                  className="absolute -bottom-px left-2 right-2 h-[2px] bg-accent rounded-full"
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="py-3">
        {tab === "book" && <Ladder book={row.book} />}
        {tab === "graph" &&
          (hasGraph ? (
            <div className="px-2">
              <ProbabilityChart series={graphSeries} height={200} />
            </div>
          ) : (
            <p className="py-10 text-center font-mono text-[11px] uppercase tracking-[0.24em] text-muted/70">
              no prints yet
            </p>
          ))}
        {tab === "resolution" && <ComingSoonBody />}
      </div>
    </div>
  );
}

export function OutcomesPanel({
  outcomes,
  books,
  series,
}: {
  outcomes: ApiOutcome[];
  books: OrderBookData[];
  series: PricePoint[][];
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  // The selected side per market feeds the trade panel later; re-click deselects.
  const [selection, setSelection] = useState<{ key: string; side: "yes" | "no" } | null>(null);
  const rows = useMemo(() => deriveRows(outcomes, books, series), [outcomes, books, series]);

  const toggleSelection = (key: string, side: "yes" | "no") =>
    setSelection((prev) => (prev?.key === key && prev.side === side ? null : { key, side }));

  return (
    <section
      className="relative bg-surface/70 border border-line rounded-xl overflow-hidden"
      aria-label="Outcomes"
    >
      <span
        aria-hidden="true"
        className="absolute top-2.5 right-3 font-mono text-muted/40 text-xs select-none"
      >
        +
      </span>
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4 pb-3">
        <h2 className="font-pixel text-xl tracking-wide text-fg">OUTCOMES</h2>
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
          {rows.length} outcomes // tap to expand
        </span>
      </div>

      <div className="divide-y divide-line/50 border-t border-line/50">
        {rows.map((row) => {
          const open = openKey === row.outcome.id;
          return (
            <div key={row.outcome.id}>
              {/* Row is a div (not a button) so YES/NO can be real buttons inside. */}
              <div
                role="button"
                tabIndex={0}
                aria-expanded={open}
                onClick={() => setOpenKey(open ? null : row.outcome.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setOpenKey(open ? null : row.outcome.id);
                  }
                }}
                className="w-full flex items-center gap-3 px-5 py-3 text-left cursor-pointer hover:bg-fg/[0.02] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                <span
                  aria-hidden="true"
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: row.color }}
                />
                <span className="text-sm text-fg truncate">{row.outcome.label}</span>
                <span className="ml-auto mr-3 font-mono text-2xl font-bold tabular-nums text-fg shrink-0">
                  {row.pct != null ? `${Math.round(row.pct)}%` : "—"}
                </span>
                {(["yes", "no"] as const).map((side) => {
                  const cents = side === "yes" ? row.yesCents : row.noCents;
                  const selected =
                    selection?.key === row.outcome.id && selection.side === side;
                  const tone =
                    side === "yes"
                      ? selected
                        ? "bg-yes text-bg"
                        : "bg-yes/10 text-yes hover:bg-yes/20"
                      : selected
                        ? "bg-no text-bg"
                        : "bg-no/10 text-no hover:bg-no/20";
                  return (
                    <button
                      key={side}
                      aria-label={`Buy ${row.outcome.label} ${side}${cents != null ? ` at ${cents}¢` : ""}`}
                      aria-pressed={selected}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelection(row.outcome.id, side);
                      }}
                      className={`shrink-0 px-3 py-2 rounded-md font-mono text-[11px] uppercase tracking-[0.08em] tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${tone}`}
                    >
                      Buy {side}{" "}
                      <span className="font-bold">{cents != null ? `${cents}¢` : "—"}</span>
                    </button>
                  );
                })}
                <ChevronDown
                  size={14}
                  aria-hidden="true"
                  className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
                />
              </div>
              <Collapsible open={open}>
                <Expansion row={row} />
              </Collapsible>
            </div>
          );
        })}
      </div>
    </section>
  );
}
