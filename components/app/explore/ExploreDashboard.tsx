"use client";

import { useState } from "react";
import type { ApiMarket } from "@/lib/markets/types";
import { Topbar } from "../Topbar";
import { SystemFooter } from "../SystemFooter";
import { ExploreList } from "./ExploreList";

/** Owns the search term so it can drive the Topbar's existing input rather than
 *  /explore growing a second search box of its own. */
export function ExploreDashboard({ markets }: { markets: ApiMarket[] }) {
  const [search, setSearch] = useState("");

  return (
    <div className="dot-grid relative flex min-h-screen flex-col">
      <Topbar search={search} onSearch={setSearch} />
      <ExploreList
        markets={markets}
        search={search}
        onResetSearch={() => setSearch("")}
      />
      <SystemFooter markets={markets} />
    </div>
  );
}
