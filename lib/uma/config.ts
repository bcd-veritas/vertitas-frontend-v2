// UMA oracle wiring. Env overrides cover contract redeploys; the fallbacks
// MUST match veritas-middleware src/infra/blockchain/addresses/contracts.ts.
export const UMA_ORACLE = (process.env.NEXT_PUBLIC_UMA_ORACLE ??
  "0x59fb8564df1fef2f4533ad05e4e39b2cd33696e8") as `0x${string}`;

export const VTK_TOKEN = (process.env.NEXT_PUBLIC_VTK_TOKEN ??
  "0x0c6722151ecab43db4f6d5ba1f46fd95677a896c") as `0x${string}`;

/** VTK is 6-decimals on-chain (bond of 500 VTK = 500_000_000n). */
export const VTK_DECIMALS = 6;

/** Deliberation quiet window (ms): a disputed market finalizes only after
 *  this long with NO new committee vote — each ballot restarts the clock.
 *  MUST match the middleware's UMA_VOTE_QUIET_WINDOW_MS (both default 10m). */
export const UMA_VOTE_QUIET_MS = process.env.NEXT_PUBLIC_UMA_VOTE_QUIET_MS
  ? Number(process.env.NEXT_PUBLIC_UMA_VOTE_QUIET_MS)
  : 600_000;

/** Lower bound for oracle event scans. Defaults to the UmaOracle's Sepolia
 *  deploy block (found by bisecting getCode) — no oracle event can predate
 *  it, and a bounded range keeps every RPC provider happy where 'earliest'
 *  gets rejected. Override with NEXT_PUBLIC_UMA_FROM_BLOCK on redeploy. */
export const UMA_FROM_BLOCK: bigint = process.env.NEXT_PUBLIC_UMA_FROM_BLOCK
  ? BigInt(process.env.NEXT_PUBLIC_UMA_FROM_BLOCK)
  : 11_237_361n;
