"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { updateUserIdentity, type UserIdentity } from "@/lib/profile/data";
import { MonoLabel } from "../landing/ui/MonoLabel";

const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,24}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Phase = "idle" | "saving" | "error";

export function EditProfileDrawer({
  open,
  onClose,
  address,
  identity,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  address: string;
  identity: UserIdentity | null;
  onSaved: (identity: UserIdentity) => void;
}) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const usernameRef = useRef<HTMLInputElement>(null);

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setUsername(identity?.username ?? "");
      setEmail(identity?.email ?? "");
      setPhase("idle");
      setError(null);
    }
  }

  useEffect(() => {
    if (!open) return;
    usernameRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const trimmedUsername = username.trim();
  const trimmedEmail = email.trim();
  const usernameInvalid = trimmedUsername !== "" && !USERNAME_RE.test(trimmedUsername);
  const emailInvalid = trimmedEmail !== "" && !EMAIL_RE.test(trimmedEmail);
  const canSave = phase !== "saving" && !usernameInvalid && !emailInvalid;

  const save = async () => {
    if (!canSave) return;
    setPhase("saving");
    setError(null);
    try {
      const saved = await updateUserIdentity(address, {
        username: trimmedUsername === "" ? null : trimmedUsername,
        email: trimmedEmail === "" ? null : trimmedEmail,
      });
      onSaved(saved);
      onClose();
      setPhase("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  };

  return (
    <div className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/50 transition-opacity duration-300 motion-reduce:transition-none ${open ? "opacity-100" : "opacity-0"
          }`}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Edit profile"
        className={`absolute right-0 top-0 h-full w-full max-w-md bg-surface border-l border-line flex flex-col transition-transform duration-300 ease-out motion-reduce:transition-none ${open ? "translate-x-0" : "translate-x-full"
          }`}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-line">
          <h2 className="font-pixel text-xl tracking-wide text-fg">EDIT PROFILE</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-muted hover:text-fg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-7">
          <div>
            <MonoLabel className="block mb-2">wallet // read-only</MonoLabel>
            <p className="font-mono text-[11px] tracking-[0.06em] text-muted break-all px-3 py-2.5 bg-fg/3 border border-dashed border-line select-all">
              {address}
            </p>
          </div>

          <div>
            <label htmlFor="edit-username" className="block mb-2">
              <MonoLabel>username</MonoLabel>
            </label>
            <input
              id="edit-username"
              ref={usernameRef}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="your public handle"
              autoComplete="off"
              spellCheck={false}
              className={`w-full bg-transparent text-fg text-sm py-2 border-b transition-colors placeholder:text-muted/40 focus-visible:outline-none ${usernameInvalid ? "border-no" : "border-line focus:border-accent"
                }`}
            />
            <p
              className={`mt-1.5 font-mono text-[10px] uppercase tracking-widest ${usernameInvalid ? "text-no" : "text-muted/60"
                }`}
            >
              3–24 chars · letters, numbers, _ . — · empty to clear
            </p>
          </div>

          <div>
            <label htmlFor="edit-email" className="block mb-2">
              <MonoLabel>email</MonoLabel>
            </label>
            <input
              id="edit-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@domain.com"
              autoComplete="off"
              spellCheck={false}
              className={`w-full bg-transparent text-fg text-sm py-2 border-b transition-colors placeholder:text-muted/40 focus-visible:outline-none ${emailInvalid ? "border-no" : "border-line focus:border-accent"
                }`}
            />
            <p
              className={`mt-1.5 font-mono text-[10px] uppercase tracking-widest ${emailInvalid ? "text-no" : "text-muted/60"
                }`}
            >
              {emailInvalid ? "invalid email address" : "used for notifications · empty to clear"}
            </p>
          </div>

          {phase === "error" && error && (
            <p role="alert" className="font-mono text-[11px] text-no">
              {error}
            </p>
          )}
        </div>

        <div className="px-6 py-5 border-t border-line flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            className={`pill flex-1 py-2.5! font-mono text-[11px] uppercase tracking-[0.14em] ${canSave ? "pill-solid" : "bg-fg/10 text-muted"
              }`}
          >
            {phase === "saving" ? "SAVING…" : "SAVE"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="pill pill-ghost py-2.5! px-6! font-mono text-[11px] uppercase tracking-[0.14em]"
          >
            CANCEL
          </button>
        </div>
        <p className="px-6 pb-5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted/50">
          changes apply to your public trading identity
        </p>
      </aside>
    </div>
  );
}
