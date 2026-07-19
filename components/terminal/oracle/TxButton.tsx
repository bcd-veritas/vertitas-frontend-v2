"use client";

import { useState } from "react";
import { useChainId, usePublicClient } from "wagmi";
import { sepolia } from "wagmi/chains";
import { friendlyTxError } from "@/lib/uma/errors";

type Phase = "idle" | "wallet" | "pending" | "done" | "error";

/** One button = one transaction. Handles wallet prompt → pending (Etherscan
 *  link) → confirmed/reverted, with a friendly error line. Guards against
 *  wrong network (Sepolia only). */
export function TxButton({
  label,
  send,
  onConfirmed,
  disabled = false,
  tone = "var(--color-accent)",
  variant = "filled",
}: {
  label: string;
  /** Fire the tx (wagmi writeContractAsync) and return its hash. */
  send: () => Promise<`0x${string}`>;
  onConfirmed?: () => void;
  disabled?: boolean;
  tone?: string;
  /** "filled" = the highlighted, clearly-clickable action (default);
   *  "outline" = secondary action. Readouts never use TxButton. */
  variant?: "filled" | "outline";
}) {
  const client = usePublicClient();
  const chainId = useChainId();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<`0x${string}` | null>(null);

  const wrongNetwork = chainId !== sepolia.id;
  const busy = phase === "wallet" || phase === "pending";

  async function run() {
    if (!client || busy || disabled || wrongNetwork) return;
    setError(null);
    setHash(null);
    setPhase("wallet");
    try {
      const h = await send();
      setHash(h);
      setPhase("pending");
      const receipt = await client.waitForTransactionReceipt({ hash: h });
      if (receipt.status !== "success") {
        throw new Error("transaction reverted on-chain");
      }
      setPhase("done");
      onConfirmed?.();
    } catch (e) {
      setError(friendlyTxError(e));
      setPhase("error");
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={run}
        disabled={disabled || busy || wrongNetwork}
        className={`px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] border transition-all disabled:opacity-35 disabled:cursor-not-allowed ${
          variant === "filled"
            ? "font-bold hover:brightness-110 active:brightness-90 cursor-pointer"
            : "hover:bg-fg/5 cursor-pointer"
        }`}
        style={
          variant === "filled"
            ? { background: tone, borderColor: tone, color: "var(--color-bg)" }
            : { borderColor: tone, color: tone }
        }
      >
        {phase === "wallet"
          ? "confirm in wallet…"
          : phase === "pending"
            ? "pending…"
            : label}
      </button>
      {wrongNetwork && (
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-no">
          switch wallet to sepolia
        </p>
      )}
      {phase === "pending" && hash && (
        <a
          href={`https://sepolia.etherscan.io/tx/${hash}`}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted underline"
        >
          view on etherscan
        </a>
      )}
      {phase === "done" && (
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-yes">
          confirmed
        </p>
      )}
      {phase === "error" && error && (
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-no">
          {error}
        </p>
      )}
    </div>
  );
}
