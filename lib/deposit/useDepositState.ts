"use client";

import { useAccount, useReadContract } from "wagmi";
import { erc20Abi } from "@/lib/uma/abi";
import { VTK_TOKEN } from "@/lib/uma/config";
import { COLLATERAL_VAULT, USDCC_TOKEN } from "./config";

export type DepositState = {
  /** Wallet USDCC balance (6-dec base units) — the max depositable. */
  usdccBalance: bigint | null;
  /** USDCC allowance granted to the vault — drives the approve step. */
  allowance: bigint | null;
  /** Wallet VTK balance (6-dec) — the voter-flow readout. */
  vtkBalance: bigint | null;
  /** Re-read balances + allowance after a tx confirms. */
  refetch: () => void;
};

/** On-chain reads backing the deposit modal. Idle until a wallet connects. */
export function useDepositState(): DepositState {
  const { address } = useAccount();
  const enabled = Boolean(address);
  const owner = address as `0x${string}` | undefined;

  const usdccBalance = useReadContract({
    address: USDCC_TOKEN,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: owner ? [owner] : undefined,
    query: { enabled },
  });

  const allowance = useReadContract({
    address: USDCC_TOKEN,
    abi: erc20Abi,
    functionName: "allowance",
    args: owner ? [owner, COLLATERAL_VAULT] : undefined,
    query: { enabled },
  });

  const vtkBalance = useReadContract({
    address: VTK_TOKEN,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: owner ? [owner] : undefined,
    query: { enabled },
  });

  return {
    usdccBalance: (usdccBalance.data as bigint | undefined) ?? null,
    allowance: (allowance.data as bigint | undefined) ?? null,
    vtkBalance: (vtkBalance.data as bigint | undefined) ?? null,
    refetch: () => {
      usdccBalance.refetch();
      allowance.refetch();
      vtkBalance.refetch();
    },
  };
}
