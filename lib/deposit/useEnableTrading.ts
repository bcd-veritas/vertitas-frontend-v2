"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { maxUint256 } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { sepolia } from "wagmi/chains";

import { erc20Abi } from "@/lib/uma/abi";
import { VTK_TOKEN } from "@/lib/uma/config";
import { friendlyTxError } from "@/lib/uma/errors";
import { enableTrading } from "@/lib/profile/data";
import { COLLATERAL_VAULT, EXCHANGE_CONTRACT, USDCC_TOKEN } from "./config";

export type EnableOpId = "approve-usdcc" | "approve-vtk" | "fund";
export type OpState = "pending" | "active" | "done" | "failed";
/** "wallet" = prompt open · "chain" = mining · "server" = backend POST. */
export type SubPhase = "wallet" | "chain" | "server";

export type EnableOp = {
  id: EnableOpId;
  label: string;
  state: OpState;
  /** A failure here doesn't fail the run — the approvals are what enable trading. */
  optional?: boolean;
  /** Already satisfied on-chain: shown as done, never executed. */
  skipped?: boolean;
  subPhase?: SubPhase;
  hash?: `0x${string}`;
  error?: string;
};

export type RunPhase = "idle" | "running" | "success" | "error";

const initialOps = (): EnableOp[] => [
  { id: "approve-usdcc", label: "Approving USDCC for the vault", state: "pending" },
  { id: "approve-vtk", label: "Approving collateral for settlement", state: "pending" },
  { id: "fund", label: "Preparing your account", state: "pending", optional: true },
];

/**
 * Runs the whole "enable trading" sequence off one click: approve USDCC to the
 * vault, approve VTK to the exchange, then have the operator fund the wallet.
 * Approvals already granted are skipped, and the funding call is best-effort —
 * trading works without it.
 *
 * `onSettled` fires however the run ends, so the caller can re-read balances:
 * an early op may have landed before a later one failed.
 */
export function useEnableTrading(onSettled?: () => void) {
  const { address, chainId } = useAccount();
  const client = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [ops, setOps] = useState<EnableOp[]>(initialOps);
  const [phase, setPhase] = useState<RunPhase>("idle");
  const [error, setError] = useState<string | null>(null);

  // opsRef is the truth inside the async loop; setOps only publishes it. Deriving
  // each update from the `ops` binding would rebuild from the render that started
  // the run and drop every patch made after the first await.
  const opsRef = useRef(ops);
  const busyRef = useRef(false);
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const patch = useCallback((id: EnableOpId, p: Partial<EnableOp>) => {
    opsRef.current = opsRef.current.map((o) => (o.id === id ? { ...o, ...p } : o));
    if (aliveRef.current) setOps(opsRef.current);
  }, []);

  // Wallet truth, not config truth — useChainId() misses a wallet on mainnet.
  const wrongNetwork = chainId !== sepolia.id;

  const run = useCallback(async () => {
    // Synchronous guard: a `phase === "running"` check is a render behind and
    // lets a double-click through.
    if (busyRef.current || !address || !client || wrongNetwork) return;
    busyRef.current = true;
    opsRef.current = initialOps();
    if (aliveRef.current) {
      setOps(opsRef.current);
      setError(null);
      setPhase("running");
    }

    const finish = (p: RunPhase) => {
      busyRef.current = false;
      if (aliveRef.current) setPhase(p);
      // Runs even after unmount: useDepositState lives in the parent flow, which
      // must re-derive from post-run on-chain state.
      onSettled?.();
    };

    // Read allowances fresh rather than trusting the caller's cached copy, which
    // may still be loading (null) or stale from another tab.
    let usdccAllowance = 0n;
    let vtkAllowance = 0n;
    try {
      [usdccAllowance, vtkAllowance] = (await Promise.all([
        client.readContract({
          address: USDCC_TOKEN,
          abi: erc20Abi,
          functionName: "allowance",
          args: [address, COLLATERAL_VAULT],
        }),
        client.readContract({
          address: VTK_TOKEN,
          abi: erc20Abi,
          functionName: "allowance",
          args: [address, EXCHANGE_CONTRACT],
        }),
      ])) as [bigint, bigint];
    } catch {
      // RPC hiccup — skip nothing. A redundant max approval is harmless.
    }

    const approvals = [
      {
        id: "approve-usdcc" as const,
        token: USDCC_TOKEN,
        spender: COLLATERAL_VAULT,
        satisfied: usdccAllowance > 0n,
      },
      {
        id: "approve-vtk" as const,
        token: VTK_TOKEN,
        spender: EXCHANGE_CONTRACT,
        satisfied: vtkAllowance > 0n,
      },
    ];

    for (const a of approvals) {
      if (a.satisfied) {
        patch(a.id, { state: "done", skipped: true });
        continue;
      }
      try {
        patch(a.id, { state: "active", subPhase: "wallet" });
        const hash = await writeContractAsync({
          address: a.token,
          abi: erc20Abi,
          functionName: "approve",
          args: [a.spender, maxUint256],
        });
        patch(a.id, { subPhase: "chain", hash });
        const receipt = await client.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") {
          throw new Error("transaction reverted on-chain");
        }
        patch(a.id, { state: "done", subPhase: undefined });
      } catch (e) {
        // friendlyTxError already walks for UserRejectedRequestError.
        const msg = friendlyTxError(e);
        patch(a.id, { state: "failed", subPhase: undefined, error: msg });
        if (aliveRef.current) setError(msg);
        finish("error");
        return;
      }
    }

    // Best-effort, and slow: the backend awaits a Sepolia receipt before replying.
    // Idempotent server-side, so a retry costs nothing.
    patch("fund", { state: "active", subPhase: "server" });
    try {
      await enableTrading(address);
      patch("fund", { state: "done", subPhase: undefined });
    } catch (e) {
      patch("fund", {
        state: "failed",
        subPhase: undefined,
        error: e instanceof Error ? e.message : "funding unavailable",
      });
    }
    finish("success");
  }, [address, client, wrongNetwork, writeContractAsync, patch, onSettled]);

  const reset = useCallback(() => {
    if (busyRef.current) return;
    opsRef.current = initialOps();
    setOps(opsRef.current);
    setError(null);
    setPhase("idle");
  }, []);

  return {
    ops,
    phase,
    error,
    busy: phase === "running",
    wrongNetwork,
    run,
    reset,
  };
}
