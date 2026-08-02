// User identity (username/email) against the middleware's /users routes,
// plus the wallet's live portfolio (value, positions, open orders, trade
// history, markets traded) against the Fastify profile/order/trade routes.

import type { ActivityRow, OpenOrderRow, PositionRow } from "./mock";
import type { Role } from "@/lib/admin/types";

const API = process.env.NEXT_PUBLIC_API_URL;

// Fixed-point scales mirror the middleware's shared/utils/fixed-point.ts:
//   AMOUNT_SCALE 1e6 — shares (⇒ 1 share = 1e6)
//   PRICE_SCALE  1e6 — 0–1 probability fraction, so 1¢ = 1e4 price units
// Everything monetary — order cost, the collateral ledger, and
// getTotalValueByWallet's notional — is tracked in AMOUNT_SCALE dollars, so
// $1 = 1e6 (⇒ 1¢ = 1e4).
const AMOUNT_PER_SHARE = 1_000_000; // 1e6
const PRICE_PER_CENT = 10_000; // 1e4
const NOTIONAL_PER_CENT = 10_000; // 1e4 (1e6 dollars → cents)
const NOTIONAL_PER_DOLLAR = 1_000_000; // 1e6 (was 1e8 before the 1e6 migration)

const priceToCents = (p: string): number => Math.round(Number(p) / PRICE_PER_CENT);
const amountToShares = (a: string): number => Math.round(Number(a) / AMOUNT_PER_SHARE);

// Unrounded counterparts. The two above are for a value that is rendered and
// then forgotten; anything that feeds arithmetic has to keep its fraction.
// Rounding first and multiplying after is what made the Positions table sum to
// $216.96 against a hero of $216.80 — 49.7143 shares became 50, and 77.5862¢
// became 78¢, in the same row.
const exactCents = (p: string): number => Number(p) / PRICE_PER_CENT;
const exactShares = (a: string): number => Number(a) / AMOUNT_PER_SHARE;

// Two deliberate output conventions, both fed by the shared fetch helpers below:
//   • market-scoped reads (terminal) return RAW 1e6 strings — callers render
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
  // The server awaits a Sepolia receipt before replying, so this is slow by
  // design; the deadline only exists so a stuck tx can't hang the caller.
  const res = await fetch(`${API}/users/${wallet}/enable-trading`, {
    method: "POST",
    signal: AbortSignal.timeout(90_000),
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

/**
 * Shared TanStack query key for the topbar's collateral readout — exported so
 * anything that changes a wallet's ledger balance (a deposit, a withdrawal)
 * can invalidate the exact same cache entry `AccountBalances` reads, instead
 * of retyping the key by hand in multiple files.
 */
export const collateralQueryKey = (wallet: string | undefined) =>
  ["collateral", wallet] as const;

/** Ledger balances in dollars (API is 1e6 fixed-point strings). Null = fetch failed. */
export async function getCollateralDollars(
  wallet: string,
): Promise<{ available: number; locked: number } | null> {
  try {
    const res = await fetch(`${API}/profiles/${wallet}/collateral`);
    if (!res.ok) return null;
    const data = (await res.json()) as { available: string; locked: string };
    return {
      available: Number(data.available) / 1e6,
      locked: Number(data.locked) / 1e6,
    };
  } catch {
    return null;
  }
}

/**
 * Forces a fresh on-chain read before returning — unlike `getCollateralDollars`,
 * which just reads the DB. Same 1e6 → dollars conversion, same return shape,
 * so a caller can drop this straight into the `["collateral", wallet]` query
 * cache in place of a `getCollateralDollars` result. Expensive (an RPC call
 * server-side): call this from explicit user action only, never from a
 * passive refresh — see the sync button in `components/app/Topbar.tsx`.
 */
export async function syncUserBalances(
  wallet: string,
): Promise<{ available: number; locked: number }> {
  const res = await fetch(`${API}/users/sync-balances`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress: wallet }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      message?: string;
    } | null;

    throw new Error(body?.message ?? `HTTP ${res.status}`);
  }

  const data = (await res.json()) as {
    collateralAvailableAmount: string;
    collateralLockedAmount: string;
  };

  return {
    available: Number(data.collateralAvailableAmount) / 1e6,
    locked: Number(data.collateralLockedAmount) / 1e6,
  };
}

/** A raw position row as the API returns it (amounts are 1e6 strings). */
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
 *  1e6 fixed-point strings (reuse markets/format helpers to render). */
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

/** One resting order the wallet has in a market. Raw 1e6 strings. */
export type UserMarketOrder = {
  id: string;
  outcomeIndex: number;
  side: "BID" | "ASK";
  price: string;
  remaining: string;
};

/** A raw order row as the API returns it (amounts/prices are 1e6 strings). */
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
  /** Mark value, in whole cents, of the positions we can honestly price —
   *  ACTIVE (marked off the live book) and RESOLVED (settled at $1 or $0).
   *  Deliberately EXCLUDES markets awaiting the oracle: see `resolvingShares`. */
  valueCents: number;
  /** Cost basis of those same positions. This is the denominator the return
   *  percentage needs; using the hero total instead diluted a position gain
   *  across idle cash. */
  costBasisCents: number;
  /** Unrealized PnL across those same positions, whole cents. */
  pnlCents: number;
  /** Shares sitting in markets that have closed and not yet resolved. They are
   *  worth something, but nothing can say what until the oracle reports, so
   *  they are counted as shares and never as dollars. */
  resolvingShares: number;
  /** Settled, winning, unclaimed positions. */
  claimableCount: number;
  positions: PositionRow[];
};

