"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";

import { getUserIdentity } from "@/lib/profile/data";
import { useDepositState } from "@/lib/deposit/useDepositState";
import {
  hasPromptedThisTab,
  markPromptedThisTab,
} from "@/lib/onboarding/local-flags";
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
 * for a wallet that can't trade yet.
 *
 * "Can't trade yet" is read from real state (the two approvals), not from a
 * record of what the user has been shown, so the prompt stops for good the
 * moment they enable trading. A sessionStorage flag caps it at once per tab so
 * a dismissal survives a reload; a fresh tab offers it again. The wizard picks
 * its own landing step, which is why this only decides *whether* to open.
 */
export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { address, isConnected } = useAccount();
  const queryClient = useQueryClient();
  const deposit = useDepositState();

  const [active, setActive] = useState(false);

  const identityQuery = useQuery({
    queryKey: ["identity", address],
    queryFn: () => getUserIdentity(address as string),
    enabled: isConnected && !!address,
  });
  const identity = identityQuery.data ?? null;
  // `getUserIdentity` catches its own errors and resolves to null, so success is
  // this query's only terminal state. If that ever changes, this stops settling
  // and the wizard silently never auto-opens.
  const identityReady = identityQuery.isSuccess;

  // Trading needs both approvals, so both reads must land before we can answer.
  const tradingEnabled =
    deposit.allowance == null || deposit.vtkAllowanceToExchange == null
      ? null
      : deposit.allowance > 0n && deposit.vtkAllowanceToExchange > 0n;

  // Both inputs to the decision have landed: the approvals say whether this
  // wallet needs the wizard at all, the identity row says where it should land.
  const dataReady = tradingEnabled !== null && identityReady;

  // The blocks below adjust state during render rather than in an effect (the
  // codebase's `prevOpen` idiom) — they only react to values changing, with
  // nothing to subscribe to or clean up.

  // A wallet switch is a fresh start: drop whatever the previous wallet had
  // open so the new one never inherits it mid-flow.
  const [prevAddress, setPrevAddress] = useState(address);
  if (address !== prevAddress) {
    setPrevAddress(address);
    setActive(false);
  }

  // The landing page is a marketing surface, and wagmi reconnects a returning
  // visitor's wallet there without them having entered the app at all — so
  // don't interrupt it. Skipping the whole decision below (rather than just the
  // open) is deliberate: the once-per-tab flag is sessionStorage and survives
  // the full-page nav to /home, so evaluating here would burn it and suppress
  // the prompt on the route that actually wants it.
  const onLanding = usePathname() === "/";

  // Decide at most once per wallet per page session. `decidedFor` is written
  // when we *evaluate*, not when we open, and the guard keys off the address —
  // never off `active`. That's what keeps this edge-triggered: the level form
  // (`tradingEnabled === false && !active`) re-satisfies itself the instant
  // onDismiss sets active back to false, turning every dismiss into a reopen.
  const [decidedFor, setDecidedFor] = useState<string | null>(null);
  const [justPrompted, setJustPrompted] = useState<string | null>(null);
  if (isConnected && address && dataReady && !onLanding && decidedFor !== address) {
    setDecidedFor(address);
    if (tradingEnabled === false && !hasPromptedThisTab(address)) {
      setJustPrompted(address);
      setActive(true);
    }
  }

  // The storage write is committed in an effect, never during render: React can
  // discard a render pass — it does exactly that when the block above sets
  // state — and a write from a discarded pass would suppress a prompt that was
  // never actually shown.
  useEffect(() => {
    if (justPrompted) markPromptedThisTab(justPrompted);
  }, [justPrompted]);

  const open = useCallback(() => setActive(true), []);

  const api = useMemo(() => ({ open, tradingEnabled }), [open, tradingEnabled]);

  return (
    <OnboardingContext.Provider value={api}>
      {children}
      {isConnected && address && (
        <OnboardingFlow
          active={active}
          identityReady={identityReady}
          onDismiss={() => setActive(false)}
          address={address}
          identity={identity}
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
