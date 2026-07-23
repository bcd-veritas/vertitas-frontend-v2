// CollateralVault ABI — only the deposit entry point. The USDCC approve /
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
] as const;
