// Per-wallet "have we auto-opened the onboarding wizard for this browser
// already" flag. Deliberately client-only and independent of completion
// state: it fires once, no matter what the user does with it (dismiss, skip,
// complete), which is what keeps it from reopening on every reload.
const NS = "veritas:onboarding";
const key = (wallet: string) => `${NS}:seen:${wallet.toLowerCase()}`;

export function hasSeenAutoPrompt(wallet: string): boolean {
  return typeof window !== "undefined" && localStorage.getItem(key(wallet)) === "1";
}

export function markAutoPromptSeen(wallet: string): void {
  if (typeof window !== "undefined") localStorage.setItem(key(wallet), "1");
}
