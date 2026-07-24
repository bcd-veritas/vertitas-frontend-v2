"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { formatUnits, maxUint256 } from "viem";
import { useAccount, useWriteContract } from "wagmi";

import { erc20Abi } from "@/lib/uma/abi";
import { VTK_TOKEN } from "@/lib/uma/config";
import { EXCHANGE_CONTRACT, USDCC_DECIMALS } from "@/lib/deposit/config";
import { useDepositState } from "@/lib/deposit/useDepositState";
import { enableTrading } from "@/lib/profile/data";
import { TxButton } from "../terminal/oracle/TxButton";
import { ModalShell } from "./ModalShell";

const fmt = (v: bigint) =>
  Number(formatUnits(v, USDCC_DECIMALS)).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });

/** A completed / pending line item. */
function Line({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <p className={`flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest ${done ? "text-yes" : "text-muted/70"}`}>
      {done && <Check size={12} aria-hidden="true" />}
      {children}
    </p>
  );
}

/**
 * Step 2 — enable trading. Two actions: get test USDCC from the operator, then
 * approve VTK to the Exchange so settlement can collect collateral. Standalone-
 * usable; `onDone` advances the onboarding flow once both are satisfied.
 */
export function EnableTradingModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone?: () => void;
}) {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const deposit = useDepositState();

  const [funding, setFunding] = useState(false);
  const [fundError, setFundError] = useState<string | null>(null);

  const funded = deposit.usdccBalance != null && deposit.usdccBalance > 0n;
  const vtkApproved =
    deposit.vtkAllowanceToExchange != null && deposit.vtkAllowanceToExchange > 0n;
  const complete = funded && vtkApproved;

  async function fund() {
    if (!address) return;
    setFunding(true);
    setFundError(null);
    try {
      await enableTrading(address);
      deposit.refetch();
    } catch (e) {
      setFundError(e instanceof Error ? e.message : String(e));
    } finally {
      setFunding(false);
    }
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="ENABLE TRADING"
      subtitle="Get test USDCC, then let settlement use your VTK."
      footer={
        <button
          type="button"
          onClick={() => onDone?.()}
          disabled={!complete}
          className="pill pill-solid w-full py-2.5! font-mono text-[11px] uppercase tracking-[0.14em] disabled:opacity-40"
        >
          continue
        </button>
      }
    >
      {/* Fund */}
      <div className="flex flex-col gap-2">
        {funded ? (
          <Line done>
            funded · {deposit.usdccBalance != null ? `${fmt(deposit.usdccBalance)} usdcc` : "…"}
          </Line>
        ) : (
          <>
            <button
              type="button"
              onClick={fund}
              disabled={funding}
              className="pill pill-solid self-start py-2! px-5! font-mono text-[11px] uppercase tracking-[0.14em] disabled:opacity-40"
            >
              {funding ? "funding…" : "get 5,000 usdcc"}
            </button>
            {fundError && <p className="font-mono text-[10px] text-no">{fundError}</p>}
          </>
        )}
      </div>

      {/* VTK approval */}
      <div className="flex flex-col gap-2">
        {vtkApproved ? (
          <Line done>vtk approved for settlement</Line>
        ) : (
          <TxButton
            label="approve vtk for settlement"
            variant="outline"
            send={() =>
              writeContractAsync({
                address: VTK_TOKEN,
                abi: erc20Abi,
                functionName: "approve",
                args: [EXCHANGE_CONTRACT, maxUint256],
              })
            }
            onConfirmed={() => deposit.refetch()}
          />
        )}
      </div>
    </ModalShell>
  );
}
