"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { formatUnits, maxUint256, parseUnits } from "viem";
import { useAccount, useWriteContract } from "wagmi";

import { erc20Abi } from "@/lib/uma/abi";
import { collateralVaultAbi } from "@/lib/deposit/abi";
import {
  COLLATERAL_VAULT,
  USDCC_DECIMALS,
  USDCC_TOKEN,
} from "@/lib/deposit/config";
import { useDepositState } from "@/lib/deposit/useDepositState";
import { postDeposit } from "@/lib/profile/data";
import { MonoLabel } from "../landing/ui/MonoLabel";
import { TxButton } from "../terminal/oracle/TxButton";

/** Parse a user-typed amount to 6-dec base units; null when blank/invalid. */
function parseAmount(input: string): bigint | null {
  const clean = input.trim();
  if (clean === "" || !/^\d*\.?\d*$/.test(clean)) return null;
  try {
    const base = parseUnits(clean, USDCC_DECIMALS);
    return base > 0n ? base : null;
  } catch {
    return null;
  }
}

const fmt = (v: bigint) =>
  Number(formatUnits(v, USDCC_DECIMALS)).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });

/**
 * USDCC deposit. Standard users' VTK is minted to the treasury and the backend
 * credits their ledger; voters receive VTK in their own wallet. Two explicit
 * steps when allowance is short — approve, then deposit — never both at once.
 */
export function DepositModal({
  open,
  onClose,
  isVoter,
  onDeposited,
}: {
  open: boolean;
  onClose: () => void;
  /** VOTER / ORACLE_PARTICIPANT → VTK to wallet, no ledger credit. */
  isVoter: boolean;
  /** Fired once balances should be re-read (after a confirmed + synced deposit). */
  onDeposited: () => void;
}) {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const deposit = useDepositState();

  const [amount, setAmount] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const lastHash = useRef<`0x${string}` | null>(null);

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setAmount("");
      setSyncing(false);
      setSyncError(null);
      lastHash.current = null;
    }
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const amountBase = parseAmount(amount);
  const balance = deposit.usdccBalance;
  const allowance = deposit.allowance;
  // Standard flow: VTK minted to the vault (protocol custody, ledger credited).
  // Voter flow: VTK minted to their own wallet.
  const receiver = (isVoter ? address : COLLATERAL_VAULT) as `0x${string}`;

  const insufficient =
    amountBase != null && balance != null && amountBase > balance;
  const needsApproval =
    amountBase != null && allowance != null && amountBase > allowance;
  const canAct = amountBase != null && !insufficient && !!address;

  // Standard flow only: after the on-chain deposit confirms, report the hash so
  // the backend credits the ledger. The tx already succeeded and the call is
  // idempotent, so a failure here is a sync hiccup, never lost funds.
  async function syncCredit() {
    if (isVoter) {
      onDeposited();
      onClose();
      return;
    }
    const hash = lastHash.current;
    if (!hash) return;
    setSyncing(true);
    setSyncError(null);
    try {
      await postDeposit(hash);
      onDeposited();
      onClose();
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/50 transition-opacity duration-300 motion-reduce:transition-none ${open ? "opacity-100" : "opacity-0"}`}
      />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Deposit"
          className={`w-full max-w-md bg-surface border border-line flex flex-col transition-all duration-200 motion-reduce:transition-none ${open ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
        >
          <div className="flex items-center justify-between px-6 py-5 border-b border-line">
            <h2 className="font-pixel text-xl tracking-wide text-fg">
              {isVoter ? "ADD VTK" : "DEPOSIT"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-muted hover:text-fg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          <div className="px-6 py-6 flex flex-col gap-5">
            <p className="font-mono text-[11px] leading-relaxed text-muted">
              {isVoter
                ? "Deposit USDCC to receive VTK in your wallet — used to post oracle bonds."
                : "Deposit USDCC to fund your available balance for trading."}
            </p>

            <div>
              <label htmlFor="deposit-amount" className="block mb-2">
                <MonoLabel>amount // usdcc</MonoLabel>
              </label>
              <input
                id="deposit-amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                autoComplete="off"
                className={`w-full bg-transparent text-fg text-2xl tabular-nums py-2 border-b transition-colors placeholder:text-muted/30 focus-visible:outline-none ${insufficient ? "border-no" : "border-line focus:border-accent"}`}
              />
              <div className="mt-1.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-muted/60">
                <span>
                  balance {balance != null ? `${fmt(balance)} USDCC` : "…"}
                </span>
                {balance != null && (
                  <button
                    type="button"
                    onClick={() => setAmount(formatUnits(balance, USDCC_DECIMALS))}
                    className="text-accent hover:brightness-110 cursor-pointer"
                  >
                    max
                  </button>
                )}
              </div>
              {insufficient && (
                <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-no">
                  amount exceeds wallet balance
                </p>
              )}
            </div>

            {/* One action at a time: approve while allowance is short, else deposit.
                A one-time (max) approval so the user never re-approves USDCC. */}
            {needsApproval ? (
              <TxButton
                label="approve usdcc (one-time)"
                disabled={!canAct}
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
            ) : (
              <TxButton
                label={isVoter ? "deposit for vtk" : "deposit"}
                disabled={!canAct || syncing}
                send={async () => {
                  const hash = await writeContractAsync({
                    address: COLLATERAL_VAULT,
                    abi: collateralVaultAbi,
                    functionName: "deposit",
                    args: [amountBase!, receiver],
                  });
                  lastHash.current = hash;
                  return hash;
                }}
                onConfirmed={() => {
                  deposit.refetch();
                  void syncCredit();
                }}
              />
            )}

            {syncing && (
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
                deposit confirmed — syncing balance…
              </p>
            )}
            {syncError && (
              <div className="flex flex-col gap-1">
                <p className="font-mono text-[10px] uppercase tracking-widest text-no">
                  balance sync failed — funds are safe on-chain
                </p>
                <button
                  type="button"
                  onClick={() => void syncCredit()}
                  className="self-start font-mono text-[10px] uppercase tracking-widest text-accent underline hover:brightness-110 cursor-pointer"
                >
                  retry sync
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
