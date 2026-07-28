"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";

import { getUserIdentity, isVoterRole } from "@/lib/profile/data";
import { WalletModal } from "./WalletModal";

/**
 * Topbar funds entry point — one "Wallet" button opening the combined
 * Deposit / Withdraw modal. The deposit copy still branches on role (voters
 * deposit for wallet VTK to post bonds); withdraw is role-agnostic. Renders
 * nothing until a wallet is connected.
 */
export function WalletButton({
  className,
  onChanged,
}: {
  className?: string;
  /** Called after a deposit or withdrawal is confirmed + synced. */
  onChanged?: () => void;
}) {
  const { address, isConnected } = useAccount();
  const [open, setOpen] = useState(false);

  const { data: identity } = useQuery({
    queryKey: ["identity", address],
    queryFn: () => getUserIdentity(address as string),
    enabled: isConnected && !!address,
  });

  if (!isConnected || !address) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "pill pill-solid py-1.5! px-4! text-xs font-mono uppercase tracking-wider shrink-0 cursor-pointer"
        }
      >
        Wallet
      </button>

      <WalletModal
        open={open}
        onClose={() => setOpen(false)}
        isVoter={isVoterRole(identity?.role)}
        onChanged={() => onChanged?.()}
      />
    </>
  );
}
