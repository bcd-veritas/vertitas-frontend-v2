"use client";

import { useState } from "react";
import { ArrowDownToLine } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";

import { getUserIdentity, isVoterRole } from "@/lib/profile/data";
import { useOnboarding } from "../onboarding/OnboardingProvider";
import { WalletModal } from "./WalletModal";

/**
 * Topbar funds entry point — opens the combined Deposit / Withdraw modal. Named
 * for the action people come here to do, not the surface it opens: adding funds
 * is the reason this button gets pressed. Renders nothing until a wallet is
 * connected.
 *
 * Mutually exclusive with EnableTradingButton, and reads the same
 * `tradingEnabled` signal to arbitrate: while trading isn't enabled yet, that
 * setup task takes the topbar slot instead of this one — depositing is
 * already covered inside that flow's own deposit step, so showing both here
 * is redundant. Once trading is enabled, EnableTradingButton self-hides and
 * this one takes over.
 */
export function DepositButton({
  onChanged,
}: {
  /** Called after a deposit or withdrawal is confirmed + synced. */
  onChanged?: () => void;
}) {
  const { address, isConnected } = useAccount();
  const { tradingEnabled } = useOnboarding();
  const [open, setOpen] = useState(false);

  const { data: identity } = useQuery({
    queryKey: ["identity", address],
    queryFn: () => getUserIdentity(address as string),
    enabled: isConnected && !!address,
  });

  // Mirrors EnableTradingButton's own guard: `null` = allowances still
  // loading (this button stays up through that window, same as before this
  // split existed), only an explicit `false` hands the slot over to it.
  if (!isConnected || !address || tradingEnabled === false) return null;

  return (
    <>
      {/* Icon-only until there's room for the label — the topbar is tight on
          phones, where this shares a row with the brand and the address pill. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Deposit"
        className="inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-accent px-2 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-bg transition-[filter,transform] hover:brightness-105 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg motion-reduce:transition-none motion-reduce:active:scale-100 sm:px-3.5"
      >
        <ArrowDownToLine size={12} strokeWidth={2.5} aria-hidden="true" />
        <span className="hidden sm:inline">Deposit</span>
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
