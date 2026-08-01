"use client";

import { useEffect } from "react";
import { Check } from "lucide-react";
import { useAccount } from "wagmi";

import { useDepositState } from "@/lib/deposit/useDepositState";
import { useEnableTrading, type EnableOp } from "@/lib/deposit/useEnableTrading";
import { ProgressModal, type ProgressStep } from "../common/ProgressModal";
import { MonoLabel } from "../landing/ui/MonoLabel";
import { ModalBody, ModalFooter } from "./ModalShell";

export const ENABLE_TITLE = "ENABLE TRADING";
export const ENABLE_SUBTITLE =
  "Two one-time approvals. You keep custody of your funds.";

/** The line under a step, telling the user what they're waiting on. */
function noteFor(op: EnableOp): string | undefined {
  if (op.state === "failed") {
    return op.optional
      ? "Skipped — you can still deposit your own USDCC"
      : op.error;
  }
  if (op.state === "done" && op.skipped) return "Already authorized";
  if (op.state !== "active") return undefined;
  switch (op.subPhase) {
    case "wallet":
      return "Confirm in your wallet";
    case "chain":
      return "Waiting for confirmation";
    case "server":
      return "This takes about 15 seconds";
    default:
      return undefined;
  }
}

const toStep = (op: EnableOp): ProgressStep => ({
  id: op.id,
  label: op.label,
  state: op.state,
  optional: op.optional,
  note: noteFor(op),
});

/**
 * Step 2 — enable trading. One button grants both approvals the exchange needs
 * and funds the wallet, with a live stepper over the top.
 */
export function EnableTradingStep({
  onDone,
  onBusyChange,
}: {
  onDone?: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const { address } = useAccount();
  const deposit = useDepositState();
  const tx = useEnableTrading(deposit.refetch);

  useEffect(() => {
    onBusyChange?.(tx.busy);
  }, [tx.busy, onBusyChange]);

  const usdccApproved = deposit.allowance != null && deposit.allowance > 0n;
  const vtkApproved =
    deposit.vtkAllowanceToExchange != null && deposit.vtkAllowanceToExchange > 0n;
  const complete = usdccApproved && vtkApproved;

  const grants = [
    { id: "usdcc", text: "Convert your USDCC into collateral", done: usdccApproved },
    { id: "vtk", text: "Settle collateral when your orders fill", done: vtkApproved },
  ];

  // The run's own result decides nothing here: `complete` is read back off-chain,
  // so a soft-failed funding step still lets the user through.
  function closeProgress() {
    const succeeded = tx.phase === "success";
    tx.reset();
    if (succeeded) onDone?.();
  }

  return (
    <>
      <ModalBody>
        <div className="flex flex-col gap-3.5">
          <MonoLabel>{complete ? "you granted" : "you're granting"}</MonoLabel>
          <ul className="flex flex-col gap-2.5">
            {grants.map((g) => (
              <li key={g.id} className="flex items-baseline gap-3">
                <span
                  aria-hidden="true"
                  className={`w-3 shrink-0 font-mono text-[11px] ${g.done ? "text-yes" : "text-accent"}`}
                >
                  {g.done ? <Check size={12} className="translate-y-px" /> : "▸"}
                </span>
                <span
                  className={`text-[13px] leading-snug ${g.done ? "text-muted" : "text-fg"}`}
                >
                  {g.text}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </ModalBody>

      <ModalFooter>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={complete ? () => onDone?.() : () => void tx.run()}
            disabled={!address || tx.busy || tx.wrongNetwork}
            className={`pill pill-solid relative w-full overflow-hidden py-2.5! font-mono text-[11px] uppercase tracking-[0.14em] disabled:opacity-40 ${tx.busy ? "cta-busy" : ""}`}
          >
            {complete ? "continue" : "enable trading"}
          </button>
          {address && tx.wrongNetwork && (
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-no">
              switch wallet to sepolia
            </p>
          )}
        </div>
      </ModalFooter>

      <ProgressModal
        phase={tx.phase === "idle" ? null : tx.phase}
        steps={tx.ops.map(toStep)}
        title={{
          running: "enabling trading",
          success: "trading enabled",
          error: "couldn't enable trading",
        }}
        caption={{
          running: "granting approvals from your wallet…",
          success: "you're ready to deposit",
          error: "stopped here — earlier approvals are still in place",
        }}
        // No run-level message: every failure is already attributed to the step
        // that produced it, and repeating it below just says the same thing twice.
        onClose={closeProgress}
        closeLabel={tx.phase === "success" ? "Continue" : "Close"}
      />
    </>
  );
}
