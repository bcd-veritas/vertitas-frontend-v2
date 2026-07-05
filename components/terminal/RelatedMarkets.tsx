import type { ApiMarket } from "@/lib/markets/types";
import { MarketCard } from "../app/MarketCard";
import { MonoLabel } from "../landing/ui/MonoLabel";

export function RelatedMarkets({ markets }: { markets: ApiMarket[] }) {
  if (markets.length === 0) return null;
  return (
    <section aria-label="Related markets">
      <MonoLabel className="block mb-3">related // same category</MonoLabel>
      <div className="flex flex-col gap-4">
        {markets.map((m) => (
          <MarketCard key={m.id} market={m} />
        ))}
      </div>
    </section>
  );
}
