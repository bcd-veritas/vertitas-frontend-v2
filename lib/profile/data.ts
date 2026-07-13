// User identity (username/email) against the middleware's /users routes,
// plus the wallet's live portfolio (value, positions, open orders, trade
// history, markets traded) against the Fastify profile/order/trade routes.

import type { ActivityRow, OpenOrderRow, PositionRow } from "./mock";

const API = process.env.NEXT_PUBLIC_API_URL;

// Fixed-point scales mirror the middleware's shared/utils/fixed-point.ts:
//   AMOUNT_SCALE 1e8 — shares (⇒ 1 share = 1e8)
//   PRICE_SCALE  1e8 — 0–1 probability fraction, so 1¢ = 1e6 price units
// Everything monetary — order cost, the collateral ledger, and
// getTotalValueByWallet's notional — is tracked in AMOUNT_SCALE dollars, so
// $1 = 1e8 (⇒ 1¢ = 1e6). getCollateralDollars below already divides by 1e8.
const AMOUNT_PER_SHARE = 100_000_000; // 1e8
const PRICE_PER_CENT = 1_000_000; // 1e6
const NOTIONAL_PER_CENT = 1_000_000; // 1e6 (1e8 dollars → cents)

const priceToCents = (p: string): number => Math.round(Number(p) / PRICE_PER_CENT);
const amountToShares = (a: string): number => Math.round(Number(a) / AMOUNT_PER_SHARE);

export type UserIdentity = {
  walletAddress: string;
  username: string | null;
  email: string | null;
};

/** Null when the user has never saved a profile (404) or the API is down. */
export async function getUserIdentity(
  wallet: string,
): Promise<UserIdentity | null> {
  try {
    const res = await fetch(`${API}/users/${wallet}`);

    if (!res.ok) return null;
    return (await res.json()) as UserIdentity;
  } catch {
    return null;
  }
}

/**
 * Idempotent account onboarding, fired on wallet connect. Creates the user
 * with a wallet-derived dummy username (empty email) if new, else returns the
 * existing record. Best-effort — never throws, so a flaky API can't break the
 * connect UX; it simply retries on the next connect.
 */
