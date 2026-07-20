import type {
  ApiMarket,
  ApiOutcome,
  FeaturedChartSeries,
  FeaturedComment,
  FeaturedMarket,
  MarketDTO,
  MarketHoldersResponse,
  MarketResolution,
  MarketTrade,
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
    resolverType: dto.resolverType,
    marketAddress: dto.marketAddress,
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
  parentId?: string | null;
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
    parentId: c.parentId ?? null,
    user: c.user,
    replies: (c.replies ?? []).map(mapComment),
  };
}

/** Maps a single comment object (POST/PATCH/like responses + realtime payloads),
 *  not the `{ items }` list shape. Exported so the realtime layer can reuse it. */
export function mapCommentPayload(c: FeaturedCommentDTO): FeaturedComment {
  return mapComment(c);
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

/** Surfaces the API's `{ message }` on failure so callers can show it inline. */
async function commentWrite(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: Record<string, unknown>,
): Promise<unknown> {
  const res = await fetch(`${envPath}${url}`, {
    method,
    // Only set Content-Type when there's actually a body — Fastify's JSON
    // parser 400s on an empty body sent with this header (like/unlike have
    // no body; FST_ERR_CTP_EMPTY_JSON_BODY).
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(payload?.message ?? `HTTP ${res.status}`);
  }

  return res.json().catch(() => null);
}

export async function createComment(
  marketId: string,
  walletAddress: string,
  content: string,
  parentId?: string | null,
): Promise<FeaturedComment> {
  const data = (await commentWrite(
    `/markets/${encodeURIComponent(marketId)}/comments`,
    "POST",
    { walletAddress, content, parentId: parentId ?? undefined },
  )) as FeaturedCommentDTO;
  return mapComment(data);
}

export async function editComment(
  commentId: string,
  walletAddress: string,
  content: string,
): Promise<FeaturedComment> {
  const data = (await commentWrite(
    `/comments/${encodeURIComponent(commentId)}`,
    "PATCH",
    { walletAddress, content },
  )) as FeaturedCommentDTO;
  return mapComment(data);
}

export async function deleteComment(
  commentId: string,
  walletAddress: string,
): Promise<void> {
  await commentWrite(`/comments/${encodeURIComponent(commentId)}`, "DELETE", {
    walletAddress,
  });
}

export async function likeComment(
  commentId: string,
): Promise<FeaturedComment> {
  const data = (await commentWrite(
    `/comments/${encodeURIComponent(commentId)}/like`,
    "POST",
  )) as FeaturedCommentDTO;
  return mapComment(data);
}

export async function unlikeComment(
  commentId: string,
): Promise<FeaturedComment> {
  const data = (await commentWrite(
    `/comments/${encodeURIComponent(commentId)}/like`,
    "DELETE",
  )) as FeaturedCommentDTO;
  return mapComment(data);
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

export async function getMarketTrades(
  marketId: string,
  limit = 30,
  walletAddress?: string,
): Promise<MarketTrade[]> {
  try {
    let url = `${envPath}/trades?marketId=${encodeURIComponent(marketId)}&limit=${limit}`;
    if (walletAddress) {
      url += `&walletAddress=${encodeURIComponent(walletAddress)}`;
    }
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items ?? []) as MarketTrade[];
  } catch {
    return [];
  }
}

/**
 * Resolution status + outcome for a market. Degrades to null on any failure
 * so callers can render a loading/empty state instead of erroring.
 */
export async function getMarketResolution(
  marketId: string,
): Promise<MarketResolution | null> {
  try {
    const res = await fetch(
      `${envPath}/markets/${encodeURIComponent(marketId)}/resolution`,
    );
    if (!res.ok) return null;
    return (await res.json()) as MarketResolution;
  } catch {
    return null;
  }
}

export async function getTopHolders(
  marketId: string,
  page = 1,
  limit = 20,
): Promise<MarketHoldersResponse> {
  const empty: MarketHoldersResponse = { items: [], page, limit, total: 0, totalPages: 0 };
  try {
    const res = await fetch(
      `${envPath}/markets/${encodeURIComponent(marketId)}/top-holders?page=${page}&limit=${limit}`,
    );
    if (!res.ok) return empty;
    const data = await res.json();
    return {
      items: data.items ?? [],
      page: data.page ?? page,
      limit: data.limit ?? limit,
      total: data.total ?? 0,
      totalPages: data.totalPages ?? 0,
    };
  } catch {
    return empty;
  }
}
