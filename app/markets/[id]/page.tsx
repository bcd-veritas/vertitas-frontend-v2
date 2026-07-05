import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMarket, getMarkets, getOrderBook, getPriceHistory } from "@/lib/markets/data";
import { TerminalPage } from "@/components/terminal/TerminalPage";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const market = await getMarket(id);
  return { title: market ? `${market.title} — Veritas` : "Market — Veritas" };
}

export default async function MarketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const market = await getMarket(id);
  if (!market) notFound();

  const [all, books, series] = await Promise.all([
    getMarkets(),
    Promise.all(market.outcomes.map((o) => getOrderBook(o.tokenId))),
    Promise.all(market.outcomes.map((o) => getPriceHistory(o.tokenId))),
  ]);

  const related = all
    .filter((m) => m.id !== market.id && m.category === market.category && m.status === "ACTIVE")
    .slice(0, 3);

  return <TerminalPage market={market} related={related} books={books} series={series} />;
}
