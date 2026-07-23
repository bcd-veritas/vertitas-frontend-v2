"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useDisconnect } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import type { ApiMarket } from "@/lib/markets/types";
import { Topbar } from "../app/Topbar";
import { SystemFooter } from "../app/SystemFooter";
import { mockProfile } from "@/lib/profile/mock";
import type { ActivityRow, OpenOrderRow } from "@/lib/profile/mock";
import {
  getUserIdentity,
  getPortfolioValue,
  getCollateralDollars,
  getMarketsTraded,
  getVolumeTraded,
  getWinRate,
  getOpenOrders,
  getTradeHistory,
  type UserIdentity,
  type PortfolioValue,
} from "@/lib/profile/data";
import { EditProfileDrawer } from "./EditProfileDrawer";
import { GradientAvatar } from "./GradientAvatar";
import { HeroValue } from "./HeroValue";
import { PnlChart } from "../charts/PnlChart";
import { MetricBlocks } from "./MetricBlocks";
import { PortfolioTable } from "./PortfolioTable";
import { RollingNumber } from "./RollingNumber";

export function ProfilePage({ markets }: { markets: ApiMarket[] }) {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [hoverUsd, setHoverUsd] = useState<number | null>(null);
  const [identity, setIdentity] = useState<UserIdentity | null>(null);
  const [editing, setEditing] = useState(false);

  // Live wallet data (real API). Only the PnL time-series still has no
  // endpoint, so that alone comes from mockProfile below.
  const [portfolio, setPortfolio] = useState<PortfolioValue | null>(null);
  const [cashDollars, setCashDollars] = useState<number>(0);
  const [marketsTraded, setMarketsTraded] = useState<number | null>(null);
  const [volumeTradedCents, setVolumeTradedCents] = useState<number | null>(null);
  const [winRatePct, setWinRatePct] = useState<number | null>(null);
  const [openOrders, setOpenOrders] = useState<OpenOrderRow[]>([]);
  const [history, setHistory] = useState<ActivityRow[]>([]);

  const profile = useMemo(() => (address ? mockProfile(address) : null), [address]);

  // Saved trading identity (username/email) from the middleware; null until
  // the user first saves — the UI falls back to the short address.
  useEffect(() => {
    if (!address) return;
    let alive = true;
    getUserIdentity(address).then((u) => {
      if (alive) setIdentity(u);
    });
    return () => {
      alive = false;
    };
  }, [address]);

  // Portfolio value, positions, collateral, markets traded, open orders and
  // trade history — fetched together and mapped into the presentational shapes.
  useEffect(() => {
    if (!address) return;
    let alive = true;
    Promise.all([
      getPortfolioValue(address),
      getCollateralDollars(address),
      getMarketsTraded(address),
      getVolumeTraded(address),
      getWinRate(address),
      getOpenOrders(address),
      getTradeHistory(address),
    ]).then(([pv, cash, markets, volume, winRate, orders, trades]) => {
      if (!alive) return;
      setPortfolio(pv);
      setCashDollars(cash ? cash.available + cash.locked : 0);
      setMarketsTraded(markets);
      setVolumeTradedCents(volume);
      setWinRatePct(winRate);
      setOpenOrders(orders);
      setHistory(trades);
    });
    return () => {
      alive = false;
    };
  }, [address]);

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
            className="pill pill-solid py-2! px-6! text-xs font-mono uppercase tracking-wider"
          >
            Connect
          </button>
        </main>
        <SystemFooter markets={markets} />
      </div>
    );
  }

  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
  const displayName = identity?.username ?? profile.username ?? short;
  const copyAddress = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Hero value = mark value of open positions + collateral on hand. 
  // PnL is the unrealized figure across open positions (all-time realized PnL has no
  // endpoint yet). Both default to 0 until the fetch resolves.
  const portfolioValueCents =
    (portfolio?.valueCents ?? 0) + Math.round(cashDollars * 100);
  const pnlCents = portfolio?.pnlCents ?? 0;

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
            <span className="font-semibold text-fg truncate">{displayName}</span>
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
          <span className="flex items-center gap-5 shrink-0">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="font-mono text-[11px] uppercase tracking-[0.14em] text-amber-100 hover:text-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded cursor-pointer"
            >
              Edit profile
            </button>
            <button
              type="button"
              onClick={() => {
                disconnect();
                router.push("/home");
              }}
              className="font-mono text-[11px] uppercase tracking-[0.14em] text-no transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded cursor-pointer"
            >
              Disconnect ↗
            </button>
          </span>
        </div>

        {/* Hero band: headline + outline number over the instance cloud.
            value, pnl and winRate are all live. */}
        <HeroValue
          title={displayName}
          valueCents={portfolioValueCents}
          pnlCents={pnlCents}
          winRatePct={winRatePct ?? 0}
        />

        {/* All three blocks are live now. */}
        <MetricBlocks
          volumeTradedCents={volumeTradedCents ?? 0}
          marketsTraded={marketsTraded ?? 0}
          winRatePct={winRatePct ?? 0}
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

        {/* Live positions, resting orders and completed-trade history; each
            table renders its own empty state until the fetch resolves. */}
        <PortfolioTable
          positions={portfolio?.positions ?? []}
          openOrders={openOrders}
          history={history}
        />
      </main>
      <SystemFooter markets={markets} />

      <EditProfileDrawer
        open={editing}
        onClose={() => setEditing(false)}
        address={address}
        identity={identity}
        onSaved={setIdentity}
      />
    </div>
  );
}
