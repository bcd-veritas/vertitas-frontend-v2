"use client";

import { useEffect, useRef, useState } from "react";
import {
  useAccount,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { sepolia } from "wagmi/chains";
import { marketAbi } from "@/lib/markets/marketAbi";
import { syncClaim, ClaimError } from "@/lib/markets/data";
import { friendlyTxError } from "@/lib/uma/errors";
import { toneForLabel } from "./oracle/atoms";

type Phase = "idle" | "wallet" | "confirming" | "syncing" | "done" | "error";

function claimErrorMessage(e: unknown): string {
  if (e instanceof ClaimError) {
    switch (e.code) {
      case "CLAIM_TX_FAILED":
        return "claim failed to confirm on-chain — try again";
      case "CLAIM_NOT_FOUND":
        return "no winning position found for this wallet";
      case "ALREADY_CLAIMED":
        return "already claimed — balance should reflect it shortly";
      default:
        return e.message.slice(0, 120);
    }
  }
  return e instanceof Error ? e.message.slice(0, 120) : "claim failed";
}

/**
 * Lives inside ResolutionPanel's resolved Frame — rendered only while the
 * wallet's winning-outcome POSITION (settlement truth, not the trade-derived
 * total) still shows shares > 0, meaning redeemPositions() hasn't been
 * called/synced yet. Flow: wallet calls the market contract's public
 * redeemPositions() → wait for receipt → on-chain success only → POST the
 * tx hash to the middleware's claim-sync → show the credited amount.
 *
 * Wallet-truth chain guard mirrors TradePanel: reads useAccount().chainId,
 * never useChainId() (which falls back to the wagmi config's chain even when
 * the wallet itself sits on a different network).
 */
export function ClaimPanel({
  marketId,
  marketAddress,
  winningLabel,
  shares,
  onClaimed,
}: {
  marketId: string;
  marketAddress: string | null;
  winningLabel: string;
  /** Unclaimed shares on the winning outcome — $1/share. */
  shares: number;
  /** Fires once claim-sync succeeds, so the parent can refetch positions. */
  onClaimed: () => void;
}) {
  const { address, chainId: walletChainId, isConnected } = useAccount();
  const { switchChain } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<`0x${string}` | undefined>(undefined);
  const [credited, setCredited] = useState<string | null>(null);
  // Guards the post-receipt sync so it fires exactly once per tx hash, even
  // if this effect re-runs (e.g. onClaimed identity changing upstream).
  const syncedHashRef = useRef<string | null>(null);

  const wrongNetwork = isConnected && walletChainId !== sepolia.id;
  const tone = toneForLabel(winningLabel);

  const { data: receipt } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (!receipt || !hash || !address) return;
    if (syncedHashRef.current === hash) return;
    syncedHashRef.current = hash;
    // Mined-but-reverted must surface as an error, never a silent "claimed".
    // setState deferred into a resolved-promise callback (not called
    // directly in the effect body) per the project's set-state-in-effect
    // lint rule — mirrors ResolutionPanel/TradePanel's clock pattern.
    if (receipt.status !== "success") {
      Promise.resolve().then(() => {
        setError("transaction reverted on-chain");
        setPhase("error");
      });
      return;
    }
    Promise.resolve().then(() => setPhase("syncing"));
    syncClaim(marketId, address, receipt.transactionHash)
      .then((res) => {
        setCredited(res.credited);
        setPhase("done");
        onClaimed();
      })
      .catch((e: unknown) => {
        setError(claimErrorMessage(e));
        setPhase("error");
      });
  }, [receipt, hash, address, marketId, onClaimed]);

  async function claim() {
    if (
      !address ||
      !marketAddress ||
      phase === "wallet" ||
      phase === "confirming" ||
      phase === "syncing"
    ) {
      return;
    }
    setError(null);
    setPhase("wallet");
    try {
      const h = await writeContractAsync({
        address: marketAddress as `0x${string}`,
        abi: marketAbi,
        functionName: "redeemPositions",
      });
      setHash(h);
      setPhase("confirming");
    } catch (e) {
      const msg = friendlyTxError(e);
      if (msg === "rejected in wallet") {
        setPhase("idle");
        return;
      }
      setError(msg);
      setPhase("error");
    }
  }

  const busy = phase === "wallet" || phase === "confirming" || phase === "syncing";

  if (phase === "done" && credited != null) {
    return (
      <div className="mt-2 w-full border-t border-line/50 pt-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
          claimed
        </p>
        <p className="font-mono text-2xl tabular-nums text-fg">
          ${(Number(credited) / 1e8).toFixed(2)}
        </p>
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted/60">
          credited to your balance
        </p>
      </div>
    );
  }

  return (
    <div className="mt-2 w-full border-t border-line/50 pt-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
        unclaimed winnings
      </p>
      <p className="font-mono text-2xl tabular-nums text-fg">
        {shares.toFixed(2)} sh &middot; ${shares.toFixed(2)}
      </p>

      {!marketAddress ? (
        <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.1em] text-no">
          claim unavailable — market has no on-chain address
        </p>
      ) : (
        <button
          type="button"
          onClick={wrongNetwork ? () => switchChain({ chainId: sepolia.id }) : claim}
          disabled={!isConnected || busy}
          className={`mt-3 w-full px-4 py-3 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-50 ${
            busy ? "cta-busy" : ""
          }`}
          style={{ background: tone, color: "var(--color-bg)" }}
        >
          {wrongNetwork
            ? "switch wallet to sepolia"
            : phase === "wallet"
              ? "confirm in wallet…"
              : phase === "confirming"
                ? "confirming…"
                : phase === "syncing"
                  ? "syncing…"
                  : "claim winnings"}
        </button>
      )}

      {phase === "error" && error && (
        <p className="mt-2 font-mono text-[11px] text-no" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
