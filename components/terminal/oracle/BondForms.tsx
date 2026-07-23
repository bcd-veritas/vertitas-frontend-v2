"use client";

import { useState } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { syncBondStake } from "@/lib/markets/data";
import type { ApiMarket } from "@/lib/markets/types";
import { umaOracleAbi, erc20Abi } from "@/lib/uma/abi";
import { UMA_ORACLE, VTK_TOKEN } from "@/lib/uma/config";
import type { UmaState } from "@/lib/uma/useUmaState";
import { OutcomeChipButton, toneForLabel } from "./atoms";
import { TxButton } from "./TxButton";

const fmtVtk = (v: bigint) => (Number(v) / 1e6).toFixed(0);

/**
 * One corner of the truth match. Propose (assertOutcome) or dispute
 * (disputeOutcome): pick an outcome, post the wallet-VTK bond. Two explicit
 * steps when allowance is short: approve first, then act. Bond figures are
 * WALLET VTK — never the app's DB balance.
 *
 * Interaction hierarchy: filled TxButtons are the ONLY clickable actions
 * here besides the outcome chips; stakes, balances, and labels are passive
 * mono copy.
 */
export function BondForm({
  mode,
  market,
  uma,
}: {
  mode: "propose" | "dispute";
  market: ApiMarket;
  uma: UmaState;
}) {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [outcomeIndex, setOutcomeIndex] = useState<number | null>(null);

  const allowed = mode === "propose" ? uma.roles.proposer : uma.roles.disputer;
  if (!allowed || uma.onchainMarketId == null || uma.bondThreshold == null) {
    return null;
  }

  const bond = uma.bondThreshold;
  const balance = uma.walletVtk ?? 0n;
  const allowance = uma.allowance ?? 0n;
  const insufficient = balance < bond;
  const needsApproval = !insufficient && allowance < bond;
  const ready = !insufficient && !needsApproval && outcomeIndex != null;
  const marketId = uma.onchainMarketId;

  // The dispute must back a DIFFERENT outcome than the assertion.
  const assertedIndex = uma.events.assertion?.outcomeIndex ?? null;
  const options = market.outcomes.filter(
    (o) => mode === "propose" || o.index !== assertedIndex,
  );

  // The dispute must counter a known assertion — don't offer options until
  // the AssertionCreated event has loaded, or the asserted outcome would
  // transiently appear as a valid (nonsensical) dispute choice.
  if (mode === "dispute" && assertedIndex == null) {
    return (
      <p className="py-4 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
        loading assertion…
      </p>
    );
  }

  // A fighter can't take both corners: the proposer cannot dispute their own
  // claim. The contract doesn't enforce this (whitelist+bond+status only),
  // so the UI must — otherwise one wallet could stage a fake fight and steer
  // the committee. Checked by wallet, not role, since demo wallets often hold
  // both whitelists.
  const isOwnClaim =
    mode === "dispute" &&
    address != null &&
    uma.events.assertion != null &&
    address.toLowerCase() === uma.events.assertion.proposer.toLowerCase();
  if (isOwnClaim) {
    return (
      <p className="py-4 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
        you made this claim — the proposer can&apos;t dispute it.
        <br />
        <span className="text-muted/70">
          switch to a different whitelisted disputer wallet
        </span>
      </p>
    );
  }

  const selectedLabel =
    outcomeIndex != null
      ? (market.outcomes.find((o) => o.index === outcomeIndex)?.label ?? null)
      : null;
  // The action button tones to the outcome being backed; before a pick it
  // carries the corner's identity (accent for propose, challenge-red for
  // dispute) so the primary action is always visibly clickable.
  const actionTone =
    selectedLabel != null
      ? toneForLabel(selectedLabel)
      : mode === "propose"
        ? "var(--color-accent)"
        : "var(--color-no)";

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="flex flex-wrap items-center justify-center gap-2">
        {options.map((o) => (
          <OutcomeChipButton
            key={o.id}
            label={o.label}
            selected={outcomeIndex === o.index}
            onSelect={() => setOutcomeIndex(o.index)}
          />
        ))}
      </div>

      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
        stake {fmtVtk(bond)} vtk · wallet{" "}
        <span className={insufficient ? "text-no" : "text-fg/85"}>
          {fmtVtk(balance)} vtk
        </span>
      </p>

      {insufficient ? (
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-no">
          insufficient wallet vtk — need {fmtVtk(bond)}
        </p>
      ) : needsApproval ? (
        // Two-step flow, ONE button at a time: approve first; once the
        // allowance lands (refetch), this whole branch swaps to the act
        // button. Never show a disabled act button beside approve — a dimmed
        // filled button reads as a broken container, not a next step.
        <div className="flex flex-col items-center gap-1.5">
          <TxButton
            label={`approve ${fmtVtk(bond)} vtk stake`}
            disabled={outcomeIndex == null}
            send={() =>
              writeContractAsync({
                address: VTK_TOKEN,
                abi: erc20Abi,
                functionName: "approve",
                args: [UMA_ORACLE, bond],
              })
            }
            onConfirmed={uma.refetch}
          />
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted/70">
            {outcomeIndex == null
              ? "pick an outcome first"
              : `step 1 of 2 — ${mode === "propose" ? "assert" : "dispute"} unlocks after approval`}
          </p>
        </div>
      ) : (
        <TxButton
          label={
            mode === "propose"
              ? selectedLabel
                ? `assert ${selectedLabel}`
                : "pick an outcome to assert"
              : selectedLabel
                ? `dispute — back ${selectedLabel}`
                : "pick an outcome to dispute"
          }
          disabled={!ready}
          tone={actionTone}
          send={() =>
            writeContractAsync({
              address: UMA_ORACLE,
              abi: umaOracleAbi,
              functionName:
                mode === "propose" ? "assertOutcome" : "disputeOutcome",
              args: [marketId, BigInt(outcomeIndex ?? 0), bond],
            })
          }
          onConfirmed={(hash) => {
            // Wallet VTK just left for the oracle — mirror the debit into
            // the DB ledger (Topbar refreshes itself via the userChanged
            // socket event the sync emits). Best-effort: the chain is the
            // truth either way, so a failed sync only logs.
            if (address) {
              syncBondStake(market.id, address, hash).catch((e) => {
                console.warn("bond ledger sync failed", e);
              });
            }
            uma.refetch();
          }}
        />
      )}
    </div>
  );
}
