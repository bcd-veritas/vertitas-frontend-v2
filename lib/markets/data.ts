import type {
  ApiMarket,
  ApiOutcome,
  FeaturedChartSeries,
  FeaturedComment,
  FeaturedMarket,
  MarketDTO,
  OrderBookData,
  OutcomeDTO,
  PricePoint,
} from "./types";

const envPath = process.env.NEXT_PUBLIC_API_URL;

function mapOutcome(dto: OutcomeDTO): ApiOutcome {
  return {
    id: dto.id,
    marketId: dto.marketId,
    index: dto.index,
    tokenId: dto.tokenId,
    label: dto.label,
    // Present only when the list was fetched ?withPrices=true; null = unpriced.
    price: dto.price ?? null,
  };
}

function mapMarket(dto: MarketDTO): ApiMarket {
  return {
    id: dto.id,
    title: dto.title,
    description: dto.description,
    category: dto.category,
    isFeatured: dto.isFeatured,
    volume: dto.volume,
    endTime: dto.endTime,
    status: dto.status,
    feeBps: dto.feeBps,
    createdAt: dto.createdAt,

    resolutionSource: dto.resolutionSource ?? "",
    conditionId: dto.conditionId,
    tickSize: dto.tickSize,
    minOrderSize: dto.minOrderSize,

    outcomes: dto.outcomes.map(mapOutcome),
  };
}

export async function getMarkets(category?: string): Promise<ApiMarket[]> {
  const url =
    category && category !== "All"
      ? `${envPath}/markets?category=${encodeURIComponent(category)}&withPrices=true`
      : `${envPath}/markets?withPrices=true`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error("Failed to fetch markets");
  }

  const data = await res.json();
  const markets: MarketDTO[] = data.items;
  return markets.map(mapMarket);
}

type FeaturedCommentDTO = {
  id: string;
  content: string;
  likesCount: number;
  createdAt: string;
  user: { username: string | null; walletAddress: string } | null;
  replies?: FeaturedCommentDTO[];
};
type FeaturedMarketDTO = MarketDTO & {
  chart: FeaturedChartSeries[];
  comments: FeaturedCommentDTO[];
};

function mapComment(c: FeaturedCommentDTO): FeaturedComment {
  return {
    id: c.id,
    content: c.content,
    likesCount: c.likesCount,
    createdAt: c.createdAt,
    user: c.user,
    replies: (c.replies ?? []).map(mapComment),
  };
}

export async function getFeaturedMarkets(): Promise<FeaturedMarket[]> {
  const res = await fetch(`${envPath}/markets/featured`);
  if (!res.ok) throw new Error("Failed to fetch featured markets");

  const data = await res.json();
  const items: FeaturedMarketDTO[] = data.items;
  return items.map((dto) => ({
    ...mapMarket(dto),
    chart: dto.chart ?? [],
    comments: (dto.comments ?? []).map(mapComment),
  }));
}

/**
 * Real comments for a single market. Expects `GET /markets/:id/comments` to
 * return `{ items: Comment[] }` (or a bare array). Returns [] gracefully until
 * that endpoint exists, so the terminal renders an empty state, not an error.
 */
export async function getMarketComments(
  marketId: string,
): Promise<FeaturedComment[]> {
  const res = await fetch(
    `${envPath}/markets/${encodeURIComponent(marketId)}/comments`,
  );
  if (!res.ok) return [];

  const data = await res.json();
  const items: FeaturedCommentDTO[] = Array.isArray(data)
    ? data
    : (data.items ?? []);
  return items.map(mapComment);
}

export async function getMarketCategories(): Promise<string[]> {
  const res = await fetch(`${envPath}/markets/categories`);

  if (!res.ok) throw new Error("Failed to fetch market categories");
  return (await res.json()) as string[];
}

export async function getMarket(id: string): Promise<ApiMarket | null> {
  const res = await fetch(`${envPath}/markets/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to fetch market");

  const dto: MarketDTO = await res.json();
  return mapMarket(dto);
}

/**
 * Aggregated CLOB ladder for one outcome token. Degrades to an empty book on
 * any failure so the panel renders its empty state instead of erroring.
 */
export async function getOrderBook(tokenId: string): Promise<OrderBookData> {
  try {
    const res = await fetch(
      `${envPath}/order-book/${encodeURIComponent(tokenId)}`,
    );
    if (!res.ok) return { bids: [], asks: [] };

    const data = await res.json();
    return { bids: data.bids ?? [], asks: data.asks ?? [] };
  } catch {
    return { bids: [], asks: [] };
  }
}

const PRICE_HISTORY_PAGE = 100;

// trade-price history for one outcome token, oldest-first for charting. fetches page 1, then any remaining pages (up to maxPoints) in parallel. degrades to [] on any failure.
export async function getPriceHistory(
  tokenId: string,
  maxPoints = 500,
): Promise<PricePoint[]> {
  const base = `${envPath}/order-book/${encodeURIComponent(tokenId)}/price-history`;
  try {
    const first = await fetch(`${base}?limit=${PRICE_HISTORY_PAGE}`);
    if (!first.ok) return [];

    const data = await first.json();
    const items: PricePoint[] = data.items ?? [];
    const total: number =
      typeof data.total === "number" ? data.total : items.length;

    const want = Math.min(total, maxPoints);
    const pages = Math.ceil(want / PRICE_HISTORY_PAGE);
    if (pages > 1) {
      const rest = await Promise.all(
        Array.from({ length: pages - 1 }, (_, i) =>
          fetch(`${base}?limit=${PRICE_HISTORY_PAGE}&page=${i + 2}`)
            .then((r) => (r.ok ? r.json() : { items: [] }))
            .then((d): PricePoint[] => d.items ?? [])
            .catch((): PricePoint[] => []),
        ),
      );
      for (const page of rest) items.push(...page);
    }

    // for chart
    return items.slice(0, maxPoints).reverse();
  } catch {
    return [];
  }
}
