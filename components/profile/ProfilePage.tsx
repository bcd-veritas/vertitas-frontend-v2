"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useDisconnect } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import type { ApiMarket } from "@/lib/markets/types";
import { Topbar } from "../app/Topbar";
import { SystemFooter } from "../app/SystemFooter";
import { mockProfile } from "@/lib/profile/mock";
import { GradientAvatar } from "./GradientAvatar";
import { HeroValue } from "./HeroValue";
import { PnlChart } from "../charts/PnlChart";
import { MetricBlocks } from "./MetricBlocks";
import { ActivityTable } from "./ActivityTable";
import { RollingNumber } from "./RollingNumber";

export function ProfilePage({ markets }: { markets: ApiMarket[] }) {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [hoverUsd, setHoverUsd] = useState<number | null>(null);

  const profile = useMemo(() => (address ? mockProfile(address) : null), [address]);

  if (!isConnected || !address || !profile) {
    return (
      <div className="dot-grid min-h-screen flex flex-col">
        <Topbar />
        <main className="flex-1 flex flex-col items-center justify-center gap-4 px-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted">
            connect wallet to view profile
          </p>
          <button
            type="button"
            onClick={openConnectModal}
            className="pill pill-solid !py-2 !px-6 text-xs font-mono uppercase tracking-wider"
          >
            Connect
          </button>
        </main>
        <SystemFooter markets={markets} />
      </div>
    );
  }

  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
  const copyAddress = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const latestUsd = profile.pnlSeries[profile.pnlSeries.length - 1]?.usd ?? 0;
  const readoutUsd = hoverUsd ?? latestUsd;
  const readoutUp = readoutUsd >= 0;

  return (
    <div className="min-h-screen flex flex-col">
      <Topbar />
      <main className="mx-auto max-w-7xl w-full flex-1 flex flex-col">
        {/* Header row — reference's brand row: avatar + name | eyebrow. */}
        <div className="flex items-center justify-between gap-4 px-3 sm:px-4 py-4 border-b border-line">
          <span className="flex items-center gap-3 min-w-0">
            <GradientAvatar seed={address} size={40} />
            <span className="font-semibold text-fg truncate">{profile.username ?? short}</span>
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted shrink-0">
            sim.data // 2026
          </span>
        </div>

        {/* Sub-row — reference's nav row: wallet address | disconnect. */}
        <div className="flex items-center justify-between gap-4 px-3 sm:px-4 py-2.5 border-b border-line">
          <button
            type="button"
            onClick={copyAddress}
            title="Copy address"
            className="font-mono text-[11px] tracking-[0.08em] text-muted hover:text-fg/80 transition-colors truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded"
          >
            {copied ? "COPIED" : address}
          </button>
          <button
            type="button"
            onClick={() => {
              disconnect();
              router.push("/home");
            }}
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-no transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded"
          >
            Disconnect ↗
          </button>
        </div>

        {/* Hero band: headline + outline number over the instance cloud. */}
        <HeroValue
          title={profile.username ?? short}
          valueCents={profile.portfolioValueCents}
          pnlCents={profile.pnlAllTimeCents}
          winRatePct={profile.winRatePct}
        />

        <MetricBlocks
          volumeTradedCents={profile.volumeTradedCents}
          marketsTraded={profile.marketsTraded}
          winRatePct={profile.winRatePct}
        />

        {/* PNL — editorial section like the reference's content bands. */}
        <section className="border-b border-line" aria-label="PNL chart">
          <div className="flex flex-wrap items-end justify-between gap-2 px-3 sm:px-4 pt-10 pb-4">
            <div>
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-fg uppercase">
                PNL
              </h2>
              {/* Scrub readout: hovered value, else the latest print. */}
              <RollingNumber
                value={readoutUsd}
                signed
                currency
                decimals={2}
                className={`mt-3 font-mono text-3xl sm:text-4xl font-semibold ${readoutUp ? "text-yes" : "text-no"
                  }`}
              />
            </div>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
              90d // sim.data
            </span>
          </div>
          <div className="px-2 sm:px-5 pb-6">
            <PnlChart points={profile.pnlSeries} height={260} onHoverValue={setHoverUsd} />
          </div>
        </section>

        <ActivityTable rows={profile.activity} />
      </main>
      <SystemFooter markets={markets} />
    </div>
  );
}
