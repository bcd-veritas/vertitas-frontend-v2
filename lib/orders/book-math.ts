import type { BookLevel } from "@/lib/markets/types";

/** API fixed-point scales: price 1e6 == 100% == $1; quantity 1e6 == 1 share. */
const PRICE_SCALE = 1e6;
const QTY_SCALE = 1e6;

export type WalkResult = {
  /** Shares bought/sold. */
  shares: number;
  /** Dollars spent (buy) or received (sell). */
  dollars: number;
  /** Volume-weighted average price in cents (0 when nothing filled). */
  avgPriceCents: number;
  /** True when the book ran out before the full amount was filled. */
  exhausted: boolean;
};

/** Spend `dollars` walking the asks (ascending). Polymarket-style market buy. */
export function walkBuy(asks: BookLevel[], dollars: number): WalkResult {
  let remaining = dollars;
  let shares = 0;
  let spent = 0;
  for (const lvl of asks) {
    const p = Number(lvl.price) / PRICE_SCALE; // $ per share, 0–1
    const q = Number(lvl.quantity) / QTY_SCALE;
    if (p <= 0 || q <= 0) continue;
    const levelCost = p * q;
    if (remaining >= levelCost) {
      shares += q;
      spent += levelCost;
      remaining -= levelCost;
    } else {
      shares += remaining / p;
      spent += remaining;
      remaining = 0;
      break;
    }
  }
  return {
    shares,
    dollars: spent,
    avgPriceCents: shares > 0 ? (spent / shares) * 100 : 0,
    exhausted: remaining > 1e-9,
  };
}

/** Sell `shares` walking the bids (descending). */
export function walkSell(bids: BookLevel[], sharesIn: number): WalkResult {
  let remaining = sharesIn;
  let sold = 0;
  let proceeds = 0;
  for (const lvl of bids) {
    const p = Number(lvl.price) / PRICE_SCALE;
    const q = Number(lvl.quantity) / QTY_SCALE;
    if (p <= 0 || q <= 0) continue;
    const take = Math.min(remaining, q);
    sold += take;
    proceeds += take * p;
    remaining -= take;
    if (remaining <= 0) break;
  }
  return {
    shares: sold,
    dollars: proceeds,
    avgPriceCents: sold > 0 ? (proceeds / sold) * 100 : 0,
    exhausted: remaining > 1e-9,
  };
}

/** Payout if right: $1/share minus the market fee (display estimate only). */
export function toWin(shares: number, feeBps: number): number {
  return shares * (1 - feeBps / 10_000);
}

/** Total $ needed to clear every ask level (MAX chip for market buys). */
export function bookDepthDollars(asks: BookLevel[]): number {
  return asks.reduce(
    (sum, l) => sum + (Number(l.price) / PRICE_SCALE) * (Number(l.quantity) / QTY_SCALE),
    0,
  );
}

/** Total shares across bid levels (MAX for market sells until positions land). */
export function bookDepthShares(bids: BookLevel[]): number {
  return bids.reduce((sum, l) => sum + Number(l.quantity) / QTY_SCALE, 0);
}

/** API price scale: 1e6 == 100% == $1 (string fixed-point). */
const PRICE_FP = 1_000_000;

/**
 * Complementary view of a YES book for trading the NO side: buying NO at q
 * is the mirror of the YES book at price 1−p. YES bids (desc) become NO
 * asks (asc) and YES asks (asc) become NO bids (desc); quantities carry over.
 */
export function complementBook(book: { bids: BookLevel[]; asks: BookLevel[] }): {
  bids: BookLevel[];
  asks: BookLevel[];
} {
  const flip = (l: BookLevel): BookLevel => ({
    ...l,
    price: String(PRICE_FP - Number(l.price)),
  });
  return { bids: book.asks.map(flip), asks: book.bids.map(flip) };
}
