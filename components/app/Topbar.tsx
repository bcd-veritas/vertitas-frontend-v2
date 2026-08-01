"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Search } from "lucide-react";
import { MonoLabel } from "../landing/ui/MonoLabel";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { GradientAvatar } from "../profile/GradientAvatar";
import { getCollateralDollars } from "@/lib/profile/data";
import { useUserRoom } from "@/lib/realtime/hooks";
import { WalletButton } from "../deposit/WalletButton";
import { EnableTradingButton } from "../deposit/EnableTradingButton";
import { RollingNumber } from "../profile/RollingNumber";

/**
 * The connected wallet's cluster: off-chain ledger balances — available
 * (spendable) and locked (held by resting orders) — then a hairline, then the
 * actions. These balances are the DB collateral columns, NOT on-chain VTK;
 * MetaMask does not reflect them.
 *
 * The buttons sit outside the balance block on purpose. That block is
 * desktop-only and waits on a fetch; the actions must not.
 */
function AccountCluster() {
  const { address, isConnected } = useAccount();

  // A query (rather than a bare fetch-in-effect) so other flows — e.g. the
  // onboarding wizard's deposit step — can invalidate ["collateral"] and this
  // readout refetches without any prop plumbing back to the topbar.
  const {
    data: collateral,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["collateral", address],
    queryFn: () => getCollateralDollars(address as string),
    enabled: isConnected && !!address,
  });

  // The fetch usually resolves in a few ms — far less than one 1s spin cycle —
  // so tie the icon to a state that outlives it: spin for at least one full
  // rotation, longer only if the request is genuinely still in flight.
  const [spinning, setSpinning] = useState(false);
  const refresh = useCallback(() => {
    setSpinning(true);
    void Promise.allSettled([
      refetch(),
      new Promise((r) => setTimeout(r, 1000)),
    ]).then(() => setSpinning(false));
  }, [refetch]);

  useUserRoom(isConnected ? address : null, refresh);

  if (!isConnected || !address) return null;

  return (
    <div className="flex shrink-0 items-center gap-3 sm:gap-3.5">
      {collateral && (
        <>
          <div className="hidden items-center gap-3 sm:flex">
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
            {/* Spins during ANY refetch (manual or socket-driven), so it doubles
                as the ambient "balances syncing" indicator. */}
            <button
              type="button"
              onClick={refresh}
              disabled={spinning || isFetching}
              aria-label="Sync balances"
              title="Sync balances"
              className="-m-1 cursor-pointer rounded p-1 text-muted transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-default disabled:text-accent"
            >
              <RefreshCw
                size={12}
                strokeWidth={2.5}
                aria-hidden="true"
                className={
                  spinning || isFetching
                    ? "animate-spin motion-reduce:animate-none"
                    : undefined
                }
              />
            </button>
          </div>
          {/* Separates what the account *is* from what you can *do* with it. */}
          <span aria-hidden="true" className="hidden h-5 w-px bg-line sm:block" />
        </>
      )}

      {/* Setup task — self-hides once trading is enabled. */}
      <EnableTradingButton />
      {/* Reuses the same refresh the realtime socket drives, so the balances
          update the moment a deposit or withdrawal settles. */}
      <WalletButton onChanged={refresh} />
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
        // `text-xs!` is deliberate: `.pill` sets its own font-size and, being
        // defined after Tailwind's utilities, wins any un-flagged size class.
        className="pill pill-ghost h-7 shrink-0 px-4! font-mono text-xs! uppercase tracking-wider"
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
      className="pill pill-ghost inline-flex h-7 shrink-0 items-center gap-2 px-3.5! font-mono text-xs! uppercase tracking-wider"
    >
      <GradientAvatar seed={address} size={16} />
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
        <AccountCluster />
        <ConnectButton />
      </div>
    </header>
  );
}
