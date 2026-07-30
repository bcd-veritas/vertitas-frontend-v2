"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { MonoLabel } from "../landing/ui/MonoLabel";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { GradientAvatar } from "../profile/GradientAvatar";
import { getCollateralDollars } from "@/lib/profile/data";
import { useUserRoom } from "@/lib/realtime/hooks";
import { WalletButton } from "../deposit/WalletButton";
import { EnableTradingButton } from "../deposit/EnableTradingButton";
import { RollingNumber } from "../profile/RollingNumber";

/** Off-chain ledger balances beside the profile pill — available (spendable)
 *  and locked (held by resting orders). These are the DB collateral columns,
 *  NOT on-chain VTK; MetaMask does not reflect them. Rendered as a borderless
 *  stat readout rather than a pill. */
function CollateralReadout() {
  const { address, isConnected } = useAccount();
  const [collateral, setCollateral] = useState<{
    available: number;
    locked: number;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    if (!isConnected || !address) {
      Promise.resolve().then(() => alive && setCollateral(null));
    } else {
      getCollateralDollars(address).then((c) => alive && setCollateral(c));
    }
    return () => {
      alive = false;
    };
  }, [address, isConnected]);

  const refresh = useCallback(() => {
    if (!isConnected || !address) return;
    getCollateralDollars(address).then((c) => setCollateral(c));
  }, [address, isConnected]);

  useUserRoom(isConnected ? address : null, refresh);

  if (!isConnected || !address || !collateral) return null;

  return (
    <div className="hidden sm:flex items-center gap-3 shrink-0">
      <span className="flex flex-col items-end gap-0.5 leading-none">
        <MonoLabel className="text-[9px]! tracking-[0.16em]">Available</MonoLabel>
        {/* RollingNumber animates the digits when a placed order (or any
            balance change) shifts the ledger — the "money moved" cue. */}
        <RollingNumber
          value={collateral.available}
          currency
          decimals={2}
          className="font-mono text-xs text-accent"
        />
      </span>
      <span className="flex flex-col items-end gap-0.5 leading-none">
        <MonoLabel className="text-[9px]! tracking-[0.16em]">Locked</MonoLabel>
        <RollingNumber
          value={collateral.locked}
          currency
          decimals={2}
          className="font-mono text-xs text-fg/60"
        />
      </span>
      {/* One-time VTK→Exchange approval; self-hides once granted. */}
      <EnableTradingButton />
      {/* Reuses the same refresh the realtime socket drives, so the readout
          above updates the moment a deposit or withdrawal settles. */}
      <WalletButton
        onChanged={refresh}
        className="pill pill-solid py-1.5! px-3! text-[11px] font-mono uppercase tracking-wider shrink-0 cursor-pointer"
      />
    </div>
  );
}

function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();

  if (!isConnected || !address) {
    return (
      <button
        type="button"
        onClick={openConnectModal}
        className="pill pill-ghost py-1.5! px-4! text-xs font-mono uppercase tracking-wider shrink-0"
      >
        Connect
      </button>
    );
  }

  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;

  return (
    <Link
      href="/profile"
      aria-label="Open profile"
      className="pill pill-ghost py-1.5! px-4! text-xs font-mono uppercase tracking-wider inline-flex items-center gap-2 shrink-0"
    >
      <GradientAvatar seed={address} size={18} />
      {short}
    </Link>
  );
}

export function Topbar({
  search,
  onSearch,
}: {
  search?: string;
  onSearch?: (v: string) => void;
}) {
  return (
    <header className="sticky top-0 z-40 grid grid-cols-[1fr_auto] sm:grid-cols-[auto_1fr_auto] items-center gap-x-4 sm:gap-x-6 px-3 sm:px-4 min-h-14 py-2 sm:py-0 border-b border-line bg-bg/70 backdrop-blur-sm">
      <Link
        href="/"
        className="justify-self-start font-pixel text-xl tracking-widest text-fg shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded"
      >
        VERITAS
      </Link>

      {/* Center column — search sits dead-center of the bar */}
      {onSearch ? (
        <div className="order-last col-span-2 sm:order-0 sm:col-span-1 mt-2 sm:mt-0 flex items-center gap-2 w-full sm:max-w-[28rem] sm:mx-auto border border-line rounded-lg px-3 py-1.5 focus-within:border-accent/40 transition-colors">
          <Search size={13} className="text-muted shrink-0" aria-hidden="true" />
          <input
            value={search ?? ""}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="SEARCH.MARKETS //"
            aria-label="Search markets"
            className="w-full bg-transparent font-mono text-xs uppercase tracking-wider text-fg placeholder:text-muted/60 focus:outline-none"
          />
        </div>
      ) : (
        <div aria-hidden="true" className="hidden sm:block" />
      )}

      <div className="justify-self-end flex items-center gap-3 sm:gap-4 shrink-0">
        {/* <span className="hidden md:flex items-center gap-2 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" aria-hidden="true" />
          <MonoLabel>markets.online</MonoLabel>
        </span> */}
        <CollateralReadout />
        <ConnectButton />
      </div>
    </header>
  );
}
