"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";

import { getUserIdentity, isVoterRole } from "@/lib/profile/data";
import { DepositModal } from "./DepositModal";

/**
 * The single deposit entry point for every wallet. One button — the modal's
 * behaviour branches on role: voters/oracle participants receive VTK in their
 * wallet, everyone else has their off-chain balance credited. Renders nothing
 * until a wallet is connected.
 */
export function DepositButton({
  className,
  children,
  onDeposited,
}: {
  className?: string;
  children?: React.ReactNode;
  /** Called after a deposit is confirmed + synced — refresh balances here. */
  onDeposited?: () => void;
}) {
  const { address, isConnected } = useAccount();
  const [open, setOpen] = useState(false);

  // Role decides the flow; GET /users/:wallet already returns it. Falls back to
  // the standard (ledger-credit) flow if identity can't be read.
  const { data: identity } = useQuery({
    queryKey: ["identity", address],
    queryFn: () => getUserIdentity(address as string),
    enabled: isConnected && !!address,
  });

  if (!isConnected || !address) return null;

  const isVoter = isVoterRole(identity?.role);

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
        {children ?? (isVoter ? "Add VTK" : "Deposit")}
      </button>

      <DepositModal
        open={open}
        onClose={() => setOpen(false)}
        isVoter={isVoter}
        onDeposited={() => onDeposited?.()}
      />
    </>
  );
}
