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
