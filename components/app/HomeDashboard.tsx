"use client";

import { useState } from "react";
import type { ApiMarket, FeaturedMarket } from "@/lib/markets/types";
import { Topbar } from "./Topbar";
import { DotScan } from "./DotScan";
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
    <div className="dot-grid min-h-screen relative flex flex-col">
      <DotScan />
      <div className="relative z-10 flex flex-col flex-1 min-h-0">
        <Topbar search={search} onSearch={setSearch} />
        <Ticker />
        <FeaturedPlate markets={featured} />
        <MarketBoard categories={categories} markets={markets} search={search} onResetSearch={() => setSearch("")} />
        <SystemFooter markets={markets} />
      </div>
    </div>
  );
}
