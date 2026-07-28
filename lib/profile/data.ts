// User identity (username/email) against the middleware's /users routes,
// plus the wallet's live portfolio (value, positions, open orders, trade
// history, markets traded) against the Fastify profile/order/trade routes.

import type { ActivityRow, OpenOrderRow, PositionRow } from "./mock";
import type { Role } from "@/lib/admin/types";

const API = process.env.NEXT_PUBLIC_API_URL;

// Fixed-point scales mirror the middleware's shared/utils/fixed-point.ts:
//   AMOUNT_SCALE 1e8 — shares (⇒ 1 share = 1e8)
//   PRICE_SCALE  1e8 — 0–1 probability fraction, so 1¢ = 1e6 price units
// Everything monetary — order cost, the collateral ledger, and
// getTotalValueByWallet's notional — is tracked in AMOUNT_SCALE dollars, so
// $1 = 1e8 (⇒ 1¢ = 1e6).
const AMOUNT_PER_SHARE = 100_000_000; // 1e8
const NOTIONAL_PER_DOLLAR = 100_000_000; // 1e8
const PRICE_PER_CENT = 1_000_000; // 1e6
const NOTIONAL_PER_CENT = 1_000_000; // 1e6 (1e8 dollars → cents)

const priceToCents = (p: string): number => Math.round(Number(p) / PRICE_PER_CENT);
const amountToShares = (a: string): number => Math.round(Number(a) / AMOUNT_PER_SHARE);

// Two deliberate output conventions, both fed by the shared fetch helpers below:
//   • market-scoped reads (terminal) return RAW 1e8 strings — callers render
//     them with the markets/format helpers;
//   • profile-table reads return CONVERTED numbers (whole cents / shares).

export type UserIdentity = {
  walletAddress: string;
  username: string | null;
  email: string | null;
  /** Reuses the canonical admin Role union; GET /users/:wallet returns it. */
  role: Role;
};

/** Voters/oracle participants take the wallet-VTK deposit path (they need
 *  wallet VTK to post oracle bonds); everyone else credits the ledger. */
export const isVoterRole = (role: Role | undefined): boolean =>
  role === "VOTER" || role === "ORACLE_PARTICIPANT";

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

export type DepositResult = {
  credited: boolean;
  alreadyProcessed: boolean;
  amount: string;
};

/**
 * Report a confirmed CollateralVault deposit so the backend verifies the
 * receipt on-chain and credits the ledger. Only meaningful for the standard
 * (treasury-receiver) flow; voter deposits skip this. Idempotent server-side
 * via the tx hash, so a retry after a failed post is safe. Throws with the
 * API's message so the modal can show a retry.
 */