type TotalPositionValueResponse = {
  totalValue: string;
  positions: {
    position: {
      id: string;
      marketId: string;
      outcomeIndex: number;
      averageCost: string | null;
      lockedAmount: string;
      redeemedAmount: string;
      market: {
        title: string;
        status: PositionRow["status"];
        winningOutcome: number | null;
      };
      outcome: { label: string };
    };
    markPrice: string;
    totalAmount: string;
    /** Per-position mark value, 1e6. Summing these gives `totalValue` exactly. */
    value: string;
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
  const empty: PortfolioValue = {
    valueCents: 0,
    costBasisCents: 0,
    pnlCents: 0,
    resolvingShares: 0,
    claimableCount: 0,
    positions: [],
  };
  try {
    const res = await fetch(`${API}/profiles/${wallet}/total-position-value`);
    if (!res.ok) return empty;

    const data = (await res.json()) as TotalPositionValueResponse;

    const positions: PositionRow[] = (data.positions ?? []).map((p) => {
      const { market, outcomeIndex } = p.position;
      const settled = market.status === "RESOLVED" && market.winningOutcome != null;
      const won = settled ? market.winningOutcome === outcomeIndex : null;
      const shares = exactShares(p.totalAmount);
      return {
        id: p.position.id,
        marketId: p.position.marketId,
        market: market.title,
        outcome: p.position.outcome.label,
        shares,
        // Null, not a fallback to mark. Substituting mark used to force the row
        // to exactly $0.00 PnL, which reads as "flat" when it means "unknown".
        avgCostCents:
          p.position.averageCost != null ? exactCents(p.position.averageCost) : null,
        curPriceCents: exactCents(p.markPrice),
        valueCents: Number(p.value) / NOTIONAL_PER_CENT,
        status: market.status,
        won,
        claimable: won === true && Number(p.position.redeemedAmount) < Number(p.totalAmount),
        lockedShares: exactShares(p.position.lockedAmount),
      };
    });

    // ENDED = the book is closed and the oracle has not reported. The API marks
    // those at the best resting ask, and with no ask it falls back to the
    // position's OWN average cost — so their "value" is either stale or simply
    // the user's cost echoed back. Neither is a market price, so they are kept
    // out of the headline figure entirely rather than dressed up as one.
    const priceable = positions.filter(
      (r) => r.status === "ACTIVE" || r.status === "RESOLVED",
    );

    const valueCents = priceable.reduce((sum, r) => sum + r.valueCents, 0);
    const costBasisCents = priceable.reduce(
      (sum, r) => sum + (r.avgCostCents == null ? r.valueCents : r.shares * r.avgCostCents),
      0,
    );

    return {
      valueCents: Math.round(valueCents),
      costBasisCents: Math.round(costBasisCents),
      pnlCents: Math.round(valueCents - costBasisCents),
      resolvingShares: positions
        .filter((r) => r.status === "ENDED")
        .reduce((sum, r) => sum + r.shares, 0),
      claimableCount: positions.filter((r) => r.claimable).length,
      positions,
    };
  } catch {
    return empty;
  }
}

export type PnlPoint = { t: number; usd: number };

/**
 * The wallet's PnL time-series for the profile chart. Historical points are
 * cumulative realized PnL per day; the terminal point folds in current
 * unrealized, so the line ends at the same total the hero PnL shows. The API's
 * `pnl` is a 1e6 fixed-point dollar string — it comes out of the middleware's
 * `calculateFixedPointCost` (quantity × price ÷ PRICE_SCALE), so it carries the
 * same AMOUNT_SCALE as every other monetary field. Empty array on any failure or for a
 * wallet with no trading history — the chart then simply renders nothing.
 */
export async function getPnlSeries(wallet: string): Promise<PnlPoint[]> {
  try {
    const res = await fetch(`${API}/users/${wallet}/pnl/history`);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      points?: { timestamp: string; pnl: string }[];
    };
    return (data.points ?? []).map((p) => ({
      t: new Date(p.timestamp).getTime(),
      usd: Number(p.pnl) / NOTIONAL_PER_DOLLAR,
    }));
  } catch {
    return [];
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

/** Lifetime traded notional across all fills, in whole cents (API is a 1e6
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

/** Market ids where the wallet still has unredeemed winnings (resolved market,
 *  winning outcome, shares not yet claimed). Empty array on any failure — the
 *  markets filter then simply shows nothing rather than erroring. */
export async function getUnredeemedMarketIds(wallet: string): Promise<string[]> {
  try {
    const res = await fetch(`${API}/profiles/${wallet}/unredeemed`);
    if (!res.ok) return [];
    const data = (await res.json()) as { marketIds?: string[] };
    return data.marketIds ?? [];
  } catch {
    return [];
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
): Promise<{ rows: ActivityRow[]; total: number }> {
  try {
    const res = await fetch(
      `${API}/profiles/${wallet}/trades?limit=${limit}`,
    );
    if (!res.ok) return { rows: [], total: 0 };
    // `total` is the wallet's whole trade count, not the page — the tab uses it
    // to say when it is showing a slice rather than stopping silently at 50.
    const data = (await res.json()) as { items?: TradeDTO[]; total?: number };
    const lower = wallet.toLowerCase();
    const rows = (data.items ?? []).map((t) => ({
      id: t.id,
      t: new Date(t.createdAt).getTime(),
      action: (t.buyerWallet.toLowerCase() === lower ? "BOUGHT" : "SOLD") as
        | "BOUGHT"
        | "SOLD",
      market: t.market.title,
      outcome: t.outcome.label,
      shares: amountToShares(t.quantity),
      priceCents: priceToCents(t.price),
    }));
    return { rows, total: data.total ?? rows.length };
  } catch {
    return { rows: [], total: 0 };
  }
}
