// veritas-middleware admin dashboard endpoints (src/api/modules/admin/
// admin-dashboard.routes.ts).

export type Role = "USER" | "ADMIN" | "SUPERADMIN" | "VOTER" | "ORACLE_PARTICIPANT";

// GET /admin/access?wallet=0x...
export type AccessResponse = { isAdmin: boolean; role: Role | null };

// GET /admin/users?page&limit&search
export type UserRow = {
  id: string;
  walletAddress: string;
  username: string | null;
  email: string | null;
  role: Role;
  collateralAvailable: string; // 6-dec BigInt string
  collateralLocked: string; // 6-dec BigInt string
  createdAt: string; // ISO
};

export type UsersResponse = {
  items: UserRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

// GET /admin/stats
export type StatsResponse = {
  markets: {
    total: number;
    active: number;
    ended: number;
    resolved: number;
    cancelled: number;
  };
  volumeTotal: string; // 6-dec BigInt string
  tradesTotal: number;
  usersTotal: number;
};

// GET /admin/timeseries?range=24h|7d|30d&bucket=hour|day
export type TimeseriesResponse = {
  range: "24h" | "7d" | "30d";
  bucket: "hour" | "day";
  // t = ISO bucket start; volume = summed trade quantity (shares) at 1e8 scale, BigInt string
  buckets: { t: string; trades: number; volume: string }[];
};

// GET /admin/markets?page&limit
export type SideHealth = {
  tokenId: string;
  label: string;
  price: string | null; // 1e8 fixed-point
  bestBid: string | null;
  bestAsk: string | null;
  midpoint: string | null;
  spread: string | null;
  openInterest: string | null;
};

export type MarketHealth = {
  id: string;
  title: string;
  status: "ACTIVE" | "ENDED" | "RESOLVED" | "CANCELLED";
  category: string | null;
  endTime: string; // ISO
  volume: string; // 6-dec BigInt string
  resolverType: string;
  createdAt: string; // ISO
  resolvedAt: string | null;
  disputedAt: string | null;
  attention: string[];
  yes: SideHealth;
  no: SideHealth;
};

export type MarketsResponse = {
  items: MarketHealth[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type MarketListOpts = {
  status?: string;
  category?: string;
  resolverType?: string;
  search?: string;
  sort?: string;
};

// GET /admin/markets/:id
export type MarketDetailOutcome = {
  index: number;
  label: string;
  tokenId: string;
  price: string | null;
  bestBid: string | null;
  bestAsk: string | null;
  spread: string | null;
  openInterest: string | null;
};

export type MarketDetail = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  isFeatured: boolean;
  status: string;
  winningOutcome: number | null;
  volume: string;
  createdAt: string;
  endTime: string;
  expiresAt: string | null;
  resolvedAt: string | null;
  disputedAt: string | null;
  resolverType: string;
  resolutionSource: string;
  resolverData: string | null;
  feeBps: number;
  tickSize: string;
  minOrderSize: string;
  maxOrderSize: string | null;
  outcomeCount: number;
  marketAddress: string;
  contractAddress: string;
  conditionId: string | null;
  resolutionRouter: string | null;
  collateralToken: string;
  owner: string;
  attention: string[];
  outcomes: MarketDetailOutcome[];
};

// GET /admin/recent-markets?limit=N  → newest-first
export type RecentMarket = {
  id: string;
  title: string;
  status: string;
  category: string | null;
  createdAt: string;
  volume: string;
};

export type RecentMarketsResponse = { items: RecentMarket[] };

// GET /admin/users/whitelist-status?ids=...
export type WhitelistFlags = {
  committee: boolean;
  proposer: boolean;
  disputer: boolean;
};

export type WhitelistStatusItem =
  | {
      id: string;
      status: "known";
      expected: WhitelistFlags;
      actual: WhitelistFlags;
      inSync: boolean;
    }
  | {
      id: string;
      status: "unknown";
      expected: WhitelistFlags;
      actual: null;
      inSync: false;
    };

export type WhitelistStatusResponse = { items: WhitelistStatusItem[] };

// POST /admin/users/:id/whitelist-sync
export type WhitelistSyncResult = {
  status: "synced" | "failed" | "noop";
  calls: string[];
  txHashes: string[];
  error?: string;
};

// GET /admin/funds
export type FundsResponse = {
  vtkDecimals: number;
  usdccDecimals: number;
  operator: {
    address: string;
    eth: string | null;
    usdcc: string | null;
    vtk: string | null;
  };
  treasury: { address: string; vtk: string | null };
  vault: { address: string; usdcc: string | null };
  vtkTotalSupply: string | null;
  solvency: { vtkSupply: string | null; vaultUsdcc: string | null; inSync: boolean };
};

// POST /admin/funds/deposit
export type DepositResult = {
  status: "done" | "failed";
  txHashes: string[];
  error?: string;
};
