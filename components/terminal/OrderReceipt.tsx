"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Clock } from "lucide-react";
import { oneDp } from "@/lib/markets/format";

// Enter is slightly slower than exit (asymmetric — the system responds fast),
// both on a strong ease-out curve. EXIT_MS matches the .15s out-animation so the
// unmount lands exactly as it finishes. Reduced motion drops the scale.
const EXIT_MS = 150;
const RECEIPT_ANIM_CSS = `
@keyframes receiptIn{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:scale(1)}}
@keyframes receiptOut{from{opacity:1;transform:scale(1)}to{opacity:0;transform:scale(.985)}}
.receipt-in{animation:receiptIn .24s cubic-bezier(0.23,1,0.32,1) both}
.receipt-out{animation:receiptOut .15s cubic-bezier(0.23,1,0.32,1) both}
@media (prefers-reduced-motion: reduce){
  .receipt-in{animation:rfIn .18s ease both}
  .receipt-out{animation:rfOut .12s ease both}
}
@keyframes rfIn{from{opacity:0}to{opacity:1}}
@keyframes rfOut{from{opacity:1}to{opacity:0}}
`;

export type Receipt = {
  /** filled = fully matched, partial = some matched + rest, resting = none matched. */
  kind: "filled" | "partial" | "resting";
  action: "buy" | "sell";
  /** Outcome label being traded (e.g. "YES"). */
  label: string;
  intendedShares: number;
  filledShares: number;
  restingShares: number;
  /** Weighted-avg fill price (filled/partial) or the limit price (resting), in cents. */
  avgCents: number;
  /** $ paid (buy) or received (sell) — for the filled portion. */
  amountDollars: number;
  /** Limit price for the resting portion, in cents. */
  limitCents: number;
  isLimit: boolean;
};

const money = (n: number) => `$${n.toFixed(2)}`;

/**
 * Confirmation that flips in over the trade ticket after a placed order, saying
 * what actually happened — filled, partially filled, or resting on the book —
 * rather than a generic "order placed". Absolutely positioned to cover the
 * Frame (which is `relative`); click anywhere to dismiss early (it also
 * auto-reverts on a timer owned by the parent).
 */
export function OrderReceipt({
  receipt,
  onDismiss,
  holdMs = 2000,
}: {
  receipt: Receipt;
  onDismiss: () => void;
  /** How long the receipt holds before it animates out and unmounts. */
  holdMs?: number;
}) {
  const { kind, action, label } = receipt;
  const verb = action === "buy" ? "bought" : "sold";
  const tint =
    kind === "filled" ? "var(--color-yes)" : "var(--color-accent)";

  // Play the out-animation, then let the parent unmount us once it finishes.
  const [exiting, setExiting] = useState(false);
  const doneRef = useRef(false);
  const dismiss = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    setExiting(true);
    window.setTimeout(onDismiss, EXIT_MS);
  };

  // Auto-dismiss after the hold; a tap dismisses early (cleanup clears this).
  useEffect(() => {
    const t = window.setTimeout(dismiss, holdMs);
    return () => window.clearTimeout(t);
    // One-shot receipt — dismiss's identity doesn't need to re-arm the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdMs]);

  return (
    <button
      type="button"
      onClick={dismiss}
      aria-label="Dismiss confirmation"
      className={`absolute inset-0 z-20 flex flex-col items-stretch justify-center gap-4 bg-surface px-6 text-left cursor-pointer focus-visible:outline-none ${exiting ? "receipt-out" : "receipt-in"}`}
    >
      <style>{RECEIPT_ANIM_CSS}</style>

      {/* header */}
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full shrink-0"
          style={{ background: tint }}
        >
          {kind === "resting" ? (
            <Clock className="h-4 w-4" strokeWidth={2.5} style={{ color: "var(--color-bg)" }} />
          ) : (
            <Check className="h-4 w-4" strokeWidth={3} style={{ color: "var(--color-bg)" }} />
          )}
        </span>
        <span
          className="font-pixel text-2xl uppercase tracking-wide"
          style={{ color: tint }}
        >
          {kind === "filled" ? "Filled" : kind === "partial" ? "Partial fill" : "On the book"}
        </span>
      </div>

      {/* body */}
      {kind === "filled" && (
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
            {verb}
          </span>
          <span className="font-mono text-2xl tabular-nums text-fg">
            {receipt.filledShares.toFixed(2)}{" "}
            <span className="text-sm text-muted">sh · {label}</span>
          </span>
          <span className="font-mono text-xs text-muted">
            @ {oneDp(receipt.avgCents)}¢ avg ·{" "}
            <span className="text-fg/85">{money(receipt.amountDollars)}</span>
          </span>
          <span className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-yes">
            {action === "buy" ? "added to your position" : "proceeds credited"}
          </span>
        </div>
      )}

      {kind === "partial" && (
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
            filled now
          </span>
          <span className="font-mono text-2xl tabular-nums text-fg">
            {receipt.filledShares.toFixed(2)}{" "}
            <span className="text-sm text-muted">
              of {receipt.intendedShares.toFixed(2)} sh
            </span>
          </span>
          <span className="font-mono text-xs text-muted">
            @ {oneDp(receipt.avgCents)}¢ · <span className="text-fg/85">{money(receipt.amountDollars)}</span>
          </span>
          {/* fill progress */}
          <span className="mt-2.5 mb-1 block h-1 w-full overflow-hidden bg-fg/10">
            <span
              className="block h-full bg-yes"
              style={{
                width: `${Math.min(100, Math.round((receipt.filledShares / Math.max(receipt.intendedShares, 1e-9)) * 100))}%`,
              }}
            />
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">
            {receipt.isLimit
              ? `${receipt.restingShares.toFixed(2)} sh resting @ ${oneDp(receipt.limitCents)}¢`
              : `${receipt.restingShares.toFixed(2)} sh unfilled`}
          </span>
        </div>
      )}

      {kind === "resting" && (
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
            order placed
          </span>
          <span className="font-mono text-2xl tabular-nums text-fg">
            {receipt.restingShares.toFixed(2)}{" "}
            <span className="text-sm text-muted">sh · {label}</span>
          </span>
          <span className="font-mono text-xs text-muted">
            @ {oneDp(receipt.limitCents)}¢ ·{" "}
            <span className="text-fg/85">{money(receipt.amountDollars)} locked</span>
          </span>
          <span className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
            waiting for a match · in open orders
          </span>
        </div>
      )}

      <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted/40">
        tap to dismiss
      </span>
    </button>
  );
}
