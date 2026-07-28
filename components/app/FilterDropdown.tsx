"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

/**
 * A compact custom dropdown for a single-choice filter — replaces a row of
 * chips once there are too many to sit inline. Styled to match the board's
 * mono/accent controls (no native <select>). Closes on outside click, Escape,
 * or selection.
 */
export function FilterDropdown<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  /** Small muted prefix shown before the current value (e.g. "filter //"). */
  label?: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = options.find((o) => o.id === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-fg/20 bg-fg/[0.04] font-mono text-[11px] uppercase tracking-[0.14em] text-fg/90 hover:border-fg/45 hover:bg-fg/8 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 cursor-pointer"
      >
        {label && <span className="text-muted">{label}</span>}
        <span className="min-w-[4.5rem] text-left">{current?.label ?? value}</span>
        <ChevronDown
          size={13}
          aria-hidden="true"
          className={`text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 z-30 mt-1 min-w-[11rem] border border-line bg-surface py-1 shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
        >
          {options.map((o) => {
            const on = o.id === value;
            return (
              <li key={o.id} role="option" aria-selected={on}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-4 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors cursor-pointer ${
                    on
                      ? "text-accent bg-accent/10"
                      : "text-muted hover:text-fg hover:bg-fg/5"
                  }`}
                >
                  {o.label}
                  {on && <Check size={13} aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
