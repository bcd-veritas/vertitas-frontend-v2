"use client";

import { useCallback, useState } from "react";

import type { UserIdentity } from "@/lib/profile/data";
import { useDepositState } from "@/lib/deposit/useDepositState";
import { CredentialsStep, CREDENTIALS_SUBTITLE, CREDENTIALS_TITLE } from "./CredentialsStep";
import { DepositStep, DEPOSIT_SUBTITLE, DEPOSIT_TITLE } from "./DepositStep";
import { EnableTradingStep, ENABLE_SUBTITLE, ENABLE_TITLE } from "./EnableTradingStep";
import { ModalShell } from "./ModalShell";

type Step = "credentials" | "enable" | "deposit";
const ORDER: Step[] = ["credentials", "enable", "deposit"];
/** Rail labels, index-aligned with ORDER. */
const STEP_NAMES = ["profile", "enable trading", "deposit"] as const;

const HEADINGS: Record<Step, { title: string; subtitle: string }> = {
  credentials: { title: CREDENTIALS_TITLE, subtitle: CREDENTIALS_SUBTITLE },
  enable: { title: ENABLE_TITLE, subtitle: ENABLE_SUBTITLE },
  deposit: { title: DEPOSIT_TITLE, subtitle: DEPOSIT_SUBTITLE },
};

/**
 * Sequences onboarding inside a single dialog — the panel and its progress rail
 * persist while the heading, body and footer swap per step. Starts at the first
 * step the wallet hasn't completed and skips any already-satisfied step as it
 * advances. Closing dismisses the whole flow.
 */
export function OnboardingFlow({
  active,
  identityReady,
  onDismiss,
  address,
  identity,
  onIdentitySaved,
}: {
  active: boolean;
  /** The identity fetch has settled, so `credDone` can be trusted. */
  identityReady: boolean;
  onDismiss: () => void;
  address: string;
  identity: UserIdentity | null;
  onIdentitySaved?: (identity: UserIdentity) => void;
}) {
  const deposit = useDepositState();
  const [step, setStep] = useState<Step | null>(null);
  const [busy, setBusy] = useState(false);

  // ensureAccount no longer auto-generates a username, so this is a real
  // server-backed signal — no client-side heuristic needed.
  const credDone = Boolean(identity?.username);
  const vtkApproved =
    deposit.vtkAllowanceToExchange != null && deposit.vtkAllowanceToExchange > 0n;
  const usdccApproved = deposit.allowance != null && deposit.allowance > 0n;

  const isDone = (s: Step): boolean => {
    switch (s) {
      case "credentials":
        return credDone;
      // Deliberately not gated on the wallet holding USDCC: the operator top-up
      // is a convenience that can fail, and trading is enabled by the approvals
      // alone. Gating on it would re-open this wizard forever.
      case "enable":
        return usdccApproved && vtkApproved;
      case "deposit":
        return false; // terminal action — no persistent "done" signal
    }
  };

  // Picking the landing step reads `credDone`, which only means anything once
  // the identity fetch has settled — otherwise a returning user who already has
  // a username gets sent back to the profile step. The on-chain reads and that
  // fetch are independent, so `active` alone isn't enough to arm on: the topbar
  // button appears as soon as the approvals resolve and can outrun the fetch.
  // Arming on both makes a too-early click simply open once the identity lands.
  const armed = active && identityReady;

  // On arming, open the first step the wallet hasn't completed. Adjusted during
  // render rather than in an effect (the codebase's `prevOpen` idiom) so the
  // wizard never paints a frame on the wrong step.
  //
  // Seeded from `false`, deliberately not from `armed`: the provider can flip
  // `active` during the very render that first mounts this component, in which
  // case we mount already-armed. Seeding from the prop would swallow that first
  // transition — no step would ever be picked, `active` would stay stuck true,
  // and the topbar button would look dead until a reload.
  const [prevArmed, setPrevArmed] = useState(false);
  if (armed !== prevArmed) {
    setPrevArmed(armed);
    setStep(armed ? (ORDER.find((s) => !isDone(s)) ?? null) : null);
    // A wallet switch can disarm mid-transaction; don't leave the shell locked.
    if (!armed) setBusy(false);
  }

  // Identity-stable so the steps' onBusyChange effects don't re-fire every render.
  const handleBusy = useCallback((b: boolean) => setBusy(b), []);

  function finish() {
    setBusy(false);
    setStep(null);
    onDismiss();
  }

  function advance(from: Step) {
    setBusy(false);
    for (let i = ORDER.indexOf(from) + 1; i < ORDER.length; i++) {
      const s = ORDER[i];
      if (s === "deposit" || !isDone(s)) {
        setStep(s);
        return;
      }
    }
    finish();
  }

  // Keep the last step rendered while the dialog animates out, so the panel
  // doesn't blank mid-transition.
  const [lastStep, setLastStep] = useState<Step>("credentials");
  if (step && step !== lastStep) setLastStep(step);

  const heading = HEADINGS[lastStep];

  return (
    <ModalShell
      open={step != null}
      onClose={finish}
      dismissible={!busy}
      steps={STEP_NAMES}
      stepIndex={ORDER.indexOf(lastStep)}
      title={heading.title}
      subtitle={heading.subtitle}
    >
      {/* Keyed on the step so each one's body replays the slide-in. */}
      <div key={lastStep} className="step-advance flex min-h-0 flex-col">
        {lastStep === "credentials" && (
          <CredentialsStep
            address={address}
            identity={identity}
            onSaved={onIdentitySaved}
            onDone={() => advance("credentials")}
            onBusyChange={handleBusy}
          />
        )}
        {lastStep === "enable" && (
          <EnableTradingStep
            onDone={() => advance("enable")}
            onBusyChange={handleBusy}
          />
        )}
        {lastStep === "deposit" && (
          <DepositStep
            onDeposited={finish}
            onClose={finish}
            onBusyChange={handleBusy}
          />
        )}
      </div>
    </ModalShell>
  );
}
