"use client";

import { useState } from "react";

import { ensureAccount, updateUserIdentity, type UserIdentity } from "@/lib/profile/data";
import { MonoLabel } from "../landing/ui/MonoLabel";
import { ModalBody, ModalFooter } from "./ModalShell";

const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,24}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const CREDENTIALS_TITLE = "YOUR PROFILE";
export const CREDENTIALS_SUBTITLE =
  "Pick a public handle and (optionally) an email for notifications.";

/**
 * Step 1 — profile. Sets username/email against the middleware. Optional: the
 * user can skip. `onBusyChange` lets the shell lock itself while saving.
 */
export function CredentialsStep({
  address,
  identity,
  onSaved,
  onDone,
  onBusyChange,
}: {
  address: string;
  identity: UserIdentity | null;
  onSaved?: (identity: UserIdentity) => void;
  onDone?: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [username, setUsername] = useState(identity?.username ?? "");
  const [email, setEmail] = useState(identity?.email ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedUsername = username.trim();
  const trimmedEmail = email.trim();
  const usernameInvalid = trimmedUsername !== "" && !USERNAME_RE.test(trimmedUsername);
  const emailInvalid = trimmedEmail !== "" && !EMAIL_RE.test(trimmedEmail);
  const canSave = !saving && !usernameInvalid && !emailInvalid;

  function setBusy(busy: boolean) {
    setSaving(busy);
    onBusyChange?.(busy);
  }

  async function save() {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      // Belt-and-suspenders: AccountSync's ensureAccount call (on connect/account
      // switch) is fire-and-forget, so it can still be in flight when the user
      // saves here. Await it first so `update` never 404s on a missing row.
      await ensureAccount(address);
      const saved = await updateUserIdentity(address, {
        username: trimmedUsername === "" ? null : trimmedUsername,
        email: trimmedEmail === "" ? null : trimmedEmail,
      });
      onSaved?.(saved);
      onDone?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <ModalBody>
        <div>
          <label htmlFor="onb-username" className="mb-2 block">
            <MonoLabel>username</MonoLabel>
          </label>
          <input
            id="onb-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="your public handle"
            autoComplete="off"
            spellCheck={false}
            className={`w-full border-b bg-transparent py-2 text-sm text-fg transition-colors placeholder:text-muted/40 focus-visible:outline-none ${usernameInvalid ? "border-no" : "border-line focus:border-accent"}`}
          />
          <p
            className={`mt-1.5 font-mono text-[10px] uppercase tracking-widest ${usernameInvalid ? "text-no" : "text-muted/60"}`}
          >
            3–24 chars · letters, numbers, _ . —
          </p>
        </div>

        <div>
          <label htmlFor="onb-email" className="mb-2 block">
            <MonoLabel>email</MonoLabel>
          </label>
          <input
            id="onb-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@domain.com"
            autoComplete="off"
            spellCheck={false}
            className={`w-full border-b bg-transparent py-2 text-sm text-fg transition-colors placeholder:text-muted/40 focus-visible:outline-none ${emailInvalid ? "border-no" : "border-line focus:border-accent"}`}
          />
          <p
            className={`mt-1.5 font-mono text-[10px] uppercase tracking-widest ${emailInvalid ? "text-no" : "text-muted/60"}`}
          >
            {emailInvalid ? "invalid email address" : "used for notifications"}
          </p>
        </div>

        {error && <p className="font-mono text-[11px] text-no">{error}</p>}
      </ModalBody>

      <ModalFooter>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            className="pill pill-solid flex-1 py-2.5! font-mono text-[11px] uppercase tracking-[0.14em] disabled:opacity-40"
          >
            {saving ? "saving…" : "save & continue"}
          </button>
          <button
            type="button"
            onClick={() => onDone?.()}
            disabled={saving}
            className="pill pill-ghost px-6! py-2.5! font-mono text-[11px] uppercase tracking-[0.14em] disabled:opacity-40"
          >
            skip
          </button>
        </div>
      </ModalFooter>
    </>
  );
}
