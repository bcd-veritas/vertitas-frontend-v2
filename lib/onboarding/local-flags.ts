// Per-wallet "has this tab already auto-opened the onboarding wizard" flag.
//
// sessionStorage, not localStorage, is the whole point: the suppression dies
// with the tab. Reloading won't re-prompt a wallet that just dismissed the
// wizard, but a fresh tab will offer it again — so a wallet that still can't
// trade is never permanently written off, and never nagged either.
//
// Whether the wizard is *needed* at all is derived from real state (approvals
// + identity), not from here. This only decides whether to open it unprompted.
const NS = "veritas:onboarding";
const key = (wallet: string) => `${NS}:prompted:${wallet.toLowerCase()}`;

export function hasPromptedThisTab(wallet: string): boolean {
  return typeof window !== "undefined" && sessionStorage.getItem(key(wallet)) === "1";
}

export function markPromptedThisTab(wallet: string): void {
  if (typeof window !== "undefined") sessionStorage.setItem(key(wallet), "1");
}
