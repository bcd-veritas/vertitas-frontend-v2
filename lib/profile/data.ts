// User identity (username/email) against the middleware's /users routes.

const API = process.env.NEXT_PUBLIC_API_URL;

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

/** Throws with the API's message (validation, username/email taken). */
export async function updateUserIdentity(
  wallet: string,
  data: { username: string | null; email: string | null },
): Promise<UserIdentity> {
  const res = await fetch(`${API}/users/${wallet}`, {
    method: "PATCH",
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
  try {
    const res = await fetch(
      `${API}/profiles/${wallet}/current-position?limit=100`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      items?: {
        marketId: string;
        outcomeIndex: number;
        availableAmount: string;
        lockedAmount: string;
        averageCost: string | null;
      }[];
    };
    return (data.items ?? [])
      .filter((p) => p.marketId === marketId)
      .map((p) => ({
        outcomeIndex: p.outcomeIndex,
        shares: (BigInt(p.availableAmount) + BigInt(p.lockedAmount)).toString(),
        averageCost: p.averageCost,
      }))
      .filter((p) => BigInt(p.shares) > 0n);
  } catch {
    return null;
  }
}

/** One resting order the wallet has in a market. Raw 1e8 strings. */
export type UserMarketOrder = {
  id: string;
  outcomeIndex: number;
  side: "BID" | "ASK";
  price: string;
  remaining: string;
};

/** Open + partially-filled orders the wallet has resting in one market. The API
 *  is wallet-scoped and single-status, so query both statuses and filter to the
 *  market client-side. Null = fetch failed. */
export async function getUserMarketOpenOrders(
  wallet: string,
  marketId: string,
): Promise<UserMarketOrder[] | null> {
  try {
    const pages = await Promise.all(
      ["OPEN", "PARTIALLY_FILLED"].map((status) =>
        fetch(`${API}/users/${wallet}/orders?status=${status}&limit=100`).then(
          (r) =>
            r.ok
              ? (r.json() as Promise<{
                  items?: {
                    id: string;
                    marketId: string;
                    outcomeIndex: number;
                    side: "BID" | "ASK";
                    price: string;
                    remainingQuantity: string;
                  }[];
                }>)
              : { items: [] },
        ),
      ),
    );
    return pages
      .flatMap((p) => p.items ?? [])
      .filter((o) => o.marketId === marketId)
      .map((o) => ({
        id: o.id,
        outcomeIndex: o.outcomeIndex,
        side: o.side,
        price: o.price,
        remaining: o.remainingQuantity,
      }));
  } catch {
    return null;
  }
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
