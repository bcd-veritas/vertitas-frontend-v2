"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { formatUnits, maxUint256, parseUnits } from "viem";
import { useAccount, useWriteContract } from "wagmi";

import { erc20Abi } from "@/lib/uma/abi";
import { collateralVaultAbi } from "@/lib/deposit/abi";
import { COLLATERAL_VAULT, USDCC_DECIMALS, USDCC_TOKEN } from "@/lib/deposit/config";
import { useDepositState } from "@/lib/deposit/useDepositState";
import { collateralQueryKey, postDeposit } from "@/lib/profile/data";
import { MonoLabel } from "../landing/ui/MonoLabel";
import { TxButton } from "../terminal/oracle/TxButton";
import { ModalBody, ModalFooter } from "./ModalShell";

export const DEPOSIT_TITLE = "DEPOSIT";
export const DEPOSIT_SUBTITLE =
  "Deposit USDCC to fund your available balance for trading.";

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
 * Step 3 — deposit. USDCC goes into the vault and VTK is minted to the user's
 * own wallet; the backend then mirrors the ledger balance to it. The approve
 * branch normally never fires here (step 2 grants a max allowance) — it stays
 * as a fallback for a wallet that revoked it externally.
 */
export function DepositStep({
  onDeposited,
  onClose,
  onBusyChange,
}: {
  /** Fired once balances should be re-read (after a confirmed + synced deposit). */
  onDeposited: () => void;
  onClose: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const deposit = useDepositState();
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const lastHash = useRef<`0x${string}` | null>(null);

  useEffect(() => {
    onBusyChange?.(syncing);
  }, [syncing, onBusyChange]);

  const amountBase = parseAmount(amount);
  const balance = deposit.usdccBalance;
  const allowance = deposit.allowance;
  // New model: VTK is minted to the user's OWN wallet for everyone (self-custody).
  // The backend then mirrors the ledger's available balance to the wallet's VTK.
  const receiver = address as `0x${string}`;

  const insufficient = amountBase != null && balance != null && amountBase > balance;
  const needsApproval =
    amountBase != null && allowance != null && amountBase > allowance;
  const canAct = amountBase != null && !insufficient && !!address;

  // After the on-chain deposit confirms, report the hash so the backend syncs the
  // ledger's available balance to the wallet's on-chain VTK. The tx already
  // succeeded and the call is idempotent, so a failure here is a sync hiccup,
  // never lost funds.
  async function syncCredit() {
    const hash = lastHash.current;
    if (!hash) return;
    setSyncing(true);
    setSyncError(null);
    try {
      await postDeposit(hash);
      // postDeposit resolves only after the backend has re-synced the ledger,
      // so invalidating now makes the topbar readout refetch fresh numbers.
      void queryClient.invalidateQueries({ queryKey: collateralQueryKey(address) });
      onDeposited();
      onClose();
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncing(false);
    }
  }

  return (
    <>
      <ModalBody>
        <div>
          <label htmlFor="deposit-amount" className="mb-2 block">
            <MonoLabel>amount // usdcc</MonoLabel>
          </label>
          <input
            id="deposit-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            autoComplete="off"
            className={`w-full border-b bg-transparent py-2 text-2xl tabular-nums text-fg transition-colors placeholder:text-muted/30 focus-visible:outline-none ${insufficient ? "border-no" : "border-line focus:border-accent"}`}
          />
          <div className="mt-1.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-muted/60">
            <span>balance {balance != null ? `${fmt(balance)} USDCC` : "…"}</span>
            {balance != null && (
              <button
                type="button"
                onClick={() => setAmount(formatUnits(balance, USDCC_DECIMALS))}
                className="cursor-pointer text-accent hover:brightness-110"
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
              className="cursor-pointer self-start font-mono text-[10px] uppercase tracking-widest text-accent underline hover:brightness-110"
            >
              retry sync
            </button>
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        {/* One action at a time: approve while allowance is short, else deposit. */}
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
            label="deposit"
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
      </ModalFooter>
    </>
  );
}
