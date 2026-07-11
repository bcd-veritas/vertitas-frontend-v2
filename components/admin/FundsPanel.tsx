"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Frame } from "@/components/terminal/Frame";
import { depositFunds, getAdminFunds } from "@/lib/admin/data";
import { Identicon } from "./Identicon";
import { AMBER, BLUE } from "./statusMeta";

const EXPLORER = "https://sepolia.etherscan.io/address/";
const LOW_GAS_WEI = 50_000_000_000_000_000n; // 0.05 ETH

type Dest = "operator" | "treasury";

function fmtUnits(raw: string | null, decimals: number, maxFrac = 2): string {
  if (raw == null) return "—";
  const neg = raw.startsWith("-");
  const digits = (neg ? raw.slice(1) : raw).padStart(decimals + 1, "0");
  const intPart = digits.slice(0, digits.length - decimals) || "0";
  const frac = digits.slice(digits.length - decimals).replace(/0+$/, "").slice(0, maxFrac);
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (neg ? "-" : "") + grouped + (frac ? "." + frac : "");
}

function AddrLink({ address }: { address: string }) {
  if (!address) return <span className="font-mono text-sm text-muted">—</span>;
  return (
    <a
      href={`${EXPLORER}${address}`}
      target="_blank"
      rel="noreferrer"
      className="break-all font-mono text-sm text-fg/80 hover:text-fg hover:underline"
    >
      {address}
    </a>
  );
}

/** Consistent asset colors: collateral green, platform token amber, gas blue. */
const TOKEN_COLOR: Record<string, string> = {
  USDCC: "#7fae8b",
  VTK: AMBER,
  ETH: BLUE,
  "SEPOLIA ETH": BLUE,
};

/** Renders text with known token names (USDCC / VTK / Sepolia ETH) tinted. */
function Tokens({ text }: { text: string }) {
  const parts = text.split(/(\bSepolia ETH\b|\bUSDCC\b|\bVTK\b|\bETH\b)/gi);
  return (
    <>
      {parts.map((p, i) => {
        const color = TOKEN_COLOR[p.toUpperCase()];
        return color ? (
          <span key={i} style={{ color }}>
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        );
      })}
    </>
  );
}

function Line({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between border-t border-line/60 py-2">
      <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
        <Tokens text={label} />
      </span>
      <span className={`font-mono text-base tabular-nums ${warn ? "text-no" : "text-fg"}`}>{value}</span>
    </div>
  );
}

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span
      className="border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider"
      style={{ color, borderColor: color }}
    >
      {text}
    </span>
  );
}

/** Profile-style account card for the horizontal rail. */
function AccountCard({
  title,
  color,
  address,
  role,
  badge,
  primaryLabel,
  primaryValue,
  lines,
  action,
  dim,
  delay = 0,
}: {
  title: string;
  color: string;
  address: string;
  role: string;
  badge?: { text: string; color: string } | null;
  primaryLabel: string;
  primaryValue: string;
  lines?: { label: string; value: string; warn?: boolean }[];
  action?: { label: string; onClick: () => void } | null;
  dim?: boolean;
  delay?: number;
}) {
  return (
    <div
      className={`reveal-rise ${dim ? "opacity-70" : ""}`}
      style={{ animationDelay: `${delay}ms`, "--card": color } as React.CSSProperties}
    >
      <Frame
        label={title}
        tickColor={color}
        className="flex h-full flex-col p-5"
        right={badge ? <Badge text={badge.text} color={badge.color} /> : null}
      >
        <div className="flex items-center gap-4">
          <Identicon seed={address || title} color={color} />
          <div className="min-w-0">
            <AddrLink address={address} />
            <p className="mt-1 font-mono text-[11px] leading-relaxed text-muted">
              <Tokens text={role} />
            </p>
          </div>
        </div>

        <div className="mt-5">
          <div className="font-mono text-[14px] uppercase tracking-[0.18em] text-muted">
            <Tokens text={primaryLabel} />
          </div>
          <div className="mt-1.5 font-pixel text-5xl leading-none tabular-nums text-fg">
            {primaryValue}
          </div>
        </div>

        <div className="mt-4 flex-1">
          {lines?.map((l) => <Line key={l.label} {...l} />)}
        </div>

        {action ? (
          <button
            onClick={action.onClick}
            className="mt-5 w-full border px-4 py-3 font-mono text-xs uppercase tracking-[0.18em] transition-colors active:translate-y-px border-(--card) text-(--card) bg-[color-mix(in_srgb,var(--card)_8%,transparent)] hover:bg-[color-mix(in_srgb,var(--card)_22%,transparent)]"
          >
            {action.label}
          </button>
        ) : (
          <div className="mt-5 border border-line/60 px-4 py-3 text-center font-mono text-xs uppercase tracking-[0.18em] text-muted">
            {dim ? "Coming soon" : "Auto-managed by protocol"}
          </div>
        )}
      </Frame>
    </div>
  );
}

