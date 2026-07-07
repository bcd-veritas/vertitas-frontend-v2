import type { ApiOutcome, OrderBookData, PricePoint } from "@/lib/markets/types";
import { binaryYesOutcome, toCents } from "@/lib/markets/format";
import { CHART_PALETTE } from "../charts/palette";

const EMPTY_BOOK: OrderBookData = { bids: [], asks: [] };

/** --color-muted as a literal hex — rank colors must stay canvas-parseable. */
const MUTED_HEX = "#a89f9c";

export type RankedRow = {
  outcome: ApiOutcome;
  book: OrderBookData;
  /** Oldest-first trade history for this outcome. */
  history: PricePoint[];
  /** Probability 0–100: latest trade, else book midpoint, else null. */
  pct: number | null;
  /** Cost to buy YES = best ask (cents, one decimal), null when no asks. */
  yesCents: number | null;
  /** Cost to buy NO = 100 − best bid (cents, one decimal), null when no bids. */
  noCents: number | null;
  /** Rank color — one shared assignment for chart, tower, hero, and ticket. */
  color: string;
};

/**
 * The page's single source of truth for outcome order and color: rank by
 * probability (latest trade, else book midpoint), then hand the top-4 the
 * chart palette by rank. Every surface — hero readout, chart lines, tower
 * rows, trade ticket — reads from this so an outcome is one color everywhere.
 */
export function rankRows(
  outcomes: ApiOutcome[],
  books: OrderBookData[],
  series: PricePoint[][],
): RankedRow[] {
  // Binary (Yes/No) markets collapse to the YES row: the "No" outcome is a
  // phantom (no book of its own — NO trading is the complement of the YES
  // book), so ranking it alongside YES would render a dead "—" row with
  // nonsensical Buy yes/Buy no chips on both lines.
  const yes = binaryYesOutcome(outcomes);
  const visible = yes ? outcomes.filter((o) => o.id === yes.id) : outcomes;

  const rows = visible.map((outcome): RankedRow => {
    const i = outcomes.indexOf(outcome);
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
      yesCents: bestAsk,
      noCents: bestBid != null ? 100 - bestBid : null,
      color: "", // assigned after sorting, by rank
    };
  });

  rows.sort((a, b) => {
    if (a.pct == null && b.pct == null) return a.outcome.index - b.outcome.index;
    if (a.pct == null) return 1;
    if (b.pct == null) return -1;
    return b.pct - a.pct || a.outcome.index - b.outcome.index;
  });
  // Resolved hex only (no CSS vars): these colors feed ECharts canvas
  // gradients (`${color}2E`), which cannot parse var() references.
  rows.forEach((row, rank) => {
    row.color = rank < CHART_PALETTE.length ? CHART_PALETTE[rank] : MUTED_HEX;
  });

  return rows;
}

/** outcomeId → rank color, for components that only need the paint. */
export function colorMap(rows: RankedRow[]): Record<string, string> {
  return Object.fromEntries(rows.map((r) => [r.outcome.id, r.color]));
}
