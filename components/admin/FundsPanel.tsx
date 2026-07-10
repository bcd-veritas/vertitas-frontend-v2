"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Frame } from "@/components/terminal/Frame";
import { depositFunds, getAdminFunds } from "@/lib/admin/data";

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

function short(a: string) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—";
}

function AddrLink({ address }: { address: string }) {
  if (!address) return <span className="font-mono text-[11px] text-muted">—</span>;
  return (
    <a href={`${EXPLORER}${address}`} target="_blank" rel="noreferrer" className="font-mono text-[11px] text-muted hover:text-fg hover:underline" title={address}>
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

function FundBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="cursor-pointer border border-line px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted hover:border-fg hover:text-fg">
      Fund
    </button>
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

  if (isLoading) return <p className="font-mono text-xs text-muted">Loading funds…</p>;
  if (isError || !data) return <p className="font-mono text-xs text-muted">Funds unavailable (RPC?).</p>;

  const lowGas = data.operator.eth != null && BigInt(data.operator.eth) < LOW_GAS_WEI;
  const noReward = data.treasury.vtk === "0";

  const validAmount = /^\d+$/.test(amount) && BigInt(amount || "0") > 0n;
  const exceedsReserve =
    validAmount &&
    data.operator.usdcc != null &&
    BigInt(amount) * 1_000_000n > BigInt(data.operator.usdcc);
  const canConfirm = validAmount && !exceedsReserve && !mutation.isPending;

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Frame label="Operator" className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <AddrLink address={data.operator.address} />
          <div className="flex items-center gap-2">
            {lowGas ? <Badge text="low gas" color="#c97a6d" /> : null}
            <FundBtn onClick={() => openFund("operator")} />
          </div>
        </div>
        <Line label="ETH" value={fmtUnits(data.operator.eth, 18, 4)} />
        <Line label={"USDCC (≈ VTK mintable)"} value={fmtUnits(data.operator.usdcc, data.usdccDecimals)} />
        <Line label="VTK" value={fmtUnits(data.operator.vtk, data.vtkDecimals)} />
      </Frame>

      <Frame label="Treasury" className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <AddrLink address={data.treasury.address} />
          <div className="flex items-center gap-2">
            {noReward ? <Badge text="no reward funding" color="#a89f9c" /> : null}
            <FundBtn onClick={() => openFund("treasury")} />
          </div>
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
          {data.solvency.inSync ? <Badge text="in sync ✓" color="#7fae8b" /> : <Badge text="mismatch ⚠" color="#c97a6d" />}
        </div>
        <Line label="VTK supply" value={fmtUnits(data.solvency.vtkSupply, data.vtkDecimals)} />
        <Line label="Vault USDCC" value={fmtUnits(data.solvency.vaultUsdcc, data.usdccDecimals)} />
      </Frame>

      {fundDest ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/70 p-4">
          <div className="w-full max-w-sm border border-line bg-surface p-5">
            <h2 className="font-mono text-xs uppercase tracking-wider text-fg">
              Fund {fundDest} with VTK
            </h2>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="Amount (whole VTK)"
              inputMode="numeric"
              className="mt-3 w-full border border-line bg-transparent px-3 py-1.5 font-mono text-sm text-fg placeholder:text-muted focus:border-fg focus:outline-none"
            />
            <p className="mt-3 font-mono text-[11px] leading-relaxed text-muted">
              Deposit <span className="text-fg">{amount || "0"}</span> USDCC → mint{" "}
              <span className="text-fg">{amount || "0"}</span> VTK to{" "}
              <span className="text-fg">{fundDest}</span>.
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
                className="cursor-pointer border border-line px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted hover:border-fg hover:text-fg disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={() => mutation.mutate({ amount, destination: fundDest })}
                disabled={!canConfirm}
                className="cursor-pointer border border-fg px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-fg hover:bg-fg hover:text-bg disabled:opacity-40"
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