export function FundsPanel() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-funds"],
    queryFn: getAdminFunds,
    refetchInterval: 30_000,
  });

  const [fundDest, setFundDest] = useState<Dest | null>(null);
  const [amount, setAmount] = useState("");

  const mutation = useMutation({
    mutationFn: (vars: { amount: string; destination: Dest }) =>
      depositFunds(vars.amount, vars.destination),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["admin-funds"] });
      // Only close on a fully-successful deposit; keep the modal open on "failed"
      // so the admin sees the partial/error result.
      if (result.status === "done") {
        setFundDest(null);
        setAmount("");
      }
    },
  });

  const openFund = (dest: Dest) => {
    setAmount("");
    mutation.reset();
    setFundDest(dest);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5">
        <div className="h-32 animate-pulse border border-line bg-fg/5" />
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-80 animate-pulse border border-line bg-fg/5" />
          ))}
        </div>
      </div>
    );
  }
  if (isError || !data) {
    return <p className="font-mono text-xs text-muted">Funds unavailable (RPC?).</p>;
  }

  const lowGas = data.operator.eth != null && BigInt(data.operator.eth) < LOW_GAS_WEI;
  const noReward = data.treasury.vtk === "0";
  const inSync = data.solvency.inSync;

  const validAmount = /^\d+$/.test(amount) && BigInt(amount || "0") > 0n;
  const exceedsReserve =
    validAmount &&
    data.operator.usdcc != null &&
    BigInt(amount) * 1_000_000n > BigInt(data.operator.usdcc);
  const canConfirm = validAmount && !exceedsReserve && !mutation.isPending;

  return (
    <div className="flex flex-col gap-5">
      {/* Solvency — the invariant the whole system hangs on, stated as an equation */}
      <Frame
        label="Solvency"
        className="reveal-rise p-4"
        right={
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider" style={{ color: inSync ? "var(--color-yes)" : "var(--color-no)" }}>
            <span
              className={`h-1.5 w-1.5 rounded-full ${inSync ? "pulse-dot bg-yes" : "bg-no"}`}
              aria-hidden="true"
            />
            {inSync ? "In sync" : "Mismatch"}
          </span>
        }
      >
        <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
              <Tokens text="VTK total supply" />
            </div>
            <div className="mt-1 font-pixel text-4xl leading-none tabular-nums text-fg">
              {fmtUnits(data.solvency.vtkSupply, data.vtkDecimals)}
            </div>
          </div>
          <div
            className="text-center font-pixel text-5xl leading-none"
            style={{ color: inSync ? "var(--color-yes)" : "var(--color-no)" }}
            aria-label={inSync ? "equals" : "does not equal"}
          >
            {inSync ? "=" : "≠"}
          </div>
          <div className="sm:text-right">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
              <Tokens text="Vault USDCC backing" />
            </div>
            <div className="mt-1 font-pixel text-4xl leading-none tabular-nums text-fg">
              {fmtUnits(data.solvency.vaultUsdcc, data.usdccDecimals)}
            </div>
          </div>
        </div>
        <p className="mt-3 border-t border-line/60 pt-2 font-mono text-[10px] leading-relaxed text-muted">
          <Tokens text="Every VTK is minted against USDCC held in the collateral vault — supply and backing must match 1:1." />
        </p>
      </Frame>

      {/* Account grid */}
      <div className="reveal-rise" style={{ animationDelay: "120ms" }}>
        <div className="mb-4 flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            Accounts
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <AccountCard
            title="Operator"
            color={BLUE}
            address={data.operator.address}
            role="Hot wallet — pays gas, holds the USDCC mint reserve"
            badge={lowGas ? { text: "low gas", color: "#c97a6d" } : null}
            primaryLabel="USDCC"
            primaryValue={fmtUnits(data.operator.usdcc, data.usdccDecimals)}
            lines={[
              { label: "Sepolia ETH (gas)", value: fmtUnits(data.operator.eth, 18, 4), warn: lowGas },
              { label: "VTK", value: fmtUnits(data.operator.vtk, data.vtkDecimals) },
            ]}
            action={{ label: "Fund operator", onClick: () => openFund("operator") }}
            delay={0}
          />
          <AccountCard
            title="Treasury"
            color={AMBER}
            address={data.treasury.address}
            role="Reward pool — funds resolution and voter rewards"
            badge={noReward ? { text: "no reward funding", color: "#a89f9c" } : null}
            primaryLabel="VTK"
            primaryValue={fmtUnits(data.treasury.vtk, data.vtkDecimals)}
            action={{ label: "Fund treasury", onClick: () => openFund("treasury") }}
            delay={70}
          />
          <AccountCard
            title="Collateral vault"
            color="#7fae8b"
            address={data.vault.address}
            role="Holds the USDCC that backs every VTK 1:1 — minted on deposit, released on redeem"
            primaryLabel="USDCC"
            primaryValue={fmtUnits(data.vault.usdcc, data.usdccDecimals)}
            delay={140}
          />
          <AccountCard
            title="Relayers"
            color="#a89f9c"
            address=""
            role="Relayer balances, low-gas alerts and funding via ProtocolAdmin.fundRelayer"
            badge={{ text: "coming soon", color: "#a89f9c" }}
            primaryLabel="Relayer balance"
            primaryValue="—"
            dim
            delay={210}
          />
        </div>
      </div>

      {fundDest ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/70 p-4">
          <div className="w-full max-w-sm border border-line bg-surface p-5">
            <h2 className="font-mono text-xs uppercase tracking-wider text-fg">
              Fund {fundDest} with <Tokens text="VTK" />
            </h2>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="Amount (whole VTK)"
              inputMode="numeric"
              className="mt-3 w-full border border-line bg-transparent px-3 py-2 font-mono text-sm text-fg placeholder:text-muted focus:border-fg focus:outline-none"
            />
            <p className="mt-3 font-mono text-[11px] leading-relaxed text-muted">
              Deposit <span className="text-fg">{amount || "0"}</span> <Tokens text="USDCC" /> → mint{" "}
              <span className="text-fg">{amount || "0"}</span> <Tokens text="VTK" /> to{" "}
              <span className="text-fg">{fundDest}</span>.
            </p>
            <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-muted">
              <Tokens text="USDCC is deducted from the operator EOA." />
            </p>
            {exceedsReserve ? (
              <p className="mt-2 font-mono text-[11px] text-no">Exceeds operator USDCC.</p>
            ) : null}
            {mutation.isError ? (
              <p className="mt-2 font-mono text-[11px] text-no">{(mutation.error as Error).message}</p>
            ) : null}
            {mutation.data?.status === "failed" ? (
              <p className="mt-2 font-mono text-[11px] text-no">On-chain failed: {mutation.data.error}</p>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => {
                  mutation.reset();
                  setFundDest(null);
                }}
                disabled={mutation.isPending}
                className="border border-line px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:border-fg hover:text-fg disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={() => mutation.mutate({ amount, destination: fundDest })}
                disabled={!canConfirm}
                className={`border border-fg bg-fg px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-85 disabled:opacity-40 ${mutation.isPending ? "cta-busy relative overflow-hidden" : ""
                  }`}
              >
                {mutation.isPending ? "Funding…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
