// Deposit wiring — sourced entirely from env so addresses live in one place
// (.env) and never drift as a hardcoded copy. These MUST be set; a missing
// value surfaces loudly rather than silently sending funds to 0x0.

function required(name: string, value: string | undefined): `0x${string}` {
  if (!value) {
    throw new Error(`${name} is not set — configure it in .env`);
  }
  return value as `0x${string}`;
}

export const USDCC_TOKEN = required(
  "NEXT_PUBLIC_USDCC_TOKEN",
  process.env.NEXT_PUBLIC_USDCC_TOKEN,
);

/** Spender for the USDCC approve, and the contract the deposit is sent to. */
export const COLLATERAL_VAULT = required(
  "NEXT_PUBLIC_COLLATERAL_VAULT",
  process.env.NEXT_PUBLIC_COLLATERAL_VAULT,
);

// Standard deposits mint VTK to the vault itself (protocol custody); the backend
// credits the ledger against it. Voters pass their own address as the receiver
// and keep the VTK in their wallet. No separate treasury address is needed —
// the vault is the single address both repos must agree on.

/** USDCC and VTK are both 6-decimals on-chain, and the vault swaps them 1:1. */
export const USDCC_DECIMALS = 6;

/** Settlement contract — the spender for the VTK approval that lets the Exchange
 *  COLLECT a user's collateral at settlement (Exchange.settleLegs COLLECT branch).
 *  Fallback MUST match the middleware's EXCHANGE_CONTRACT / contracts.ts exchange. */
export const EXCHANGE_CONTRACT = (process.env.NEXT_PUBLIC_EXCHANGE_CONTRACT ??
  "0x21804b23262079333be33c89118146467741ed59") as `0x${string}`;
