"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { oneDp, toCents } from "@/lib/markets/format";
import { complementBook } from "@/lib/orders/book-math";
import { ProbabilityChart, type ChartSeries } from "../charts/ProbabilityChart";
import { MonoLabel } from "../landing/ui/MonoLabel";
import { ComingSoonBody } from "./ComingSoon";
import { Ladder } from "./Ladder";
import { Frame } from "./Frame";
import type { RankedRow } from "./rank";

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

type TabId = "book" | "graph" | "resolution";
const TABS: { id: TabId; label: string }[] = [
  { id: "book", label: "Order Book" },
  { id: "graph", label: "Graph" },
  { id: "resolution", label: "Resolution" },
];

/** Mounted only while its row is open — closing resets the tab to Order Book. */
function Expansion({
  row,
  side,
  binary,
}: {
  row: RankedRow;
  side: "yes" | "no";
  binary: boolean;
}) {
  const [tab, setTab] = useState<TabId>("book");

  // "Buy No" flips the expansion to the complementary side. Binary markets
  // have a REAL No book and trade history (one book per token; the engine
  // only crosses same-token orders), so show those. The mirrored view
  // (100 − p, bids/asks swapped) remains only as the non-binary fallback,
  // where no complement token exists.
  const book = useMemo(
    () =>
      side === "no" ? row.noBook ?? complementBook(row.book) : row.book,
    [row.book, row.noBook, side],
  );

  const graphSeries = useMemo<ChartSeries[]>(() => {
    const noPoints = side === "no" ? row.noHistory : null;
    return [
      {
        key: row.outcome.id,
        label: binary
          ? side === "no" ? "No" : "Yes"
          : side === "no" ? `${row.outcome.label} · No` : row.outcome.label,
        color: row.color,
        points: noPoints
          ? noPoints.map((p) => ({
              t: +new Date(p.createdAt),
              pct: toCents(p.price),
            }))
          : row.history.map((p) => ({
              t: +new Date(p.createdAt),
              pct: side === "no" ? 100 - toCents(p.price) : toCents(p.price),
            })),
      },
    ];
  }, [row, side, binary]);
  const hasGraph = graphSeries[0].points.length >= 2;

  return (
    <div
      className="border-t border-line/50 border-l-2 bg-bg/30"
      style={{ borderLeftColor: row.color }}
    >
      <div className="flex items-center gap-1 px-4 pt-1 border-b border-line/50">
        <div role="tablist" aria-label="Outcome detail" className="flex items-center gap-1">
          {TABS.map(({ id, label }) => {
            const on = tab === id;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={on}
                onClick={() => setTab(id)}
                className={`relative px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${on ? "text-fg" : "text-muted hover:text-fg/80"
                  }`}
              >
                {label}
                {on && (
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-px left-2 right-2 h-0.5"
                    style={{ background: row.color }}
                  />
                )}
              </button>
            );
          })}
        </div>
        {/* Which side this expansion is showing — book/graph flip with it. */}
        <span
          className={`ml-auto px-2 py-0.5 font-mono text-[14px] uppercase tracking-[0.14em] ${side === "yes" ? "text-yes" : "text-no"
            }`}
        >
          {side} view
        </span>
      </div>

      <div className="py-3">
        {tab === "book" && <Ladder book={book} />}
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

export type TradeSelection = { outcomeId: string; side: "yes" | "no" };

export function OutcomesPanel({
  rows,
  selection,
  onSelect,
  openKey,
  onOpenChange,
  binary = false,
  action,
}: {
  /** Pre-ranked, pre-colored rows shared with the rest of the page. */
  rows: RankedRow[];
  selection: TradeSelection | null;
  onSelect: (s: TradeSelection | null) => void;
  /** Controlled expansion — the page retints hero/ticket to the open row. */
  openKey: string | null;
  onOpenChange: (key: string | null) => void;
  /** Yes/No market — rank.ts already collapsed it to the single YES row. */
  binary?: boolean;
  /** Buy/Sell (from the trade panel) — sets the side buttons' verb. */
  action: "buy" | "sell";
}) {
  const verb = action === "sell" ? "Sell" : "Buy";

  const toggleSelection = (outcomeId: string, side: "yes" | "no") =>
    onSelect(
      selection?.outcomeId === outcomeId && selection.side === side
        ? null
        : { outcomeId, side },
    );

  return (
    <Frame
      label="OUTCOMES"
      ariaLabel="Outcomes"
      right={
        <MonoLabel>
          {binary ? "yes / no // tap to expand" : `${rows.length} outcomes // tap to expand`}
        </MonoLabel>
      }
    >
      <div className="divide-y divide-line/50 border-t border-line/50 mt-1">
        {rows.map((row, rank) => {
          const open = openKey === row.outcome.id;
          // Opening a row and picking a side stay in sync (TerminalPage), so the
          // open row's side is the current selection's side, else default Yes.
          const rowSide =
            selection?.outcomeId === row.outcome.id ? selection.side : "yes";
          return (
            <div key={row.outcome.id}>
              {/* Row is a div (not a button) so YES/NO can be real buttons inside. */}
              <div
                role="button"
                tabIndex={0}
                aria-expanded={open}
                onClick={() => onOpenChange(open ? null : row.outcome.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpenChange(open ? null : row.outcome.id);
                  }
                }}
                className="relative w-full flex items-center gap-3 px-5 py-5 text-left cursor-pointer overflow-hidden hover:bg-fg/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                {/* Timing-tower probability bar: width = live probability. */}
                <span
                  aria-hidden="true"
                  className="absolute bottom-0 left-0 h-0.5 transition-[width] duration-700 ease-out"
                  style={{ width: `${row.pct ?? 0}%`, background: row.color }}
                />
                <span
                  className="font-mono text-[11px] tabular-nums shrink-0 w-6"
                  style={{ color: row.color }}
                >
                  {String(rank + 1).padStart(2, "0")}
                </span>
                <span className="text-lg font-bold text-fg truncate">
                  {binary ? "Yes / No" : row.outcome.label}
                </span>
                <span className="ml-auto mr-3 font-pixel text-2xl sm:text-3xl tabular-nums text-fg shrink-0">
                  {row.pct != null ? `${oneDp(row.pct)}%` : "—"}
                </span>
                {(["yes", "no"] as const).map((side) => {
                  // Buy shows the ask side; Sell shows the bid side (proceeds).
                  const cents =
                    action === "sell"
                      ? side === "yes" ? row.sellYesCents : row.sellNoCents
                      : side === "yes" ? row.yesCents : row.noCents;
                  const selected =
                    selection?.outcomeId === row.outcome.id && selection.side === side;
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
                      aria-label={
                        binary
                          ? `${verb} ${side}${cents != null ? ` at ${oneDp(cents)}¢` : ""}`
                          : `${verb} ${row.outcome.label} ${side}${cents != null ? ` at ${oneDp(cents)}¢` : ""}`
                      }
                      aria-pressed={selected}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelection(row.outcome.id, side);
                      }}
                      className={`shrink-0 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.08em] tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${tone}`}
                    >
                      {verb} {side}{" "}
                      <span className="font-bold">{cents != null ? `${oneDp(cents)}¢` : "—"}</span>
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
                <Expansion row={row} side={rowSide} binary={binary} />
              </Collapsible>
            </div>
          );
        })}
      </div>
    </Frame>
  );
}
