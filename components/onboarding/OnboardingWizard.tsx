"use client";

import { useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { formatUnits, maxUint256, parseUnits } from "viem";
import { useAccount, useWriteContract } from "wagmi";

import { erc20Abi } from "@/lib/uma/abi";
import { VTK_TOKEN } from "@/lib/uma/config";
import { collateralVaultAbi } from "@/lib/deposit/abi";
import {
  COLLATERAL_VAULT,
  EXCHANGE_CONTRACT,
  USDCC_DECIMALS,
  USDCC_TOKEN,
} from "@/lib/deposit/config";
import { useDepositState } from "@/lib/deposit/useDepositState";
import {
  enableTrading,
  postDeposit,
  updateUserIdentity,
  type UserIdentity,
} from "@/lib/profile/data";
import { MonoLabel } from "../landing/ui/MonoLabel";
import { TxButton } from "../terminal/oracle/TxButton";

const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,24}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const fmt = (v: bigint) =>
  Number(formatUnits(v, USDCC_DECIMALS)).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });

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

/** A step row: number/check indicator + title, expanded controls when active. */
function Step({
  index,
  title,
  hint,
  done,
  active,
  children,
}: {
  index: number;
  title: string;
  hint: string;
  done: boolean;
  active: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={`flex gap-3 ${active ? "" : "opacity-55"}`}>
      <div
        className={`mt-0.5 shrink-0 w-6 h-6 rounded-full border flex items-center justify-center font-mono text-[11px] ${
          done
            ? "bg-yes/15 border-yes text-yes"
            : active
              ? "border-accent text-accent"
              : "border-line text-muted"
        }`}
      >
        {done ? <Check size={13} aria-hidden="true" /> : index}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-mono text-[12px] uppercase tracking-[0.12em] text-fg">
          {title}
        </p>
        <p className="mt-0.5 font-mono text-[10px] tracking-[0.06em] text-muted/70">
          {hint}
        </p>
        {active && children && <div className="mt-3">{children}</div>}
      </div>
    </div>
  );
}

/**
 * New-user onboarding: profile → enable trading (fund + VTK approval) → approve
 * USDCC → deposit. Each step's completion is read live from on-chain state
 * (useDepositState), so the wizard resumes wherever the wallet left off.
 */
