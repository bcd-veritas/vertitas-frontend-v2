"use client";

import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const controlCls =
  "w-full border border-line bg-surface/60 px-3 py-2 font-sans text-sm text-fg outline-none transition-colors focus:border-accent placeholder:text-muted/40 disabled:opacity-40";

/** Label + control + hint/error scaffolding, shared by every field. */
export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label
        htmlFor={htmlFor}
        className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.15em] text-muted"
      >
        {label}
        {required ? <span className="text-accent">*</span> : null}
      </label>
      {children}
      {error ? (
        <span className="font-mono text-[10px] text-no">{error}</span>
      ) : hint ? (
        <span className="font-mono text-[10px] text-muted/60">{hint}</span>
      ) : null}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${controlCls} ${props.className ?? ""}`} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${controlCls} min-h-20 resize-y ${props.className ?? ""}`} />;
}

export function Select({
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`${controlCls} ${props.className ?? ""}`}>
      {children}
    </select>
  );
}

/** Row of mutually-exclusive buttons (resolver type, comparison…). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  ariaLabel?: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap gap-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={`cursor-pointer border px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition-colors ${
              active
                ? "border-accent bg-accent/10 text-fg"
                : "border-line text-muted hover:text-fg"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Boolean switch with a label to the right. */
export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex cursor-pointer items-center gap-3 text-left"
    >
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 items-center border transition-colors ${
          checked ? "border-yes bg-yes/20" : "border-line bg-surface/60"
        }`}
      >
        <span
          className={`ml-0.5 h-3.5 w-3.5 transition-transform ${checked ? "translate-x-4 bg-yes" : "translate-x-0 bg-muted"}`}
        />
      </span>
      <span className="flex flex-col">
        <span className="font-mono text-[11px] uppercase tracking-wider text-fg">{label}</span>
        {hint ? <span className="font-mono text-[10px] text-muted/60">{hint}</span> : null}
      </span>
    </button>
  );
}
