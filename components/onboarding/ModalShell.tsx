"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

/** Shared centered-dialog shell for the onboarding modals. Matches DepositModal's
 *  look (surface panel, line borders, pixel title) so every step feels the same. */
export function ModalShell({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

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
          aria-label={title}
          className={`w-full max-w-md bg-surface border border-line flex flex-col max-h-[90vh] transition-all duration-200 motion-reduce:transition-none ${open ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
        >
          <div className="flex items-start justify-between px-6 py-5 border-b border-line">
            <div>
              <h2 className="font-pixel text-xl tracking-wide text-fg">{title}</h2>
              {subtitle && (
                <p className="mt-1 font-mono text-[11px] leading-relaxed text-muted">{subtitle}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="mt-1 text-muted hover:text-fg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          <div className="px-6 py-6 flex flex-col gap-5 overflow-y-auto">{children}</div>

          {footer && <div className="px-6 py-4 border-t border-line">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
