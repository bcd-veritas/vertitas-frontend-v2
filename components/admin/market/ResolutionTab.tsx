"use client";

import { useEffect, useRef, useState } from "react";
import { Frame } from "@/components/terminal/Frame";
import type { MarketResolution } from "@/lib/markets/types";
import { getMarketResolution } from "@/lib/markets/data";

/** Admin control: pick the outcome for an ENDED admin-resolved market.
 *  Submission → operator tx → the cron finalizes+pays within ~a minute. */
export function ResolutionTab({
  marketId,
  resolverType,
  outcomes,
}: {
  marketId: string;
  resolverType: string;
  outcomes: { index: number; label: string }[];
}) {
  const [data, setData] = useState<MarketResolution | null>(null);
  const [phase, setPhase] = useState<"idle" | "submitting" | "submitted" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  // Outcome index awaiting confirmation — an on-chain, irreversible resolve
  // must not fire on a single accidental click.
  const [pending, setPending] = useState<number | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const load = () => getMarketResolution(marketId).then((d) => alive && setData(d));
    load();
    const t = setInterval(load, 15_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [marketId, phase]);

  const submit = async (outcome: number) => {
    setPhase("submitting");
    setError(null);
    try {
      const res = await fetch(`/api/admin/markets/${marketId}/resolve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ outcome }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? `HTTP ${res.status}`);
      }
      if (mounted.current) setPhase("submitted");
    } catch (e) {
      if (mounted.current) {
        setError(e instanceof Error ? e.message : String(e));
        setPhase("error");
      }
    }
  };

  const r = data?.resolution;
  const canSubmit =
    data?.status === "ENDED" &&
    resolverType === "ADMIN" &&
    !r?.resolvedAt &&
    phase !== "submitting" &&
    phase !== "submitted";

  const pendingLabel =
    pending == null ? "" : outcomes.find((o) => o.index === pending)?.label ?? "";

  return (
    <>
      <Frame label="Resolution" className="p-5">
        <div className="flex flex-col gap-4 font-mono text-[12px]">
          <div className="grid grid-cols-2 gap-2 max-w-md uppercase tracking-[0.1em] text-muted">
            <span>status</span>
            <span className="text-fg/85">{data?.status ?? "—"}</span>
            <span>outcome</span>
            <span className="text-fg/85">{r?.winningLabel ?? "—"}</span>
            <span>resolved_at</span>
            <span className="tabular-nums text-fg/85">{r?.resolvedAt?.slice(0, 16) ?? "—"}</span>
            <span>disputed</span>
            <span className="text-fg/85">{r?.disputed ? "yes" : "no"}</span>
          </div>

          {phase === "submitted" && !r?.resolvedAt && (
            <p className="text-muted uppercase tracking-[0.1em]">
              outcome submitted — resolving on the next sweep (≤60s)…
            </p>
          )}
          {error && <p className="text-no">{error}</p>}

          {canSubmit && (
            <div className="flex items-center gap-2">
              <span className="uppercase tracking-[0.1em] text-muted">resolve as:</span>
              {outcomes.map((o) => (
                <button
                  key={o.index}
                  onClick={() => setPending(o.index)}
                  className="px-3 py-1.5 border border-line uppercase tracking-[0.14em] hover:border-fg/40 transition-colors"
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
          {data?.status === "ACTIVE" && (
            <p className="text-muted uppercase tracking-[0.1em]">
              market still active — resolution opens after end time
            </p>
          )}
          {resolverType !== "ADMIN" && (
            <p className="text-muted uppercase tracking-[0.1em]">
              non-admin resolver — automated flow handles this market
            </p>
          )}
        </div>
      </Frame>

      {pending !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm resolution"
          className="fixed inset-0 z-50 flex items-center justify-center bg-bg/70 p-4"
          onClick={() => setPending(null)}
        >
          <div
            className="w-full max-w-sm border border-line bg-surface p-5 font-mono"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-pixel text-lg uppercase tracking-wide text-fg">
              confirm resolution
            </p>
            <p className="mt-3 text-[12px] leading-relaxed text-muted">
              Resolve this market as{" "}
              <span className="uppercase tracking-[0.08em] text-fg">{pendingLabel}</span>?
              This submits the outcome on-chain and pays out winners. It cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2 text-[12px] uppercase tracking-[0.14em]">
              <button
                onClick={() => setPending(null)}
                className="px-3 py-1.5 border border-line text-muted hover:text-fg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const outcome = pending;
                  setPending(null);
                  if (outcome != null) submit(outcome);
                }}
                className="px-3 py-1.5 border border-accent bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