export function OnboardingWizard({
  open,
  onClose,
  identity,
  onIdentitySaved,
}: {
  open: boolean;
  onClose: () => void;
  identity: UserIdentity | null;
  onIdentitySaved?: (identity: UserIdentity) => void;
}) {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const deposit = useDepositState();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [profileAcked, setProfileAcked] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [fundingBusy, setFundingBusy] = useState(false);
  const [fundError, setFundError] = useState<string | null>(null);

  const [amount, setAmount] = useState("");
  const [depositing, setDepositing] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [deposited, setDeposited] = useState(false);
  const lastHash = useRef<`0x${string}` | null>(null);

  // Reset transient state each time the wizard opens; prefill from identity.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setUsername(identity?.username ?? "");
      setEmail(identity?.email ?? "");
      setProfileAcked(Boolean(identity?.email));
      setProfileError(null);
      setFundError(null);
      setAmount("");
      setDepositError(null);
      setDeposited(false);
    }
  }

  const trimmedUsername = username.trim();
  const trimmedEmail = email.trim();
  const usernameInvalid = trimmedUsername !== "" && !USERNAME_RE.test(trimmedUsername);
  const emailInvalid = trimmedEmail !== "" && !EMAIL_RE.test(trimmedEmail);

  // Live on-chain completion signals.
  const funded = deposit.usdccBalance != null && deposit.usdccBalance > 0n;
  const vtkApproved =
    deposit.vtkAllowanceToExchange != null && deposit.vtkAllowanceToExchange > 0n;
  const usdccApproved = deposit.allowance != null && deposit.allowance > 0n;

  const s1done = profileAcked;
  const s2done = funded && vtkApproved;
  const s3done = usdccApproved;
  const s4done = deposited;

  const activeStep = !s1done ? 1 : !s2done ? 2 : !s3done ? 3 : !s4done ? 4 : 5;

  async function saveProfile() {
    if (!address || usernameInvalid || emailInvalid) return;
    setSavingProfile(true);
    setProfileError(null);
    try {
      const saved = await updateUserIdentity(address, {
        username: trimmedUsername === "" ? null : trimmedUsername,
        email: trimmedEmail === "" ? null : trimmedEmail,
      });
      onIdentitySaved?.(saved);
      setProfileAcked(true);
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingProfile(false);
    }
  }

  async function fund() {
    if (!address) return;
    setFundingBusy(true);
    setFundError(null);
    try {
      await enableTrading(address);
      deposit.refetch();
    } catch (e) {
      setFundError(e instanceof Error ? e.message : String(e));
    } finally {
      setFundingBusy(false);
    }
  }

  const amountBase = parseAmount(amount);
  const balance = deposit.usdccBalance;
  const insufficient = amountBase != null && balance != null && amountBase > balance;
  const canDeposit = amountBase != null && !insufficient && !!address && !depositing;

  async function depositAndSync() {
    const hash = lastHash.current;
    if (!hash) return;
    setDepositing(true);
    setDepositError(null);
    try {
      await postDeposit(hash);
      setDeposited(true);
      deposit.refetch();
    } catch (e) {
      setDepositError(e instanceof Error ? e.message : String(e));
    } finally {
      setDepositing(false);
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
          aria-label="Get started"
          className={`w-full max-w-md bg-surface border border-line flex flex-col max-h-[90vh] transition-all duration-200 motion-reduce:transition-none ${open ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
        >
          <div className="flex items-center justify-between px-6 py-5 border-b border-line">
            <h2 className="font-pixel text-xl tracking-wide text-fg">GET STARTED</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-muted hover:text-fg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          <div className="px-6 py-6 flex flex-col gap-6 overflow-y-auto">
            {/* 1 — Profile */}
            <Step
              index={1}
              title="Your profile"
              hint="Pick a handle and email (optional)."
              done={s1done}
              active={activeStep === 1}
            >
              <div className="flex flex-col gap-3">
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="username"
                  autoComplete="off"
                  spellCheck={false}
                  className={`w-full bg-transparent text-fg text-sm py-2 border-b transition-colors placeholder:text-muted/40 focus-visible:outline-none ${usernameInvalid ? "border-no" : "border-line focus:border-accent"}`}
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@domain.com"
                  autoComplete="off"
                  spellCheck={false}
                  className={`w-full bg-transparent text-fg text-sm py-2 border-b transition-colors placeholder:text-muted/40 focus-visible:outline-none ${emailInvalid ? "border-no" : "border-line focus:border-accent"}`}
                />
                {emailInvalid && (
                  <p className="font-mono text-[10px] uppercase tracking-widest text-no">
                    invalid email address
                  </p>
                )}
                {profileError && (
                  <p className="font-mono text-[10px] text-no">{profileError}</p>
                )}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={saveProfile}
                    disabled={savingProfile || usernameInvalid || emailInvalid}
                    className="pill pill-solid py-2! px-5! font-mono text-[11px] uppercase tracking-[0.14em] disabled:opacity-40"
                  >
                    {savingProfile ? "saving…" : "save & continue"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setProfileAcked(true)}
                    className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted hover:text-fg cursor-pointer"
                  >
                    skip
                  </button>
                </div>
              </div>
            </Step>

            {/* 2 — Enable trading: fund USDCC + approve VTK→Exchange */}
            <Step
              index={2}
              title="Enable trading"
              hint="Get test USDCC, then let settlement use your VTK."
              done={s2done}
              active={activeStep === 2}
            >
              <div className="flex flex-col gap-3">
                {!funded ? (
                  <>
                    <button
                      type="button"
                      onClick={fund}
                      disabled={fundingBusy}
                      className="pill pill-solid py-2! px-5! self-start font-mono text-[11px] uppercase tracking-[0.14em] disabled:opacity-40"
                    >
                      {fundingBusy ? "funding…" : "get 5,000 usdcc"}
                    </button>
                    {fundError && (
                      <p className="font-mono text-[10px] text-no">{fundError}</p>
                    )}
                  </>
                ) : (
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted/70">
                    funded · {balance != null ? `${fmt(balance)} usdcc` : "…"}
                  </p>
                )}

                {funded && !vtkApproved && (
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
            </Step>

            {/* 3 — Approve USDCC → Vault */}
            <Step
              index={3}
              title="Approve USDCC"
              hint="One-time approval so the vault can convert it to VTK."
              done={s3done}
              active={activeStep === 3}
            >
              <TxButton
                label="approve usdcc (one-time)"
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
            </Step>

            {/* 4 — Deposit */}
            <Step
              index={4}
              title="Fund your account"
              hint="Deposit USDCC to receive VTK collateral."
              done={s4done}
              active={activeStep === 4}
            >
              <div className="flex flex-col gap-3">
                <div>
                  <input
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    autoComplete="off"
                    className={`w-full bg-transparent text-fg text-xl tabular-nums py-1.5 border-b transition-colors placeholder:text-muted/30 focus-visible:outline-none ${insufficient ? "border-no" : "border-line focus:border-accent"}`}
                  />
                  <div className="mt-1.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-muted/60">
                    <span>balance {balance != null ? `${fmt(balance)} usdcc` : "…"}</span>
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
                <TxButton
                  label="deposit"
                  disabled={!canDeposit}
                  send={async () => {
                    const hash = await writeContractAsync({
                      address: COLLATERAL_VAULT,
                      abi: collateralVaultAbi,
                      functionName: "deposit",
                      args: [amountBase!, address as `0x${string}`],
                    });
                    lastHash.current = hash;
                    return hash;
                  }}
                  onConfirmed={() => void depositAndSync()}
                />
                {depositing && (
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
                    deposit confirmed — syncing balance…
                  </p>
                )}
                {depositError && (
                  <p className="font-mono text-[10px] text-no">{depositError}</p>
                )}
              </div>
            </Step>
          </div>

          <div className="px-6 py-4 border-t border-line">
            {activeStep === 5 ? (
              <button
                type="button"
                onClick={onClose}
                className="pill pill-solid w-full py-2.5! font-mono text-[11px] uppercase tracking-[0.14em]"
              >
                start trading
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="w-full font-mono text-[10px] uppercase tracking-[0.14em] text-muted/60 hover:text-fg cursor-pointer"
              >
                finish later
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
