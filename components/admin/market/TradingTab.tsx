'use client';

import { useQuery } from '@tanstack/react-query';

import { Frame } from '@/components/terminal/Frame';
import { Ladder } from '@/components/terminal/Ladder';
import { PriceChart } from '@/components/terminal/PriceChart';
import { colorMap, rankRows } from '@/components/terminal/rank';
import { TradeTape } from '@/components/admin/market/TradeTape';
import {
  getMarket,
  getMarketTrades,
  getOrderBook,
  getPriceHistory,
} from '@/lib/markets/data';
import { binaryYesOutcome } from '@/lib/markets/format';

export function TradingTab({ marketId }: { marketId: string }) {
  // Mirror TerminalPage's assembly: fetch the public market (ApiOutcome[] with ids),
  // then each outcome's book + price history.
  const { data: trading, isLoading } = useQuery({
    queryKey: ['admin-trading', marketId],
    queryFn: async () => {
      const market = await getMarket(marketId);
      if (!market) return null;
      const [books, series] = await Promise.all([
        Promise.all(market.outcomes.map((o) => getOrderBook(o.tokenId))),
        Promise.all(market.outcomes.map((o) => getPriceHistory(o.tokenId))),
      ]);
      return { market, books, series };
    },
    refetchInterval: 30_000,
  });

  const { data: trades } = useQuery({
    queryKey: ['admin-trades', marketId],
    queryFn: () => getMarketTrades(marketId, 30),
    refetchInterval: 30_000,
  });

  if (isLoading || !trading) {
    return (
      <p className="font-mono text-xs text-muted">Loading trading data…</p>
    );
  }

  const { market, books, series } = trading;
  const rows = rankRows(market.outcomes, books, series);
  const colors = colorMap(rows);

  // Single market book: the YES/canonical book (NO has no independent book).
  const yes = binaryYesOutcome(market.outcomes) ?? market.outcomes[0];
  const yesIndex = market.outcomes.findIndex((o) => o.id === yes?.id);
  const yesBook = yesIndex >= 0 ? books[yesIndex] : { bids: [], asks: [] };

  const outcomeLabels: Record<number, string> = Object.fromEntries(
    market.outcomes.map((o) => [o.index, o.label]),
  );

  return (
    <div className="flex flex-col gap-5">
      <PriceChart outcomes={market.outcomes} series={series} colors={colors} />

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <Frame label="Order book" className="flex h-115 flex-col p-4">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <Ladder book={yesBook} />
          </div>
        </Frame>

        <Frame label="Recent trades" className="flex h-115 flex-col p-4">
          <div
            className="min-h-0 flex-1 overflow-y-auto pr-3 
              [&::-webkit-scrollbar]:w-1.5 
              [&::-webkit-scrollbar-track]:bg-transparent 
              [&::-webkit-scrollbar-thumb]:bg-line/60 
              [&::-webkit-scrollbar-thumb]:rounded-full 
              hover:[&::-webkit-scrollbar-thumb]:bg-fg/30"
          >
            <TradeTape trades={trades ?? []} outcomeLabels={outcomeLabels} />
          </div>
        </Frame>
      </div>
    </div>
  );
}
