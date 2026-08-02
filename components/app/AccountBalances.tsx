"use client";

import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useAccount } from "wagmi";

import { collateralQueryKey, getCollateralDollars, syncUserBalances } from "@/lib/profile/data";
import { useUserRoom } from "@/lib/realtime/hooks";
import { MonoLabel } from "../landing/ui/MonoLabel";
import { RollingNumber } from "../profile/RollingNumber";

/**
 * The connected wallet's off-chain ledger balances — available (spendable)
 * and locked (held by resting orders) — plus a manual on-chain sync. These
 * are the DB collateral columns, NOT on-chain VTK; MetaMask does not reflect
 * them. Renders nothing until a balance has loaded; desktop-only otherwise
 * (hidden below `sm`, where topbar space goes to actions instead).
 *
 * Two refresh paths, deliberately kept apart:
 *  - passive (mount, realtime socket events) reads the DB via
 *    `getCollateralDollars` — cheap, and fires often.
 *  - the sync button calls `syncUserBalances`, which triggers an actual
 *    on-chain read server-side — expensive, so it only ever runs on click,
 *    never wired to the socket. A fill anywhere in the market broadcasts to
 *    this wallet's room, and routing that through an RPC call would multiply
 *    chain reads with market activity that has nothing to do with this user
 *    opening the app.
 *
 * A deposit/withdrawal doesn't raise a realtime event (the backend doesn't
 * broadcast on those), so `DepositButton` invalidates `collateralQueryKey`
 * itself after one completes — see its `onChanged` wiring in `Topbar.tsx`.
 */
export function AccountBalances() {
  const { address, isConnected } = useAccount();
  const queryClient = useQueryClient();

  const { data: collateral, isFetching } = useQuery({
    queryKey: collateralQueryKey(address),
    queryFn: () => getCollateralDollars(address as string),
    enabled: isConnected && !!address,
  });

  const cheapRefresh = useCallback(() => {
    if (!isConnected || !address) return;
    void queryClient.invalidateQueries({ queryKey: collateralQueryKey(address) });
  }, [isConnected, address, queryClient]);

  useUserRoom(isConnected ? address : null, cheapRefresh);

  // The fetch usually resolves in a few ms — far less than one 1s spin cycle —
  // so the spin is held open by a parallel timer rather than by the fetch
  // alone, so a fast response still reads as "did something."
  const [syncing, setSyncing] = useState(false);
  const syncOnChain = useCallback(() => {
    if (!isConnected || !address) return;
    setSyncing(true);
    const synced = syncUserBalances(address).then((fresh) =>
      queryClient.setQueryData(collateralQueryKey(address), fresh),
    );
    const minSpin = new Promise((resolve) => setTimeout(resolve, 1000));
    void Promise.allSettled([synced, minSpin]).then(() => setSyncing(false));
  }, [isConnected, address, queryClient]);

  if (!collateral) return null;

  return (
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
        {/* On-chain sync, not a cheap refetch — see syncOnChain above. */}
        <button
          type="button"
          onClick={syncOnChain}
          disabled={syncing || isFetching}
          aria-label="Sync balances on-chain"
          title="Sync balances on-chain"
          className="-m-1 cursor-pointer rounded p-1 text-muted transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-default disabled:text-accent"
        >
          <RefreshCw
            size={12}
            strokeWidth={2.5}
            aria-hidden="true"
            className={
              syncing || isFetching
                ? "animate-spin motion-reduce:animate-none"
                : undefined
            }
          />
        </button>
      </div>
      {/* Separates what the account *is* from what you can *do* with it. */}
      <span aria-hidden="true" className="hidden h-5 w-px bg-line sm:block" />
    </>
  );
}
