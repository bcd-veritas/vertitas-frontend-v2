"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

import { StepRail } from "../common/StepRail";

const pad = (n: number) => String(n).padStart(2, "0");

/** The scrolling content region of a step. */
export function ModalBody({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-5 overflow-y-auto px-6 py-6">{children}</div>
  );
}

/** A step's action area, pinned under the body. */
export function ModalFooter({ children }: { children: React.ReactNode }) {
  return <div className="border-t border-line px-6 py-4">{children}</div>;
}

/**
 * The one dialog the whole onboarding sequence lives in. The panel stays put
 * while the title, body and footer swap per step — the progress rail under the
 * header is the only thing that persists across the change, so advancing reads
 * as movement through one flow rather than a stack of separate modals.
 */
export function ModalShell({
  open,
  onClose,
  title,
  subtitle,
  steps,
  stepIndex = 0,
  dismissible = true,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** Step names for the progress rail. Omit to hide it. */
  steps?: readonly string[];
  /** 0-based position of the current step within `steps`. */
  stepIndex?: number;
  /** False while work is in flight — closes off the X, backdrop and Escape. */
  dismissible?: boolean;
  /** The active step's `<ModalBody>` and `<ModalFooter>`. */
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open || !dismissible) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dismissible, onClose]);

  return (
    <div className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      <div
        onClick={dismissible ? onClose : undefined}
        className={`absolute inset-0 bg-black/50 transition-opacity duration-300 motion-reduce:transition-none ${open ? "opacity-100" : "opacity-0"}`}
      />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className={`flex max-h-[90vh] w-full max-w-md flex-col border border-line bg-surface transition-all duration-200 motion-reduce:transition-none ${open ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}
        >
          <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4">
            {/* Keyed on the title so a step change replays the slide-in; the
                close button and counter sit outside so they never re-animate. */}
            <div key={title} className="step-advance min-w-0">
              <h2 className="font-pixel text-xl tracking-wide text-fg">{title}</h2>
              {subtitle && (
                <p className="mt-1 font-mono text-[11px] leading-relaxed text-muted">
                  {subtitle}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-3.5">
              {steps && steps.length > 0 && (
                <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.16em] text-muted/50 tabular-nums">
                  {pad(stepIndex + 1)} / {pad(steps.length)}
                </span>
              )}
              {dismissible && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="rounded text-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          {steps && steps.length > 0 ? (
            <StepRail steps={steps} index={stepIndex} />
          ) : (
            <div className="border-t border-line" />
          )}

          {children}
        </div>
      </div>
    </div>
  );
}
