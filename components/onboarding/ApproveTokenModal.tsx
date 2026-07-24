"use client";

import { Check } from "lucide-react";
import { maxUint256 } from "viem";
import { useWriteContract } from "wagmi";

import { erc20Abi } from "@/lib/uma/abi";
import { COLLATERAL_VAULT, USDCC_TOKEN } from "@/lib/deposit/config";
import { useDepositState } from "@/lib/deposit/useDepositState";
import { TxButton } from "../terminal/oracle/TxButton";
import { ModalShell } from "./ModalShell";

/**
 * Step 3 — approve token. One-time USDCC approval so the CollateralVault can pull
 * it on deposit. Standalone-usable; `onDone` advances the onboarding flow.
 */
export function ApproveTokenModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone?: () => void;
}) {
  const { writeContractAsync } = useWriteContract();
  const deposit = useDepositState();

  const approved = deposit.allowance != null && deposit.allowance > 0n;

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="APPROVE USDCC"
      subtitle="A one-time approval lets the vault convert your USDCC to VTK collateral."
      footer={
        <button
          type="button"
          onClick={() => onDone?.()}
          disabled={!approved}
          className="pill pill-solid w-full py-2.5! font-mono text-[11px] uppercase tracking-[0.14em] disabled:opacity-40"
        >
          continue
        </button>
      }
    >
      {approved ? (
        <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-yes">
          <Check size={12} aria-hidden="true" />
          usdcc approved
        </p>
      ) : (
        <TxButton
          label="approve usdcc (one-time)"
          send={() =>
            writeContractAsync({
              address: USDCC_TOKEN,
              abi: erc20Abi,
              functionName: "approve",
              args: [COLLATERAL_VAULT, maxUint256],
            })
          }
          onConfirmed={() => deposit.refetch()}
        />
      )}
    </ModalShell>
  );
}
