"use client";

import { useState } from "react";

export const MAX_COMMENT_LENGTH = 1000;

/** A textarea + submit used for new comments, replies, and edits. Surfaces the
 *  API's error message inline and clears itself on a successful submit.
 *  Enter submits; Shift+Enter (or Cmd/Ctrl+Enter) inserts a newline. */
export function Composer({
  onSubmit,
  placeholder,
  submitLabel = "post",
  initialValue = "",
  autoFocus = false,
  onCancel,
  variant = "inline",
}: {
  onSubmit: (text: string) => Promise<void>;
  placeholder: string;
  submitLabel?: string;
  initialValue?: string;
  autoFocus?: boolean;
  onCancel?: () => void;
  /** "primary" is the top-of-tab composer: bordered box, real button. "inline"
   *  is the reply/edit box, which must stay light inside a thread. */
  variant?: "primary" | "inline";
}) {
  const [value, setValue] = useState(initialValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const text = value.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(text);
      setValue("");
      onCancel?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to post");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={variant === "primary" ? "py-3" : "py-2"}>
      <div
        className={
          variant === "primary"
            ? "rounded-md border border-line bg-black/15 transition-colors focus-within:border-accent/40"
            : ""
        }
      >
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          maxLength={MAX_COMMENT_LENGTH}
          rows={variant === "primary" ? 3 : 2}
          autoFocus={autoFocus}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
              e.preventDefault();
              submit();
            }
            if (e.key === "Escape") onCancel?.();
          }}
          className={`w-full resize-none bg-transparent px-3 py-2 text-[13px] leading-relaxed text-fg/90 outline-none placeholder:text-muted/55 ${
            variant === "primary" ? "" : "border border-line/70 bg-fg/[0.02] focus:border-accent/50"
          }`}
        />
        {variant === "primary" && (
          <div className="flex items-center justify-end gap-3 border-t border-line px-2 py-2">
            {/* counter appears only when it starts to matter */}
            {value.length > 800 && (
              <span className="font-mono text-[10px] tabular-nums text-muted/60">
                {value.length}/{MAX_COMMENT_LENGTH}
              </span>
            )}
            <button
              type="button"
              onClick={submit}
              disabled={busy || value.trim().length === 0}
              className="rounded-full bg-accent px-4 py-1.5 font-mono text-[11px] tracking-[0.12em] text-bg uppercase transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {busy ? "…" : submitLabel}
            </button>
          </div>
        )}
      </div>
      {variant === "inline" && (
        <div className="mt-1.5 flex items-center gap-3">
          <button
            type="button"
            onClick={submit}
            disabled={busy || value.trim().length === 0}
            className="font-mono text-[10px] tracking-[0.12em] text-accent uppercase transition-colors hover:text-accent/80 disabled:opacity-40"
          >
            {busy ? "…" : submitLabel}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase transition-colors hover:text-fg/80"
            >
              cancel
            </button>
          )}
        </div>
      )}
      {error && <p className="mt-1 font-mono text-[10px] text-no/90">{error}</p>}
    </div>
  );
}
