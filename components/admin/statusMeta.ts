// Shared status/attention color meta for admin market views. Hex values are
// part of the Live Signal palette (see globals.css tokens + KpiStrip accents).

export const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "#7fae8b",
  ENDED: "#a89f9c",
  RESOLVED: "#f6dcd4",
  CANCELLED: "#c97a6d",
};

export const ATTENTION_META: Record<string, { label: string; color: string }> = {
  unresolved: { label: "unresolved", color: "#c97a6d" },
  disputed: { label: "disputed", color: "#c97a6d" },
  no_book: { label: "no book", color: "#a89f9c" },
};

/** Warning amber — closing-soon countdowns; matches the KPI "Users" accent. */
export const AMBER = "#F6C177";

/** Neutral blue for "all markets" — matches the KPI "Volume" accent. */
export const BLUE = "#7FB3FF";

/** Middleware enum -> compact board label. */
export const RESOLVER_LABEL: Record<string, string> = {
  UMA: "UMA",
  CHAINLINK_DATA_FEED: "CL FEED",
  CHAINLINK_DATA_STREAM: "CL STREAM",
  ADMIN: "ADMIN",
};
