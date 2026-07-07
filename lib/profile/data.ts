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
