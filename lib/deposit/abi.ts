// CollateralVault ABI — the deposit and redeem entry points. The USDCC approve /
// allowance / balanceOf calls reuse `erc20Abi` from lib/uma/abi.ts; don't
// redefine ERC20 here.

export const collateralVaultAbi = [
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_amount", type: "uint256" },
      { name: "_receiver", type: "address" },
    ],
    outputs: [{ name: "vtkMinted", type: "uint256" }],
  },
  {
    // Withdraw: burns the caller's VTK 1:1 for USDCC sent to `_receiver`. No
    // ERC20 approval needed first — the vault is VTK's minter, so `burnFrom`
    // is minter-gated and pulls the VTK directly (unlike deposit, which needs
    // a USDCC allowance to the vault). One transaction.
    type: "function",
    name: "redeem",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_amount", type: "uint256" },
      { name: "_receiver", type: "address" },
    ],
    outputs: [{ name: "usdccReturned", type: "uint256" }],
  },
  {
    // Emitted by redeem() — the middleware decodes this during withdraw-sync
    // (POST /withdrawals) to record the transfer and re-sync the ledger.
    type: "event",
    name: "Redeemed",
    inputs: [
      { name: "caller", type: "address", indexed: true },
      { name: "receiver", type: "address", indexed: true },
      { name: "vtkAmount", type: "uint256", indexed: false },
      { name: "usdccAmount", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
] as const;
