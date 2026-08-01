"use client";

import { Zap } from "lucide-react";
import { useAccount } from "wagmi";

import { useOnboarding } from "../onboarding/OnboardingProvider";

/**
 * Topbar shortcut into the onboarding wizard. The wizard picks the landing
 * step itself — the profile step when the wallet has no email on file, the
 * enable-trading step when it does — so this button never has to know.
 *
 * Hidden until the on-chain reads land, and once trading is enabled.
 */
export function EnableTradingButton() {
  const { address } = useAccount();
  const { open, tradingEnabled } = useOnboarding();

  // `null` = allowances still loading; only `false` means there's work to do.
  if (!address || tradingEnabled !== false) return null;

  return (
    <button
      type="button"
      onClick={open}
      aria-label="Enable trading"
      className="enable-trading-pulse inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-accent/35 bg-accent/8 px-2 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-accent transition-colors hover:border-accent/60 hover:bg-accent/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg sm:px-3.5"
    >
      <Zap size={12} strokeWidth={2.5} aria-hidden="true" className="enable-trading-spark" />
      <span className="hidden sm:inline">Enable trading</span>
    </button>
  );
}
