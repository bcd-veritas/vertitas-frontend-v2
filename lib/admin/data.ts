import type {
  AccessResponse,
  DepositResult,
  FundsResponse,
  MarketDetail,
  MarketListOpts,
  MarketsResponse,
  RecentMarketsResponse,
  Role,
  StatsResponse,
  TimeseriesResponse,
  UserRow,
  UsersResponse,
  WhitelistStatusResponse,
  WhitelistSyncResult,
} from "./types";

// Calls the same-origin Next.js proxy (app/api/admin/[...path]/route.ts), which
// injects the x-admin-key header server-side. Never hits the middleware directly.
async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`/api/admin${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed (${res.status})`);
  return (await res.json()) as T;
}

export function getAdminAccess(wallet: string): Promise<AccessResponse> {
  return getJson(`/access?wallet=${encodeURIComponent(wallet)}`);
}

export function getAdminStats(): Promise<StatsResponse> {
  return getJson(`/stats`);
}

export function getAdminTimeseries(
  range: "24h" | "7d" | "30d" = "7d",
  bucket: "hour" | "day" = "day",
): Promise<TimeseriesResponse> {
  return getJson(`/timeseries?range=${range}&bucket=${bucket}`);
}

export function getAdminMarkets(
  page = 1,
  limit = 20,
  opts: MarketListOpts = {},
): Promise<MarketsResponse> {
  const q = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (opts.status) q.set("status", opts.status);
  if (opts.resolverType) q.set("resolverType", opts.resolverType);
  if (opts.category?.trim()) q.set("category", opts.category.trim());
  if (opts.search?.trim()) q.set("search", opts.search.trim());
  if (opts.sort) q.set("sort", opts.sort);
  return getJson(`/markets?${q.toString()}`);
}

export function getMarketDetail(id: string): Promise<MarketDetail> {
  return getJson(`/markets/${encodeURIComponent(id)}`);
}

export function getRecentMarkets(limit = 8): Promise<RecentMarketsResponse> {
  return getJson(`/recent-markets?limit=${limit}`);
}

export function getAdminUsers(
  page = 1,
  limit = 20,
  search = "",
  role = "",
): Promise<UsersResponse> {
  const q = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search.trim()) q.set("search", search.trim());
  if (role && role !== "ALL") q.set("role", role);
  return getJson(`/users?${q.toString()}`);
}

export async function setUserRole(
  id: string,
  role: Role,
  actorWallet: string,
): Promise<UserRow> {
  const res = await fetch(`/api/admin/users/${id}/role`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ role, actorWallet }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Role update failed (${res.status})`);
  }
  return (await res.json()) as UserRow;
}

export function getWhitelistStatus(
  ids: string[],
): Promise<WhitelistStatusResponse> {
  if (ids.length === 0) return Promise.resolve({ items: [] });
  const q = ids.map(encodeURIComponent).join(",");
  return getJson(`/users/whitelist-status?ids=${q}`);
}

export async function syncUserWhitelist(id: string): Promise<WhitelistSyncResult> {
  const res = await fetch(`/api/admin/users/${id}/whitelist-sync`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Whitelist sync failed (${res.status})`);
  }
  return (await res.json()) as WhitelistSyncResult;
}

export function getAdminFunds(): Promise<FundsResponse> {
  return getJson(`/funds`);
}

export async function depositFunds(
  amount: string,
  destination: "operator" | "treasury",
): Promise<DepositResult> {
  const res = await fetch(`/api/admin/funds/deposit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ amount, destination }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Deposit failed (${res.status})`);
  }
  return (await res.json()) as DepositResult;
}
