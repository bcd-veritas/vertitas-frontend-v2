"use client";

import { useEffect, useState } from "react";

import type { UserIdentity } from "@/lib/profile/data";
import { useDepositState } from "@/lib/deposit/useDepositState";
import { DepositModal } from "../deposit/DepositModal";
import { ApproveTokenModal } from "./ApproveTokenModal";
import { CredentialsModal } from "./CredentialsModal";
import { EnableTradingModal } from "./EnableTradingModal";

type Step = "credentials" | "enable" | "approve" | "deposit";
const ORDER: Step[] = ["credentials", "enable", "approve", "deposit"];

/**
 * Sequences the four onboarding modals — one open at a time — starting at the
 * first step the wallet hasn't completed, and skipping any already-satisfied
 * step as it advances. Each modal is also usable on its own; this just chains
 * them for a new user. Closing any modal dismisses the whole flow.
 */
export function OnboardingFlow({
  active,
  onDismiss,
  address,
  identity,
  onIdentitySaved,
}: {
  active: boolean;
  onDismiss: () => void;
  address: string;
  identity: UserIdentity | null;
  onIdentitySaved?: (identity: UserIdentity) => void;
}) {
  const deposit = useDepositState();
  const [step, setStep] = useState<Step | null>(null);

  const credDone = Boolean(identity?.email);
  const funded = deposit.usdccBalance != null && deposit.usdccBalance > 0n;
  const vtkApproved =
    deposit.vtkAllowanceToExchange != null && deposit.vtkAllowanceToExchange > 0n;
  const usdccApproved = deposit.allowance != null && deposit.allowance > 0n;

  const isDone = (s: Step): boolean => {
    switch (s) {
      case "credentials":
        return credDone;
      case "enable":
        return funded && vtkApproved;
      case "approve":
        return usdccApproved;
      case "deposit":
        return false; // terminal action — no persistent "done" signal
    }
  };

  // On activation, open the first step the wallet hasn't completed.
  useEffect(() => {
    if (!active) {
      setStep(null);
      return;
    }
    setStep(ORDER.find((s) => !isDone(s)) ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  function finish() {
    setStep(null);
    onDismiss();
  }

  function advance(from: Step) {
    for (let i = ORDER.indexOf(from) + 1; i < ORDER.length; i++) {
      const s = ORDER[i];
      if (s === "deposit" || !isDone(s)) {
        setStep(s);
        return;
      }
    }
    finish();
  }

  return (
    <>
      <CredentialsModal
        open={step === "credentials"}
        onClose={finish}
        address={address}
        identity={identity}
        onSaved={onIdentitySaved}
        onDone={() => advance("credentials")}
      />
      <EnableTradingModal
        open={step === "enable"}
        onClose={finish}
        onDone={() => advance("enable")}
      />
      <ApproveTokenModal
        open={step === "approve"}
        onClose={finish}
        onDone={() => advance("approve")}
      />
      <DepositModal
        open={step === "deposit"}
        onClose={finish}
        isVoter={false}
        onDeposited={finish}
      />
    </>
  );
}
