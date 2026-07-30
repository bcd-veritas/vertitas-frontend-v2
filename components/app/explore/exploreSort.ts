import type { ApiMarket } from "@/lib/markets/types";
import { splitSides } from "../board/splitSides";

export type ExploreSort = "volume" | "closing" | "flips" | "longshots" | "newest";
export type ExploreStatus = "all" | "active" | "resolving" | "resolved";

export const EXPLORE_SORTS: { id: ExploreSort; label: string }[] = [
  { id: "volume", label: "volume" },
  { id: "closing", label: "closing soon" },
  { id: "flips", label: "coin flips" },
  { id: "longshots", label: "longshots" },
  { id: "newest", label: "newest" },
];

export const EXPLORE_STATUSES: { id: ExploreStatus; label: string }[] = [
  { id: "all", label: "all" },
  { id: "active", label: "active" },
  { id: "resolving", label: "resolving" },
  { id: "resolved", label: "resolved" },
];

const STATUS_MATCH: Record<
  Exclude<ExploreStatus, "all">,
  ApiMarket["status"]
> = {
  active: "ACTIVE",
  resolving: "ENDED",
  resolved: "RESOLVED",
};

/**
 * The percentage the row's LEFT mass shows.
 *
 * For a Yes/No pair that is the Yes side whether or not it leads — splitSides
 * pins Yes left on purpose, so a market crossing 50% doesn't flip its own row.
 * For anything else it is the leader. Null when the market has no usable price.
 */
export function leadPct(m: ApiMarket): number | null {
  return splitSides(m)?.[0]?.pct ?? null;
}

/** Unpriced markets sink to the bottom of every ordering rather than sorting as
 *  though they were 0% — they are absent data, not a low chance. */
function sinkNulls(a: number | null, b: number | null): number | null {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return null;
}

const byVolume = (a: ApiMarket, b: ApiMarket) => {
  const d = BigInt(b.volume) - BigInt(a.volume);
  return d > 0n ? 1 : d < 0n ? -1 : 0;
};

const COMPARE: Record<ExploreSort, (a: ApiMarket, b: ApiMarket) => number> = {
  volume: byVolume,
  closing: (a, b) => +new Date(a.endTime) - +new Date(b.endTime),
  newest: (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
  // Closest to an even split first.
  flips: (a, b) => {
    const [x, y] = [leadPct(a), leadPct(b)];
    const sunk = sinkNulls(x, y);
    if (sunk !== null) return sunk;
    return Math.abs(x! - 50) - Math.abs(y! - 50);
  },
  // Longest odds first. Leader-first markets always sit at or above 50, so they
  // naturally fall to the back — a market whose leader is at 95% is not a
  // longshot from any side.
  longshots: (a, b) => {
    const [x, y] = [leadPct(a), leadPct(b)];
    const sunk = sinkNulls(x, y);
    if (sunk !== null) return sunk;
    return x! - y!;
  },
};

/**
 * The whole list, filtered and ordered. Runs over every market rather than a
 * fetched page: search and the two price-derived sorts are only correct against
 * the full set, so /explore reveals rows in batches instead of paging the API.
 */
export function exploreRows(
  markets: ApiMarket[],
  { search, sort, status }: { search: string; sort: ExploreSort; status: ExploreStatus },
): ApiMarket[] {
  let list = markets;

  if (status !== "all") {
    const target = STATUS_MATCH[status];
    list = list.filter((m) => m.status === target);
  }

  const q = search.trim().toLowerCase();
  if (q) list = list.filter((m) => m.title.toLowerCase().includes(q));

  // Ties fall back to volume so the order is total — otherwise rows with equal
  // close times or equal odds shuffle between renders.
  return [...list].sort((a, b) => COMPARE[sort](a, b) || byVolume(a, b));
}
