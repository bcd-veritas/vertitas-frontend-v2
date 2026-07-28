"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
import { useDepositState, type DepositState } from "@/lib/deposit/useDepositState";
import { getCollateralDollars, postDeposit, postWithdrawal } from "@/lib/profile/data";
import { MonoLabel } from "../landing/ui/MonoLabel";
import { TxButton } from "../terminal/oracle/TxButton";

type Tab = "deposit" | "withdraw";

/** USDCC and VTK are both 6-dec on-chain and the vault swaps them 1:1, so one
 *  parser/formatter serves both tabs. Null when blank/invalid/non-positive. */
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
 * Combined funds modal for the topbar: wallet balance strip (on-chain USDCC +
 * VTK) over Deposit / Withdraw tabs. The onboarding wizard keeps its own
 * single-purpose DepositModal — this is the standalone manage-funds surface.
 * Both tabs share one useDepositState so the strip and each form read the same
 * live balances.
 */
export function WalletModal({
  open,
  onClose,
  isVoter,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  /** VOTER / ORACLE_PARTICIPANT → deposit copy leans on oracle bonds. */
  isVoter: boolean;
  /** Fired after a confirmed + synced deposit or withdrawal — refresh balances. */
  onChanged: () => void;
}) {
  const deposit = useDepositState();
  const [tab, setTab] = useState<Tab>("deposit");

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setTab("deposit");
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Portal to <body>. The topbar header carries `backdrop-blur` (a
  // backdrop-filter), which makes it the containing block for any
  // position:fixed descendant — so rendered in place this modal's
  // `fixed inset-0` filled only the ~56px header and its top clipped off
  // screen. Portaling escapes that containing block so `fixed` is relative to
  // the viewport again. `mounted` guards SSR (no document during prerender).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return createPortal(
    <div className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/50 transition-opacity duration-300 motion-reduce:transition-none ${open ? "opacity-100" : "opacity-0"}`}
      />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Wallet"
          className={`w-full max-w-md max-h-[90dvh] overflow-y-auto bg-surface border border-line flex flex-col transition-all duration-200 motion-reduce:transition-none ${open ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
        >
          <div className="flex items-center justify-between px-6 py-5 border-b border-line">
            <h2 className="font-pixel text-xl tracking-wide text-fg">WALLET</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-muted hover:text-fg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          {/* Wallet balance strip — on-chain (matches MetaMask), NOT the ledger
              available/locked shown in the topbar. */}
          <div className="grid grid-cols-2 gap-px bg-line border-b border-line">
            <div className="bg-surface px-6 py-3">
              <MonoLabel className="text-[9px]! tracking-[0.16em]">in wallet // usdcc</MonoLabel>
              <p className="mt-1 font-mono text-base tabular-nums text-fg">
                {deposit.usdccBalance != null ? fmt(deposit.usdccBalance) : "…"}
              </p>
            </div>
            <div className="bg-surface px-6 py-3">
              <MonoLabel className="text-[9px]! tracking-[0.16em]">in wallet // vtk</MonoLabel>
              <p className="mt-1 font-mono text-base tabular-nums text-accent">
                {deposit.vtkBalance != null ? fmt(deposit.vtkBalance) : "…"}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-line" role="tablist">
            {(["deposit", "withdraw"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`flex-1 py-3 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors cursor-pointer ${
                  tab === t ? "bg-accent text-bg" : "text-muted hover:text-fg"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === "deposit" ? (
            <DepositTab
              deposit={deposit}
              isVoter={isVoter}
              onClose={onClose}
              onChanged={onChanged}
            />
          ) : (
            <WithdrawTab deposit={deposit} onClose={onClose} onChanged={onChanged} />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * USDCC → VTK. Two explicit steps when allowance is short (approve, then
 * deposit), then a backend sync so the ledger's available balance mirrors the
 * wallet's new VTK. Mirrors the onboarding DepositModal, kept independent so
 * that proven flow is never touched.
 */
function DepositTab({
  deposit,
  isVoter,
  onClose,
  onChanged,
}: {
  deposit: DepositState;
  isVoter: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const [amount, setAmount] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const lastHash = useRef<`0x${string}` | null>(null);

  const amountBase = parseAmount(amount);
  const balance = deposit.usdccBalance;
  const allowance = deposit.allowance;
  const receiver = address as `0x${string}`;

  const insufficient = amountBase != null && balance != null && amountBase > balance;
  const needsApproval =
    amountBase != null && allowance != null && amountBase > allowance;
  const canAct = amountBase != null && !insufficient && !!address;

  async function syncCredit() {
    const hash = lastHash.current;
    if (!hash) return;
    setSyncing(true);
    setSyncError(null);
    try {
      await postDeposit(hash);
      onChanged();
      onClose();
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncing(false);
    }
  }

  return (
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
          <span>balance {balance != null ? `${fmt(balance)} USDCC` : "…"}</span>
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
  );
}

/**
 * VTK → USDCC. A single redeem() call (no approval — the vault is VTK's minter
 * and burns directly), then a backend sync so the ledger drops to the wallet's
 * now-lower VTK. The withdrawable cap is the AVAILABLE (unlocked) ledger
 * balance, never the raw wallet VTK: locked VTK backs resting orders / oracle
 * bonds and the Exchange still COLLECTs it at settlement, so pulling it would
 * break settlement.
 */
function WithdrawTab({
  deposit,
  onClose,
  onChanged,
}: {
  deposit: DepositState;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const [amount, setAmount] = useState("");
  const [ledger, setLedger] = useState<{ available: number; locked: number } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const lastHash = useRef<`0x${string}` | null>(null);

  // The unlocked ledger balance is the withdrawable cap. Re-read whenever the
  // wallet changes; the modal remounts this tab on open so it's always fresh.
  useEffect(() => {
    let alive = true;
    if (!address) {
      Promise.resolve().then(() => alive && setLedger(null));
      return () => {
        alive = false;
      };
    }
    getCollateralDollars(address).then((c) => alive && setLedger(c));
    return () => {
      alive = false;
    };
  }, [address]);

  const amountBase = parseAmount(amount);
  const walletVtk = deposit.vtkBalance;
  // available dollars → VTK base units (1:1, 6-dec). Rounded down to a whole
  // base unit so we never offer a fraction the contract can't burn.
  const availableBase =
    ledger != null ? BigInt(Math.floor(ledger.available * 1e6)) : null;
  // Contract can't burn more than the wallet holds; the ledger cap is the
  // tighter, order-protecting bound. The withdrawable max is the lesser.
  const maxBase =
    availableBase != null && walletVtk != null
      ? availableBase < walletVtk
        ? availableBase
        : walletVtk
      : null;

  const overWallet = amountBase != null && walletVtk != null && amountBase > walletVtk;
  const overAvailable =
    amountBase != null && maxBase != null && amountBase > maxBase && !overWallet;
  const invalid = overWallet || overAvailable;
  const canAct = amountBase != null && !invalid && !!address && maxBase != null;

  const lockedBase =
    ledger != null && ledger.locked > 0 ? BigInt(Math.floor(ledger.locked * 1e6)) : 0n;

  async function syncWithdrawal() {
    const hash = lastHash.current;
    if (!hash) return;
    setSyncing(true);
    setSyncError(null);
    try {
      await postWithdrawal(hash);
      onChanged();
      onClose();
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="px-6 py-6 flex flex-col gap-5">
      <p className="font-mono text-[11px] leading-relaxed text-muted">
        Withdraw VTK back to USDCC in your wallet, 1:1. Funds locked in open
        orders stay put.
      </p>

      <div>
        <label htmlFor="withdraw-amount" className="block mb-2">
          <MonoLabel>amount // vtk</MonoLabel>
        </label>
        <input
          id="withdraw-amount"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          autoComplete="off"
          className={`w-full bg-transparent text-fg text-2xl tabular-nums py-2 border-b transition-colors placeholder:text-muted/30 focus-visible:outline-none ${invalid ? "border-no" : "border-line focus:border-accent"}`}
        />
        <div className="mt-1.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-muted/60">
          <span>
            withdrawable {maxBase != null ? `${fmt(maxBase)} VTK` : "…"}
          </span>
          {maxBase != null && maxBase > 0n && (
            <button
              type="button"
              onClick={() => setAmount(formatUnits(maxBase, USDCC_DECIMALS))}
              className="text-accent hover:brightness-110 cursor-pointer"
            >
              max
            </button>
          )}
        </div>
        {lockedBase > 0n && (
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted/50">
            {fmt(lockedBase)} locked in orders — not withdrawable
          </p>
        )}
        {overWallet && (
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-no">
            amount exceeds wallet VTK
          </p>
        )}
        {overAvailable && (
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-no">
            amount exceeds withdrawable balance
          </p>
        )}
      </div>

      {amountBase != null && !invalid && (
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted">
          <span>you receive</span>
          <span className="text-fg text-xs tabular-nums normal-case tracking-normal">
            {fmt(amountBase)} USDCC
          </span>
        </div>
      )}

      <TxButton
        label="withdraw"
        disabled={!canAct || syncing}
        send={async () => {
          const hash = await writeContractAsync({
            address: COLLATERAL_VAULT,
            abi: collateralVaultAbi,
            functionName: "redeem",
            args: [amountBase!, address as `0x${string}`],
          });
          lastHash.current = hash;
          return hash;
        }}
        onConfirmed={() => {
          deposit.refetch();
          void syncWithdrawal();
        }}
      />

      {syncing && (
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
          withdrawal confirmed — syncing balance…
        </p>
      )}
      {syncError && (
        <div className="flex flex-col gap-1">
          <p className="font-mono text-[10px] uppercase tracking-widest text-no">
            balance sync failed — funds are safe in your wallet
          </p>
          <button
            type="button"
            onClick={() => void syncWithdrawal()}
            className="self-start font-mono text-[10px] uppercase tracking-widest text-accent underline hover:brightness-110 cursor-pointer"
          >
            retry sync
          </button>
        </div>
      )}
    </div>
  );
}
