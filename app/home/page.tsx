import type { Metadata } from "next";
import { getFeaturedMarkets, getMarketCategories, getMarkets } from "@/lib/markets/data";
import { HomeDashboard } from "@/components/app/HomeDashboard";

export const metadata: Metadata = {
  title: "Markets — Veritas",
  description: "Live prediction markets. Prices are probabilities.",
};

export default async function HomePage() {
  const [markets, categories, featured] = await Promise.all([
    getMarkets(),
    getMarketCategories(),
    getFeaturedMarkets(),
  ]);
  return <HomeDashboard categories={categories} markets={markets} featured={featured} />;
}
