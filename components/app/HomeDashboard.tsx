"use client";

import { useState } from "react";
import type { ApiMarket, FeaturedMarket } from "@/lib/markets/types";
import { Topbar } from "./Topbar";
import { Ticker } from "./Ticker";
import { FeaturedPlate } from "./FeaturedPlate";
import { MarketBoard } from "./MarketBoard";
import { SystemFooter } from "./SystemFooter";

export function HomeDashboard({
  markets,
  categories,
  featured,
}: {
  markets: ApiMarket[];
  categories: string[];
  featured: FeaturedMarket[];
}) {
  const [search, setSearch] = useState<string>("");

  return (
    <div className="dot-grid min-h-screen flex flex-col">
      <Topbar search={search} onSearch={setSearch} />
      <Ticker />
      <FeaturedPlate markets={featured} />
      <MarketBoard categories={categories} markets={markets} search={search} onResetSearch={() => setSearch("")} />
      <SystemFooter markets={markets} />
    </div>
  );
}
