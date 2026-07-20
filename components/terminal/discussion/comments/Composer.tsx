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
}: {
  onSubmit: (text: string) => Promise<void>;
  placeholder: string;
  submitLabel?: string;
  initialValue?: string;
  autoFocus?: boolean;
  onCancel?: () => void;
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
    <div className="py-3">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        maxLength={MAX_COMMENT_LENGTH}
        rows={2}
        autoFocus={autoFocus}
        onKeyDown={(e) => {
          // Enter submits; Shift+Enter (or Cmd/Ctrl+Enter) inserts a newline.
          if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            submit();
          }
          if (e.key === "Escape") onCancel?.();
        }}
        className="w-full resize-none bg-fg/[0.02] border border-line/70 focus:border-accent/50 outline-none px-3 py-2 text-sm text-fg/90 placeholder:text-muted/60 transition-colors"
      />
      <div className="flex items-center gap-3 mt-1.5">
        <button
          type="button"
          onClick={submit}
          disabled={busy || value.trim().length === 0}
          className="font-mono text-[10px] uppercase tracking-[0.12em] text-accent hover:text-accent/80 disabled:opacity-40 transition-colors"
        >
          {busy ? "…" : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted hover:text-fg/80 transition-colors"
          >
            cancel
          </button>
        )}
        <span className="ml-auto font-mono text-[10px] tabular-nums text-muted/60">
          {value.length}/{MAX_COMMENT_LENGTH}
        </span>
      </div>
      {error && <p className="mt-1 font-mono text-[10px] text-no/90">{error}</p>}
    </div>
  );
}
