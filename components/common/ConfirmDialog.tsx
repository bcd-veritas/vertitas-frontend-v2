"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * A small, reusable confirmation modal for deliberate/destructive actions
 * (e.g. cancelling a resting order). Portals to <body> so it escapes any
 * ancestor with a transform/backdrop-filter (which would otherwise trap
 * position:fixed) and any scroll/overflow clipping of the panel it's invoked
 * from. Caller owns the async work and drives `busy`; while busy the dialog
 * can't be dismissed so the action can't be double-fired.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Keep",
  busyLabel = "Working…",
  busy = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  busyLabel?: string;
  /** Caller-driven — true while the confirmed action runs. */
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, busy]);

  if (!mounted) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[60] ${open ? "" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      <div
        onClick={busy ? undefined : onClose}
        className={`absolute inset-0 bg-black/50 transition-opacity duration-200 motion-reduce:transition-none ${open ? "opacity-100" : "opacity-0"}`}
      />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className={`w-full max-w-sm max-h-[90dvh] overflow-y-auto bg-surface border border-line flex flex-col transition-all duration-200 motion-reduce:transition-none ${open ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-line">
            <h2 className="font-pixel text-lg tracking-wide text-fg">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              aria-label="Close"
              className="text-muted hover:text-fg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          <div className="px-5 py-5">
            <div className="font-mono text-[12px] leading-relaxed text-muted">
              {message}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 px-5 pb-5">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] border border-line text-fg hover:bg-fg/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy}
              className="px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] border border-no bg-no text-bg font-bold hover:brightness-110 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-no/40 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {busy ? busyLabel : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
