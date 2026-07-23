"use client";

import { maxUint256 } from "viem";
import { useAccount, useWriteContract } from "wagmi";

import { erc20Abi } from "@/lib/uma/abi";
import { VTK_TOKEN } from "@/lib/uma/config";
import { EXCHANGE_CONTRACT } from "@/lib/deposit/config";
import { useDepositState } from "@/lib/deposit/useDepositState";
import { TxButton } from "../terminal/oracle/TxButton";

/**
 * One-time VTK approval that lets the Exchange COLLECT a user's collateral at
 * settlement (Exchange.settleLegs → COLLECT does
 * `collateralToken.safeTransferFrom(user, exchange, …)`, where collateralToken is
 * VTK). Approving `maxUint256` before the user owns any VTK is valid — it only
 * sets an allowance.
 *
 * Standalone action (Phase 1). Renders nothing until a wallet is connected, and
 * disappears once the allowance is granted. Later folds into the onboarding
 * wizard's "enable trading" step.
 */
export function EnableTradingButton() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { vtkAllowanceToExchange, refetch } = useDepositState();

  // Not connected, still loading, or already approved → nothing to show.
  if (!address) return null;
  if (vtkAllowanceToExchange == null) return null;
  if (vtkAllowanceToExchange > 0n) return null;

  return (
    <TxButton
      label="enable trading"
      variant="outline"
      send={() =>
        writeContractAsync({
          address: VTK_TOKEN,
          abi: erc20Abi,
          functionName: "approve",
          args: [EXCHANGE_CONTRACT, maxUint256],
        })
      }
      onConfirmed={() => refetch()}
    />
  );
}
