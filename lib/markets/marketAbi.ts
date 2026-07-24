// Minimal ABI for the deployed PredictionMarket contract — just the surface
// the frontend calls directly. Winners self-serve their winning CTF tokens
// via redeemPositions() (no args); the middleware picks up the resulting
// WinningsRedeemed event during claim-sync (POST /markets/:marketId/claim).
export const marketAbi = [
  {
    type: "function",
    name: "redeemPositions",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    // The caller's on-chain CTF balance for one outcome. The claim UI reads
    // this to know when settlement has actually DELIVERED the winning tokens
    // to the wallet — the button only opens once this is > 0.
    type: "function",
    name: "getOutcomeBalance",
    stateMutability: "view",
    inputs: [
      { name: "_account", type: "address" },
      { name: "_outcomeIndex", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    // Deployed v4 shape (4 args) — matches the on-chain event the middleware
    // decodes during claim-sync; the contracts-repo source is outdated here.
    type: "event",
    name: "WinningsRedeemed",
    inputs: [
      { name: "marketId", type: "bytes32", indexed: true },
      { name: "marketAddress", type: "address", indexed: true },
      { name: "account", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
] as const;
