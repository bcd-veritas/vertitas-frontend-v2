import type { Metadata } from "next";
import { getMarkets } from "@/lib/markets/data";
import { ProfilePage } from "@/components/profile/ProfilePage";

export const metadata: Metadata = {
  title: "Profile — Veritas",
  description: "Your Veritas trading profile.",
};

// Live market data feeds the footer telemetry: render per request.
export const dynamic = "force-dynamic";

export default async function Page() {
  const markets = await getMarkets();
  return <ProfilePage markets={markets} />;
}
