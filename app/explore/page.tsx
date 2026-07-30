import type { Metadata } from "next";
import { getMarkets } from "@/lib/markets/data";
import { ExploreDashboard } from "@/components/app/explore/ExploreDashboard";

export const metadata: Metadata = {
  title: "Explore — Veritas",
  description: "Every market on one page. Odds you can read by shape.",
};

// Prices and countdowns move; never freeze this page at build time.
export const dynamic = "force-dynamic";

export default async function ExplorePage() {
  const markets = await getMarkets();
  return <ExploreDashboard markets={markets} />;
}
