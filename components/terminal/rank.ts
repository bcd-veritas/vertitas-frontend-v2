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
  /** The complement outcome's REAL book (binary markets only, else null). */
  noBook: OrderBookData | null;
  /** The complement outcome's real trade history (binary only, else null). */
  noHistory: PricePoint[] | null;
  /** Probability 0–100: latest trade, else book midpoint, else null. */
  pct: number | null;
  /** Cost to buy YES = YES best ask (cents, one decimal), null when no asks. */
  yesCents: number | null;
  /** Cost to buy NO = NO-book best ask (binary), null when none. */
  noCents: number | null;
  /** Proceeds to sell YES = YES best bid, null when no bids. */
  sellYesCents: number | null;
  /** Proceeds to sell NO = NO-book best bid (binary), null when none. */
  sellNoCents: number | null;
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
  // Binary (Yes/No) markets collapse to the YES row, but the "No" outcome is
  // NOT a phantom: the backend runs a real book per token and its matching
  // engine only crosses same-token orders. So the row's NO prices must come
  // from the real NO book — a mirror of the YES book quotes fills that can't
  // execute (e.g. a fresh seeded market has asks on both books and no bids;
  // the mirror would price selling NO off a bid that doesn't exist).
  const yes = binaryYesOutcome(outcomes);
  const visible = yes ? outcomes.filter((o) => o.id === yes.id) : outcomes;
  const noIdx = yes ? outcomes.findIndex((o) => o.id !== yes.id) : -1;

  const rows = visible.map((outcome): RankedRow => {
    const i = outcomes.indexOf(outcome);
    const book = books[i] ?? EMPTY_BOOK;
    const history = series[i] ?? [];
    const noBook = noIdx !== -1 ? books[noIdx] ?? EMPTY_BOOK : null;
    const noHistory = noIdx !== -1 ? series[noIdx] ?? [] : null;
    const bestBid = book.bids[0] ? toCents(book.bids[0].price) : null;
    const bestAsk = book.asks[0] ? toCents(book.asks[0].price) : null;
    const noBestBid = noBook?.bids[0] ? toCents(noBook.bids[0].price) : null;
    const noBestAsk = noBook?.asks[0] ? toCents(noBook.asks[0].price) : null;
    const lastTrade =
      history.length > 0 ? toCents(history[history.length - 1].price) : null;
    // Mirror the backend's mark (priceFor + withComplementSides, which feed
    // /home & featured): the combined book — best of the real quote and the
    // NO book's implied one at 100 − p on each side (an ask over there IS a
    // bid over here) — then midpoint when two-sided, else last trade. The
    // combined Yes/No books are exact mirrors, so the marks always sum to
    // 100%. Diverging from the backend's priority made the detail page's
    // chance disagree with the card's.
    const impliedBid = noBestAsk != null ? 100 - noBestAsk : null;
    const impliedAsk = noBestBid != null ? 100 - noBestBid : null;
    const effBid =
      bestBid != null && impliedBid != null
        ? Math.max(bestBid, impliedBid)
        : bestBid ?? impliedBid;
    const effAsk =
      bestAsk != null && impliedAsk != null
        ? Math.min(bestAsk, impliedAsk)
        : bestAsk ?? impliedAsk;
    const pct =
      effBid != null && effAsk != null ? (effBid + effAsk) / 2 : lastTrade;

    return {
      outcome,
      book,
      history,
      noBook,
      noHistory,
      pct,
      yesCents: bestAsk,
      // Binary: real NO-book quotes. Non-binary rows keep the mirrored
      // fallback — no complement token exists to read from.
      noCents: noBook ? noBestAsk : bestBid != null ? 100 - bestBid : null,
      sellYesCents: bestBid,
      sellNoCents: noBook ? noBestBid : bestAsk != null ? 100 - bestAsk : null,
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
