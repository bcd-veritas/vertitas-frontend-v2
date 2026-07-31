// Deterministic per-wallet mock data for the profile UI round.
// Everything derives from the address hash — stable across reloads and SSR.

export type ActivityRow = {
  id: string;
  /** epoch ms (UTC), newest row first in ProfileMock.activity */
  t: number;
  action: "BOUGHT" | "SOLD";
  market: string;
  outcome: string;
  shares: number;
  priceCents: number;
};

/** An open holding built up from matched trades. */
export type PositionRow = {
  id: string;
  marketId: string;
  market: string;
  outcome: string;
  /** EXACT share count — shares are fixed-point and routinely fractional
   *  (49.7143 is a real holding). Rounding here and multiplying afterwards is
   *  what made the table disagree with the hero, so rounding happens at the
   *  point of display and nowhere else. */
  shares: number;
  /** Average entry price in cents, exact. Null when the position was fully
   *  closed and reopened, so no entry price was ever recorded. */
  avgCostCents: number | null;
  /** Mark price for the outcome in cents, exact. */
  curPriceCents: number;
  /** Mark value in cents, taken from the API's own per-position figure rather
   *  than recomputed — these sum to exactly the total the hero shows. */
  valueCents: number;
  /** Market lifecycle. ENDED means the book is closed and the oracle has not
   *  reported, so `curPriceCents` is not a price anyone can trade at. */
  status: "ACTIVE" | "ENDED" | "RESOLVED" | "CANCELLED";
  /** RESOLVED only: did this outcome win. Null while undecided. */
  won: boolean | null;
  /** Won, settled, and not yet claimed. */
  claimable: boolean;
  /** Shares backing a resting order — already committed, not sellable again. */
  lockedShares: number;
};

/** A resting order sitting in a market's book. */
export type OpenOrderRow = {
  id: string;
  marketId: string;
  market: string;
  outcome: string;
  side: "BUY" | "SELL";
  priceCents: number;
  shares: number;
  /** 0 = fully open, else partially filled. */
  filledShares: number;
};

export type ProfileMock = {
  /** Always null this round — exercises the address-fallback path. */
  username: string | null;
  portfolioValueCents: number;
  pnlAllTimeCents: number;
  /** 90 daily points, oldest first. */
  pnlSeries: { t: number; usd: number }[];
  volumeTradedCents: number;
  marketsTraded: number;
  winRatePct: number;
  /** Current open holdings. */
  positions: PositionRow[];
  /** Current resting orders. */
  openOrders: OpenOrderRow[];
  /** 12 rows, newest first. */
  activity: ActivityRow[];
};

/** FNV-1a — also used by GradientAvatar to derive hues. */
export function hashAddress(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY_MS = 86_400_000;
/** Fixed anchor (JUL 5 2026 UTC) so SSR and client render identical data. */
const EPOCH_ANCHOR = Date.UTC(2026, 6, 5);

const MARKET_TITLES = [
  "F1 2026 Drivers' Champion?",
  "Will BTC close above $120k this quarter?",
  "Premier League 2026/27 champion?",
  "Will the Fed cut rates at the next meeting?",
  "El Clásico result — Madrid vs Barcelona?",
  "Will ETH ETF net inflows exceed $5B this month?",
  "Will SOL be top 3 by market cap on expiry?",
  "Will annual CPI print below 3 percent?",
];
const OUTCOME_LABELS = ["Yes", "No", "Verstappen", "Norris", "Arsenal", "Real Madrid", "Draw"];

export function mockProfile(address: string): ProfileMock {
  const rng = mulberry32(hashAddress(address.toLowerCase()));

  // 90-day PNL random walk (slight upward drift; cents precision).
  let usd = 0;
  const pnlSeries = Array.from({ length: 90 }, (_, i) => {
    usd += (rng() - 0.47) * 180;
    return { t: EPOCH_ANCHOR - (89 - i) * DAY_MS, usd: Math.round(usd * 100) / 100 };
  });
  const pnlAllTimeCents = Math.round(pnlSeries[pnlSeries.length - 1].usd * 100);

  const depositCents = Math.round((5_000 + rng() * 8_000) * 100);
  const portfolioValueCents = Math.max(5_000, depositCents + pnlAllTimeCents);

  const volumeTradedCents = Math.round((8_000 + rng() * 30_000) * 100);
  const marketsTraded = 5 + Math.floor(rng() * 18);
  const winRatePct = Math.round(35 + rng() * 40);

  let cursor = EPOCH_ANCHOR;
  const activity: ActivityRow[] = Array.from({ length: 12 }, (_, i) => {
    cursor -= (0.3 + rng() * 1.4) * DAY_MS;
    return {
      id: `act_${i + 1}`,
      t: Math.round(cursor),
      action: rng() < 0.55 ? "BOUGHT" : "SOLD",
      market: MARKET_TITLES[Math.floor(rng() * MARKET_TITLES.length)],
      outcome: OUTCOME_LABELS[Math.floor(rng() * OUTCOME_LABELS.length)],
      shares: 5 + Math.floor(rng() * 400),
      priceCents: 3 + Math.floor(rng() * 94),
    };
  });

  const positions: PositionRow[] = Array.from(
    { length: 4 + Math.floor(rng() * 4) },
    (_, i): PositionRow => {
      const avgCostCents = 5 + Math.floor(rng() * 90);
      const curPriceCents = Math.max(1, Math.min(99, avgCostCents + Math.floor((rng() - 0.5) * 44)));
      const m = Math.floor(rng() * MARKET_TITLES.length);
      const shares = 10 + Math.floor(rng() * 500);
      return {
        id: `pos_${i + 1}`,
        marketId: `mkt_${m}`,
        market: MARKET_TITLES[m],
        outcome: OUTCOME_LABELS[Math.floor(rng() * OUTCOME_LABELS.length)],
        shares,
        avgCostCents,
        curPriceCents,
        valueCents: shares * curPriceCents,
        status: "ACTIVE",
        won: null,
        claimable: false,
        lockedShares: 0,
      };
    },
  );

  const openOrders: OpenOrderRow[] = Array.from(
    { length: 2 + Math.floor(rng() * 4) },
    (_, i): OpenOrderRow => {
      const shares = 20 + Math.floor(rng() * 400);
      const m = Math.floor(rng() * MARKET_TITLES.length);
      return {
        id: `ord_${i + 1}`,
        marketId: `mkt_${m}`,
        market: MARKET_TITLES[m],
        outcome: OUTCOME_LABELS[Math.floor(rng() * OUTCOME_LABELS.length)],
        side: rng() < 0.5 ? "BUY" : "SELL",
        priceCents: 3 + Math.floor(rng() * 94),
        shares,
        filledShares: rng() < 0.4 ? Math.floor(shares * rng() * 0.8) : 0,
      };
    },
  );

  return {
    username: null,
    portfolioValueCents,
    pnlAllTimeCents,
    pnlSeries,
    volumeTradedCents,
    marketsTraded,
    winRatePct,
    positions,
    openOrders,
    activity,
  };
}
