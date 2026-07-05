"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { MonoLabel } from "../landing/ui/MonoLabel";
import { useAccount, useBalance } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { GradientAvatar } from "../profile/GradientAvatar";

function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({ address });
  const { openConnectModal } = useConnectModal();

  if (!isConnected || !address) {
    return (
      <button
        type="button"
        onClick={openConnectModal}
        className="pill pill-ghost !py-1.5 !px-4 text-xs font-mono uppercase tracking-wider shrink-0"
      >
        Connect
      </button>
    );
  }

  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
  const bal = balance
    ? `${Number(balance.formatted).toLocaleString(undefined, { maximumFractionDigits: 3 })} ${balance.symbol}`
    : null;

  return (
    <Link
      href="/profile"
      aria-label="Open profile"
      className="pill pill-ghost !py-1.5 !px-4 text-xs font-mono uppercase tracking-wider inline-flex items-center gap-2 shrink-0"
    >
      <GradientAvatar seed={address} size={18} />
      {bal && <span className="text-accent tabular-nums normal-case">{bal}</span>}
      {bal && <span aria-hidden="true" className="text-line">|</span>}
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
    <header className="sticky top-0 z-40 grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_minmax(0,28rem)_1fr] items-center gap-x-4 sm:gap-x-6 px-3 sm:px-4 min-h-14 py-2 sm:py-0 border-b border-line bg-bg/70 backdrop-blur-sm">
      <Link
        href="/"
        className="justify-self-start font-pixel text-xl tracking-widest text-fg shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded"
      >
        VERITAS
      </Link>

      {/* Center column — search sits dead-center of the bar */}
      {onSearch ? (
        <div className="order-last col-span-2 sm:order-none sm:col-span-1 mt-2 sm:mt-0 flex items-center gap-2 w-full border border-line rounded-lg px-3 py-1.5 focus-within:border-accent/40 transition-colors">
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

      <div className="justify-self-end flex items-center gap-4 sm:gap-6">
        <span className="hidden md:flex items-center gap-2 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" aria-hidden="true" />
          <MonoLabel>markets.online</MonoLabel>
        </span>
        <ConnectButton />
      </div>
    </header>
  );
}
