"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";

import { getUserIdentity } from "@/lib/profile/data";
import { useDepositState } from "@/lib/deposit/useDepositState";
import { hasSeenAutoPrompt, markAutoPromptSeen } from "@/lib/onboarding/local-flags";
import { OnboardingFlow } from "./OnboardingFlow";

type OnboardingApi = {
  /** Open the wizard at the first step this wallet hasn't finished. */
  open: () => void;
  /** Both approvals granted. `null` while the on-chain reads are in flight. */
  tradingEnabled: boolean | null;
};

const OnboardingContext = createContext<OnboardingApi>({
  open: () => {},
  tradingEnabled: null,
});

/** Lets anything in the tree (e.g. the topbar) open the onboarding wizard. */
export const useOnboarding = () => useContext(OnboardingContext);

/**
 * Owns the one onboarding wizard for the app. It opens on request — `open()`,
 * wired to the topbar's "enable trading" button — and, separately, auto-opens
 * once per wallet on a genuine first connect. The auto-open is tracked in
 * localStorage independent of completion, so it never nags: it fires exactly
 * once regardless of what the user does with it (dismiss, skip, finish), and
 * the topbar button remains the way back in after that.
 */
export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { address, isConnected } = useAccount();
  const queryClient = useQueryClient();
  const deposit = useDepositState();

  const [active, setActive] = useState(false);

  const { data: identity } = useQuery({
    queryKey: ["identity", address],
    queryFn: () => getUserIdentity(address as string),
    enabled: isConnected && !!address,
  });

  // Trading needs both approvals, so both reads must land before we can answer.
  const tradingEnabled =
    deposit.allowance == null || deposit.vtkAllowanceToExchange == null
      ? null
      : deposit.allowance > 0n && deposit.vtkAllowanceToExchange > 0n;

  // Adjusted during render rather than in an effect (the codebase's
  // `prevOpen`/`prevIdentity` idiom) — this only needs to react to `address`
  // itself changing, not to subscribe/clean up anything, so there's nothing
  // an effect would add. `markAutoPromptSeen` is an idempotent localStorage
  // write, safe under StrictMode's double-render.
  const [prevAddress, setPrevAddress] = useState(address);
  if (isConnected && address !== prevAddress) {
    setPrevAddress(address);
    if (address && !hasSeenAutoPrompt(address)) {
      markAutoPromptSeen(address);
      setActive(true);
    }
  }

  const open = useCallback(() => setActive(true), []);

  const api = useMemo(() => ({ open, tradingEnabled }), [open, tradingEnabled]);

  return (
    <OnboardingContext.Provider value={api}>
      {children}
      {isConnected && address && (
        <OnboardingFlow
          active={active}
          onDismiss={() => setActive(false)}
          address={address}
          identity={identity ?? null}
          // Seed the cache so the wizard sees the saved email immediately and
          // doesn't send the user back to the profile step next time it opens.
          onIdentitySaved={(saved) =>
            queryClient.setQueryData(["identity", address], saved)
          }
        />
      )}
    </OnboardingContext.Provider>
  );
}