export async function postDeposit(txHash: string): Promise<DepositResult> {
  const res = await fetch(`${API}/deposits`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ txHash }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(body?.message ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as DepositResult;
}

export type WithdrawResult = {
  completed: boolean;
  alreadyProcessed: boolean;
  /** USDCC returned, 6-dec base-unit string. */
  amount: string;
};

/**
 * Report a confirmed CollateralVault redeem (VTK→USDCC) so the backend verifies
 * the receipt on-chain, records the withdrawal, and re-syncs the ledger's
 * available balance to the wallet's now-lower VTK. Idempotent server-side via
 * the tx hash, so a retry after a failed post is safe. Throws with the API's
 * message so the modal can show a retry.
 */
export async function postWithdrawal(txHash: string): Promise<WithdrawResult> {
  const res = await fetch(`${API}/withdrawals`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ txHash }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(body?.message ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as WithdrawResult;
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

export type EnableTradingResult = {
  funded: boolean;
  alreadyFunded: boolean;
  amount: string;
  txHash: string | null;
};

/**
 * Operator seeds the user with USDCC (once per wallet). The onboarding wizard's
 * "enable trading" step calls this. Idempotent server-side, so a retry is safe.
 * Throws with the API's message so the wizard can show it.
 */
export async function enableTrading(wallet: string): Promise<EnableTradingResult> {
  // No body — the wallet comes from the URL. Sending a JSON content-type with an
  // empty body makes Fastify reject it ("Body cannot be empty …"), so omit it.
  const res = await fetch(`${API}/users/${wallet}/enable-trading`, {
    method: "POST",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(body?.message ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as EnableTradingResult;
}

/** On-chain allowances/balances (raw base-unit strings). */
export type Allowances = {
  walletAddress: string;
  /** USDCC allowance granted to the CollateralVault (gates the deposit step). */
  usdccToVault: string;
  /** VTK allowance granted to the Exchange (the settlement/enable-trading step). */
  vtkToExchange: string;
  usdccBalance: string;
  vtkBalance: string;
};

/** Reads the onboarding wizard uses to know which steps are done. Null on failure. */
export async function getAllowances(wallet: string): Promise<Allowances | null> {
  try {
    const res = await fetch(`${API}/users/${wallet}/allowances`);
    if (!res.ok) return null;
    return (await res.json()) as Allowances;
  } catch {
    return null;
  }
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

/** A raw position row as the API returns it (amounts are 1e8 strings). */
type PositionDTO = {
  marketId: string;
  outcomeIndex: number;
  availableAmount: string;
  lockedAmount: string;
  averageCost: string | null;
};

/**
 * The wallet's open positions. The endpoint is wallet-scoped, so every position
 * read shares this single fetch and narrows client-side — fine at this scale.
 * Null = fetch failed (callers must not read that as "no position").
 */
async function fetchCurrentPositions(
  wallet: string,
): Promise<PositionDTO[] | null> {
  try {
    const res = await fetch(
      `${API}/profiles/${wallet}/current-position?limit=100`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { items?: PositionDTO[] };
    return data.items ?? [];
  } catch {
    return null;
  }
}

/**
 * Available (unlocked) shares of one outcome, for sell preflight — locked
 * shares already back a resting ask, so they are not sellable again.
 * 0 = no position, null = fetch failed (preflight must not block on unknown).
 */
export async function getPositionShares(
  wallet: string,
  marketId: string,
  outcomeIndex: number,
): Promise<number | null> {
  const items = await fetchCurrentPositions(wallet);
  if (!items) return null;

  const pos = items.find(
    (p) => p.marketId === marketId && p.outcomeIndex === outcomeIndex,
  );
  return pos ? Number(pos.availableAmount) / AMOUNT_PER_SHARE : 0;
}

/** One outcome the wallet holds in a market. `shares`/`averageCost` are raw
 *  1e8 fixed-point strings (reuse markets/format helpers to render). */
export type UserMarketPosition = {
  outcomeIndex: number;
  shares: string;
  averageCost: string | null;
};

/** Non-zero holdings for one market, both outcomes. Null = fetch failed. */
export async function getUserMarketPositions(
  wallet: string,
  marketId: string,
): Promise<UserMarketPosition[] | null> {
  const items = await fetchCurrentPositions(wallet);
  if (!items) return null;

  return items
    .filter((p) => p.marketId === marketId)
    .map((p) => ({
      outcomeIndex: p.outcomeIndex,
      shares: (BigInt(p.availableAmount) + BigInt(p.lockedAmount)).toString(),
      averageCost: p.averageCost,
    }))
    .filter((p) => BigInt(p.shares) > 0n);
}

/** One resting order the wallet has in a market. Raw 1e8 strings. */
export type UserMarketOrder = {
  id: string;
  outcomeIndex: number;
  side: "BID" | "ASK";
  price: string;
  remaining: string;
};

/** A raw order row as the API returns it (amounts/prices are 1e8 strings). */
type OrderDTO = {
  id: string;
  marketId: string;
  outcomeIndex: number;
  side: "BID" | "ASK";
  price: string;
  quantity: string;
  filledQuantity: string;
  remainingQuantity: string;
  market: { title: string };
  outcome: { label: string };
};

/**
 * Every still-working order for the wallet. The endpoint filters by a single
 * status, so both working statuses are queried server-side and concatenated —
 * fetching one unfiltered page instead would let a run of filled/cancelled
 * orders crowd the open ones past the limit and report an empty book.
 * Null = fetch failed.
 */
async function fetchWorkingOrders(wallet: string): Promise<OrderDTO[] | null> {
  try {
    const pages = await Promise.all(
      ["OPEN", "PARTIALLY_FILLED"].map((status) =>
        fetch(`${API}/users/${wallet}/orders?status=${status}&limit=100`).then(
          (r) =>
            r.ok
              ? (r.json() as Promise<{ items?: OrderDTO[] }>)
              : { items: [] },
        ),
      ),
    );
    return pages.flatMap((p) => p.items ?? []);
  } catch {
    return null;
  }
}

/** Open + partially-filled orders the wallet has resting in one market.
 *  Null = fetch failed. */
export async function getUserMarketOpenOrders(
  wallet: string,
  marketId: string,
): Promise<UserMarketOrder[] | null> {
  const orders = await fetchWorkingOrders(wallet);
  if (!orders) return null;

  return orders
    .filter((o) => o.marketId === marketId)
    .map((o) => ({
      id: o.id,
      outcomeIndex: o.outcomeIndex,
      side: o.side,
      price: o.price,
      remaining: o.remainingQuantity,
    }));
}

/** Cancel a resting order (releases its locked collateral/shares). The wallet
 *  must own it. Returns true on success. */
export async function cancelUserOrder(
  orderId: string,
  wallet: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${API}/orders/${orderId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress: wallet }),
    });
    return res.ok;
  } catch {
    return false;
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

/** Lifetime traded notional across all fills, in whole cents (API is a 1e8
 *  fixed-point string, both sides of each trade counted). 0 on any failure. */
export async function getVolumeTraded(wallet: string): Promise<number> {
  try {
    const res = await fetch(`${API}/profiles/${wallet}/volume`);
    if (!res.ok) return 0;
    const data = (await res.json()) as { volume: string };
    return Math.round(Number(data.volume) / NOTIONAL_PER_CENT);
  } catch {
    return 0;
  }
}

/** Share of resolved markets the wallet held the winning outcome in, as a
 *  0–100 percentage (API returns a 0–1 fraction). 0 on any failure. */
export async function getWinRate(wallet: string): Promise<number> {
  try {
    const res = await fetch(`${API}/profiles/${wallet}/win-rate`);
    if (!res.ok) return 0;
    const data = (await res.json()) as { winRate: number };
    return (data.winRate ?? 0) * 100;
  } catch {
    return 0;
  }
}

/** Resting orders across every market, for the profile's Open Orders tab. */
export async function getOpenOrders(wallet: string): Promise<OpenOrderRow[]> {
  const orders = await fetchWorkingOrders(wallet);
  if (!orders) return [];

  return orders.map((o) => ({
    id: o.id,
    marketId: o.marketId,
    market: o.market.title,
    outcome: o.outcome.label,
    side: o.side === "BID" ? "BUY" : "SELL",
    priceCents: priceToCents(o.price),
    shares: amountToShares(o.quantity),
    filledShares: amountToShares(o.filledQuantity),
  }));
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
