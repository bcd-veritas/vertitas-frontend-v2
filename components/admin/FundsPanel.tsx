"use client";

import { useQuery } from "@tanstack/react-query";

import { Frame } from "@/components/terminal/Frame";
import { getAdminFunds } from "@/lib/admin/data";

const EXPLORER = "https://sepolia.etherscan.io/address/";
const LOW_GAS_WEI = 50_000_000_000_000_000n; // 0.05 ETH

// Format a raw integer-string (base units) by decimals, with thousands separators.
function fmtUnits(raw: string | null, decimals: number, maxFrac = 2): string {
  if (raw == null) return "—";
  const neg = raw.startsWith("-");
  const digits = (neg ? raw.slice(1) : raw).padStart(decimals + 1, "0");
  const intPart = digits.slice(0, digits.length - decimals) || "0";
  const frac = digits.slice(digits.length - decimals).replace(/0+$/, "").slice(0, maxFrac);
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (neg ? "-" : "") + grouped + (frac ? "." + frac : "");
}

function short(a: string) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—";
}

function AddrLink({ address }: { address: string }) {
  if (!address) return <span className="font-mono text-[11px] text-muted">—</span>;
  return (
    <a
      href={`${EXPLORER}${address}`}
      target="_blank"
      rel="noreferrer"
      className="font-mono text-[11px] text-muted hover:text-fg hover:underline"
      title={address}
    >
      {short(address)}
    </a>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-t border-line/60 py-1.5">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted">{label}</span>
      <span className="font-mono text-sm tabular-nums text-fg">{value}</span>
    </div>
  );
}

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span className="border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider" style={{ color, borderColor: color }}>
      {text}
    </span>
  );
}

export function FundsPanel() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-funds"],
    queryFn: getAdminFunds,
    refetchInterval: 30_000,
  });

  if (isLoading) return <p className="font-mono text-xs text-muted">Loading funds…</p>;
  if (isError || !data) return <p className="font-mono text-xs text-muted">Funds unavailable (RPC?).</p>;

  const lowGas = data.operator.eth != null && BigInt(data.operator.eth) < LOW_GAS_WEI;
  const noReward = data.treasury.vtk === "0";

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Frame label="Operator" className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <AddrLink address={data.operator.address} />
          {lowGas ? <Badge text="low gas" color="#c97a6d" /> : null}
        </div>
        <Line label="ETH" value={fmtUnits(data.operator.eth, 18, 4)} />
        <Line label={`USDCC (≈ VTK mintable)`} value={fmtUnits(data.operator.usdcc, data.usdccDecimals)} />
        <Line label="VTK" value={fmtUnits(data.operator.vtk, data.vtkDecimals)} />
      </Frame>

      <Frame label="Treasury" className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <AddrLink address={data.treasury.address} />
          {noReward ? <Badge text="no reward funding" color="#a89f9c" /> : null}
        </div>
        <Line label="VTK" value={fmtUnits(data.treasury.vtk, data.vtkDecimals)} />
      </Frame>

      <Frame label="Collateral vault" className="p-4">
        <div className="mb-2">
          <AddrLink address={data.vault.address} />
        </div>
        <Line label="USDCC (backing)" value={fmtUnits(data.vault.usdcc, data.usdccDecimals)} />
      </Frame>

      <Frame label="Solvency" className="p-4">
        <div className="mb-2">
          {data.solvency.inSync ? (
            <Badge text="in sync ✓" color="#7fae8b" />
          ) : (
            <Badge text="mismatch ⚠" color="#c97a6d" />
          )}
        </div>
        <Line label="VTK supply" value={fmtUnits(data.solvency.vtkSupply, data.vtkDecimals)} />
        <Line label="Vault USDCC" value={fmtUnits(data.solvency.vaultUsdcc, data.usdccDecimals)} />
      </Frame>
    </div>
  );
}
