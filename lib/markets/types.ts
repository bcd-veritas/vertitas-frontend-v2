// Mirrors veritas-middleware's serialized GET /markets shapes.
export type MarketStatus = "ACTIVE" | "ENDED" | "RESOLVED" | "CANCELLED";

export type ApiOutcome = {
  id: string;
  marketId: string;
  index: number;
  tokenId: string;
  label: string;
  /** Fixed-point price (1e8 == 100%), or null when the book has no price. */
  price: string | null;
};

export type ApiMarket = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  isFeatured: boolean;
  /** USDC volume as a 6-decimals bigint string (middleware serializes BigInt) */
  volume: string;
  /** ISO datetime */
  endTime: string;
  status: MarketStatus;
  feeBps: number;
  createdAt: string;
  outcomes: ApiOutcome[];
  resolutionSource: string;
  conditionId: string | null;
  tickSize: string; // fixed-point price units, "1000000" = 1¢
  minOrderSize: string; // fixed-point amount units, "100000000" = 1 share
};

// featured part
export type FeaturedChartPoint = { t: string; price: string };
export type FeaturedChartSeries = {
  outcomeIndex: number;
  label: string;
  points: FeaturedChartPoint[];
};

export type CommentAuthor = { username: string | null; walletAddress: string };
export type FeaturedComment = {
  id: string;
  content: string;
  likesCount: number;
  createdAt: string;
  user: CommentAuthor | null;
  replies: FeaturedComment[];
};

export type FeaturedMarket = ApiMarket & {
  chart: FeaturedChartSeries[];
  comments: FeaturedComment[];
};

export type OutcomeDTO = {
  id: string;
  marketId: string;
  index: number;
  tokenId: string;
  label: string;
  createdAt: string;
  updatedAt: string;
  price?: string | null;
};

export type MarketDTO = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  isFeatured: boolean;

  volume: string;

  endTime: string;
  createdAt: string;

  status: MarketStatus;
  feeBps: number;

  resolutionSource: string | null;
  conditionId: string | null;
  tickSize: string;
  minOrderSize: string;

  outcomes: OutcomeDTO[];
};

// ---- Order book (GET /order-book/:tokenId, server-aggregated levels) ----
export type BookLevel = {
  price: string;
  quantity: string;
  orderCount: number;
};

export type OrderBookData = {
  bids: BookLevel[];
  asks: BookLevel[];
};

// ---- Price history (GET /order-book/:tokenId/price-history) ----
export type PricePoint = {
  id: string;
  price: string;
  quantity: string;
  createdAt: string;
};

// GET /trades?marketId=&limit= (public) — recent trades for a market
export type MarketTrade = {
  id: string;
  outcomeIndex: number;
  price: string; // 1e8 fixed-point
  quantity: string; // shares, fixed-point
  buyerWallet: string;
  sellerWallet: string;
  createdAt: string; // ISO
};

// GET /markets/:id/top-holders (public) — positions with holdings > 0, incl. user
export type MarketHolder = {
  id: string;
  walletAddress: string;
  outcomeIndex: number;
  availableAmount: string; // shares, fixed-point
  lockedAmount: string;
  averageCost: string | null; // 1e8 fixed-point, or null
  user: { id: string; username: string | null } | null;
};

export type MarketHoldersResponse = {
  items: MarketHolder[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

// GET /markets/:id/resolution
export type MarketResolution = {
  marketId: string;
  status: string;
  resolution: {
    winningOutcome: number | null;
    winningLabel: string | null;
    proposedAt: string;
    resolvedAt: string | null;
    disputed: boolean;
    disputedAt: string | null;
    disputeResolved: boolean;
  } | null;
};