export async function ensureAccount(wallet: string): Promise<void> {
  try {
    await fetch(`${API}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress: wallet }),
    });
  } catch {
    // swallow — onboarding is retried the next time the wallet connects
  }
}

/** Throws with the API's message (validation, username/email taken). */
export async function updateUserIdentity(
  wallet: string,
  data: { username: string | null; email: string | null },
): Promise<UserIdentity> {
  const res = await fetch(`${API}/users/${wallet}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(body?.message ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as UserIdentity;
}

/** Ledger balances in dollars (API is 1e8 fixed-point strings). Null = fetch failed. */
export async function getCollateralDollars(
  wallet: string,
): Promise<{ available: number; locked: number } | null> {
  try {
    const res = await fetch(`${API}/profiles/${wallet}/collateral`);
    if (!res.ok) return null;
    const data = (await res.json()) as { available: string; locked: string };
    return {
      available: Number(data.available) / 1e8,
      locked: Number(data.locked) / 1e8,
    };
  } catch {
    return null;
  }
}

/**
 * Available shares of one outcome (for sell preflight). The positions API is
 * wallet-scoped; filter client-side — fine at this scale. 0 = no position,
 * null = fetch failed (preflight should not block on unknown).
 */
export async function getPositionShares(
  wallet: string,
  marketId: string,
  outcomeIndex: number,
): Promise<number | null> {
  try {
    const res = await fetch(
      `${API}/profiles/${wallet}/current-position?limit=100`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      items?: { marketId: string; outcomeIndex: number; availableAmount: string }[];
    };
    const pos = (data.items ?? []).find(
      (p) => p.marketId === marketId && p.outcomeIndex === outcomeIndex,
    );
    return pos ? Number(pos.availableAmount) / 1e8 : 0;
  } catch {
    return null;
  }
}

// ---- Portfolio (hero value + Positions/Orders/History tables) --------------
// All degrade to an empty/zero shape on any failure so the page renders its
// empty states instead of erroring. Rows are built into the existing mock row
// shapes so the presentational components need no changes.

export type PortfolioValue = {
  /** Mark value of all open positions, whole cents. */
  valueCents: number;
  /** Unrealized PnL across those positions, whole cents. */
  pnlCents: number;
  positions: PositionRow[];
};

type TotalPositionValueResponse = {
  totalValue: string;
  positions: {
    position: {
      id: string;
      marketId: string;
      averageCost: string | null;
      market: { title: string };
      outcome: { label: string };
    };
    markPrice: string;
    totalAmount: string;
  }[];
};

/**
 * Live positions + portfolio value from one call. `total-position-value`
 * already carries each position's market, outcome and computed mark price, so
 * the Positions table and the hero number come from the same source of truth.
 */
export async function getPortfolioValue(
  wallet: string,
): Promise<PortfolioValue> {
  const empty: PortfolioValue = { valueCents: 0, pnlCents: 0, positions: [] };
  try {
    const res = await fetch(`${API}/profiles/${wallet}/total-position-value`);
    if (!res.ok) return empty;

    const data = (await res.json()) as TotalPositionValueResponse;
    const positions: PositionRow[] = (data.positions ?? []).map((p) => {
      const curPriceCents = priceToCents(p.markPrice);
      return {
        id: p.position.id,
        marketId: p.position.marketId,
        market: p.position.market.title,
        outcome: p.position.outcome.label,
        shares: amountToShares(p.totalAmount),
        // No entry price recorded (position fully closed then reopened) → fall
        // back to mark, so the row shows a flat, not a fabricated, PnL.
        avgCostCents:
          p.position.averageCost != null
            ? priceToCents(p.position.averageCost)
            : curPriceCents,
        curPriceCents,
      };
    });

    const pnlCents = positions.reduce(
      (sum, r) => sum + r.shares * (r.curPriceCents - r.avgCostCents),
      0,
    );

    return {
      valueCents: Math.round(Number(data.totalValue) / NOTIONAL_PER_CENT),
      pnlCents: Math.round(pnlCents),
      positions,
    };
  } catch {
    return empty;
  }
}

/** Distinct markets the wallet has traded. 0 on any failure. */
export async function getMarketsTraded(wallet: string): Promise<number> {
  try {
    const res = await fetch(
      `${API}/profiles/${wallet}/total-markets-traded`,
    );
    if (!res.ok) return 0;
    const data = (await res.json()) as { totalMarketsTraded: number };
    return data.totalMarketsTraded ?? 0;
  } catch {
    return 0;
  }
}

const OPEN_ORDER_STATUSES = new Set(["OPEN", "PARTIALLY_FILLED"]);

type OrderDTO = {
  id: string;
  marketId: string;
  side: "BID" | "ASK";
  status: string;
  price: string;
  quantity: string;
  filledQuantity: string;
  market: { title: string };
  outcome: { label: string };
};

/**
 * Resting orders. The API filters by a single status, so we pull the page and
 * keep the still-working ones (OPEN + PARTIALLY_FILLED) client-side.
 */
export async function getOpenOrders(wallet: string): Promise<OpenOrderRow[]> {
  try {
    const res = await fetch(`${API}/users/${wallet}/orders?limit=100`);
    if (!res.ok) return [];
    const data = (await res.json()) as { items?: OrderDTO[] };
    return (data.items ?? [])
      .filter((o) => OPEN_ORDER_STATUSES.has(o.status))
      .map((o) => ({
        id: o.id,
        marketId: o.marketId,
        market: o.market.title,
        outcome: o.outcome.label,
        side: o.side === "BID" ? "BUY" : "SELL",
        priceCents: priceToCents(o.price),
        shares: amountToShares(o.quantity),
        filledShares: amountToShares(o.filledQuantity),
      }));
  } catch {
    return [];
  }
}

type TradeDTO = {
  id: string;
  marketId: string;
  buyerWallet: string;
  sellerWallet: string;
  price: string;
  quantity: string;
  createdAt: string;
  market: { title: string };
  outcome: { label: string };
};

/**
 * Completed-trade log for the History tab. A trade is BOUGHT for this wallet
 * when it was the buyer, else SOLD. Newest-first (the API already orders desc).
 */
export async function getTradeHistory(
  wallet: string,
  limit = 50,
): Promise<ActivityRow[]> {
  try {
    const res = await fetch(
      `${API}/profiles/${wallet}/trades?limit=${limit}`,
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { items?: TradeDTO[] };
    const lower = wallet.toLowerCase();
    return (data.items ?? []).map((t) => ({
      id: t.id,
      t: new Date(t.createdAt).getTime(),
      action: t.buyerWallet.toLowerCase() === lower ? "BOUGHT" : "SOLD",
      market: t.market.title,
      outcome: t.outcome.label,
      shares: amountToShares(t.quantity),
      priceCents: priceToCents(t.price),
    }));
  } catch {
    return [];
  }
}
