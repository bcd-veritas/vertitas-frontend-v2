"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { toCents } from "@/lib/markets/format";
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
function Expansion({ row }: { row: RankedRow }) {
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
    <div
      className="border-t border-line/50 border-l-2 bg-bg/30"
      style={{ borderLeftColor: row.color }}
    >
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

export type TradeSelection = { outcomeId: string; side: "yes" | "no" };

export function OutcomesPanel({
  rows,
  selection,
  onSelect,
  openKey,
  onOpenChange,
}: {
  /** Pre-ranked, pre-colored rows shared with the rest of the page. */
  rows: RankedRow[];
  selection: TradeSelection | null;
  onSelect: (s: TradeSelection | null) => void;
  /** Controlled expansion — the page retints hero/ticket to the open row. */
  openKey: string | null;
  onOpenChange: (key: string | null) => void;
}) {

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
      right={<MonoLabel>{`${rows.length} outcomes // tap to expand`}</MonoLabel>}
    >
      <div className="divide-y divide-line/50 border-t border-line/50 mt-1">
        {rows.map((row, rank) => {
          const open = openKey === row.outcome.id;
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
                className="relative w-full flex items-center gap-3 px-5 py-5 text-left cursor-pointer overflow-hidden hover:bg-fg/2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
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
                <span className="text-lg font-bold text-fg truncate">{row.outcome.label}</span>
                <span className="ml-auto mr-3 font-pixel text-2xl sm:text-3xl tabular-nums text-fg shrink-0">
                  {row.pct != null ? `${Math.round(row.pct)}%` : "—"}
                </span>
                {(["yes", "no"] as const).map((side) => {
                  const cents = side === "yes" ? row.yesCents : row.noCents;
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
                      aria-label={`Buy ${row.outcome.label} ${side}${cents != null ? ` at ${cents}¢` : ""}`}
                      aria-pressed={selected}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelection(row.outcome.id, side);
                      }}
                      className={`shrink-0 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.08em] tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${tone}`}
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
    </Frame>
  );
}
