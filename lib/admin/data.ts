import type {
  AccessResponse,
  MarketsResponse,
  RecentMarketsResponse,
  StatsResponse,
  TimeseriesResponse,
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

export function getAdminMarkets(page = 1, limit = 20): Promise<MarketsResponse> {
  return getJson(`/markets?page=${page}&limit=${limit}`);
}

export function getRecentMarkets(limit = 8): Promise<RecentMarketsResponse> {
  return getJson(`/recent-markets?limit=${limit}`);
}
