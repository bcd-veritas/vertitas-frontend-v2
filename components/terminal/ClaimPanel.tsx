"use client";

import { useEffect, useRef, useState } from "react";
import {
  useAccount,
  usePublicClient,
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
  winningOutcomeIndex,
  shares,
  onClaimed,
}: {
  marketId: string;
  marketAddress: string | null;
  winningLabel: string;
  /** Winning outcome index — used to read the wallet's on-chain CTF balance so
   *  the button only opens once settlement has delivered the tokens. */
  winningOutcomeIndex: number;
  /** Unclaimed shares on the winning outcome — $1/share. */
  shares: number;
  /** Fires once claim-sync succeeds, so the parent can refetch positions. */
  onClaimed: () => void;
}) {
  const { address, chainId: walletChainId, isConnected } = useAccount();
  const { switchChain } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<`0x${string}` | undefined>(undefined);
  const [credited, setCredited] = useState<string | null>(null);
  // Guards the post-receipt sync so it fires exactly once per tx hash, even
  // if this effect re-runs (e.g. onClaimed identity changing upstream).
  const syncedHashRef = useRef<string | null>(null);

  const wrongNetwork = isConnected && walletChainId !== sepolia.id;
  const tone = toneForLabel(winningLabel);

  // On-chain delivery gate: true once settlement has moved the winning CTF into
  // this wallet (getOutcomeBalance > 0). null = still checking. The claim button
  // stays a "settling…" state until this is true, so a wallet can never fire a
  // redeem before its tokens exist (the resolve→settle window). Polls until
  // delivered or the claim is done.
  const [delivered, setDelivered] = useState<boolean | null>(null);

  useEffect(() => {
    if (!publicClient || !marketAddress || !address) return;
    if (phase === "done" || delivered === true) return;
    let alive = true;
    const read = async () => {
      try {
        const bal = (await publicClient.readContract({
          address: marketAddress as `0x${string}`,
          abi: marketAbi,
          functionName: "getOutcomeBalance",
          args: [address, BigInt(winningOutcomeIndex)],
        })) as bigint;
        if (alive) setDelivered(bal > 0n);
      } catch {
        // Read failed (RPC hiccup): leave the gate as-is. The claim path's own
        // pre-estimate is the fallback that still blocks a doomed redeem.
      }
    };
    read();
    const t = setInterval(read, 10_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [publicClient, marketAddress, address, winningOutcomeIndex, phase, delivered]);

  // `timeout` guarantees the wait resolves (or errors) instead of polling
  // forever if the RPC never surfaces the receipt — otherwise the button can
  // hang on "confirming" indefinitely.
  const { data: receipt, error: receiptError } = useWaitForTransactionReceipt({
    hash,
    timeout: 90_000,
  });

  // Receipt never came (timeout / RPC failure): surface an error and reset so
  // the user can retry, rather than sitting on "confirming".
  useEffect(() => {
    if (!receiptError || !hash) return;
    if (syncedHashRef.current === hash) return;
    syncedHashRef.current = hash;
    Promise.resolve().then(() => {
      setError("couldn’t confirm the transaction — refresh and try again");
      setPhase("error");
    });
  }, [receiptError, hash]);

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
      // Estimate gas against the APP's RPC (not the wallet's). Two wins:
      //  1. Passing a real gas number stops MetaMask from falling back to the
      //     block limit (~21M) on its Infura endpoint, which Infura rejects at
      //     broadcast ("gas limit too high (cap: 16777216)").
      //  2. If the redeem WOULD revert — e.g. settlement hasn't delivered the
      //     winning CTF yet (the resolve→settle window) — this throws HERE, so
      //     we fail fast with a clear message instead of submitting a doomed tx
      //     that reverts and leaves the button stuck on "confirming".
      let gas: bigint;
      try {
        const estimate = await publicClient!.estimateContractGas({
          address: marketAddress as `0x${string}`,
          abi: marketAbi,
          functionName: "redeemPositions",
          account: address,
        });
        gas = (estimate * 125n) / 100n; // 25% headroom
      } catch {
        setError(
          "not claimable yet — winnings are still settling on-chain, try again in a minute",
        );
        setPhase("error");
        return;
      }

      const h = await writeContractAsync({
        address: marketAddress as `0x${string}`,
        abi: marketAbi,
        functionName: "redeemPositions",
        gas,
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
          ${(Number(credited) / 1e6).toFixed(2)}
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
      ) : delivered !== true && !busy ? (
        // Winning tokens haven't landed in the wallet yet (settlement still
        // running, or first on-chain read pending). Show a passive "settling"
        // state — NOT a clickable claim — so no redeem can fire before the CTF
        // exists. Flips to the button automatically when the poll sees > 0.
        <div className="mt-3 flex items-center gap-2">
          <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-muted/40 border-t-transparent" />
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            settling on-chain — claim opens shortly…
          </p>
        </div>
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
