"use client";

import type { ReactNode } from "react";

export type ProgressStepState = "pending" | "active" | "done" | "failed";

export type ProgressStep = {
  id: string;
  label: string;
  state: ProgressStepState;
  /** Failing this step doesn't fail the run — renders muted, not red. */
  optional?: boolean;
  /** Secondary line under the label: a wallet prompt hint, an error detail. */
  note?: string;
};

export type ProgressPhase = "running" | "success" | "error" | null;

type PhaseCopy = { running: string; success: string; error: string };

const pick = (copy: PhaseCopy, phase: Exclude<ProgressPhase, null>) => copy[phase];

/** Derive step states from a single in-flight index — for flows that report
 *  progress as "we are on step N" rather than per-step status (the admin
 *  create-market SSE stream). */
export function stepsFromIndex(
  defs: readonly { id: string; label: string }[],
  activeIndex: number,
  phase: Exclude<ProgressPhase, null>,
): ProgressStep[] {
  return defs.map((s, i) => ({
    ...s,
    state:
      phase === "success" || i < activeIndex
        ? "done"
        : phase === "error" && i === activeIndex
          ? "failed"
          : i === activeIndex
            ? "active"
            : "pending",
  }));
}

function Glyph({ step }: { step: ProgressStep }) {
  // A failed optional step is a skip, not an error — the run still succeeded.
  const skipped = step.state === "failed" && step.optional;

  const tone = skipped
    ? "text-muted/60"
    : step.state === "done"
      ? "text-yes"
      : step.state === "failed"
        ? "text-no"
        : step.state === "active"
          ? "text-accent"
          : "text-muted/40";

  return (
    <span
      aria-hidden="true"
      className={`flex h-4 w-4 shrink-0 items-center justify-center text-[10px] ${tone}`}
    >
      {skipped ? (
        "~"
      ) : step.state === "done" ? (
        "✓"
      ) : step.state === "failed" ? (
        "✕"
      ) : step.state === "active" ? (
        <span className="h-2.5 w-2.5 animate-spin rounded-full border border-accent border-t-transparent motion-reduce:animate-none" />
      ) : (
        "○"
      )}
    </span>
  );
}

function StepRow({ step }: { step: ProgressStep }) {
  const skipped = step.state === "failed" && step.optional;

  const labelTone = skipped
    ? "text-muted"
    : step.state === "pending"
      ? "text-muted/45"
      : step.state === "active"
        ? "text-fg"
        : step.state === "failed"
          ? "text-no"
          : "text-fg/70";

  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5">
        <Glyph step={step} />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className={`text-[12px] tracking-[0.02em] ${labelTone}`}>
          {step.label}
        </span>
        {step.note && (
          <span
            className={`text-[10px] uppercase tracking-[0.14em] ${
              step.state === "failed" && !skipped ? "text-no/80" : "text-muted/60"
            }`}
          >
            {step.note}
          </span>
        )}
      </span>
    </li>
  );
}

/**
 * Live stepper overlay for any multi-step operation. Terminal phases (success /
 * error) reveal a Close button; while running there is deliberately no exit —
 * the work is already in flight.
 */
export function ProgressModal({
  phase,
  steps,
  title,
  caption,
  message,
  summary,
  onClose,
  closeLabel = "Close",
}: {
  phase: ProgressPhase;
  steps: ProgressStep[];
  title: PhaseCopy;
  caption: PhaseCopy;
  /** Error detail, rendered under the steps. */
  message?: string | null;
  /** Rendered under the steps on success — a recap of what happened. */
  summary?: ReactNode;
  onClose: () => void;
  closeLabel?: string;
}) {
  if (phase == null) return null;
  const terminal = phase === "success" || phase === "error";

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/50" />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={pick(title, phase)}
          aria-busy={phase === "running"}
          className="w-full max-w-md border border-line bg-surface p-6 font-mono"
        >
          <p className="font-pixel text-lg uppercase tracking-wide text-fg">
            {pick(title, phase)}
          </p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted/70">
            {pick(caption, phase)}
          </p>

          <ol className="mt-5 flex flex-col gap-3">
            {steps.map((step) => (
              <StepRow key={step.id} step={step} />
            ))}
          </ol>

          {phase === "error" && message && (
            <p className="mt-4 border-t border-line/60 pt-3 text-[11px] leading-relaxed text-no">
              {message}
            </p>
          )}

          {phase === "success" && summary && (
            <div className="mt-4 border-t border-line/60 pt-4">{summary}</div>
          )}

          {terminal && (
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="border border-line px-4 py-1.5 text-[12px] uppercase tracking-[0.14em] text-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                {closeLabel}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
