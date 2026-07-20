// Hand-copied fragments of the middleware ABIs (UmaOracle.json,
// PredictionMarket.json) — only what the Oracle Desk touches.

export const assertionCreatedEvent = {
  type: "event",
  name: "AssertionCreated",
  inputs: [
    { name: "marketId", type: "bytes32", indexed: true },
    { name: "market", type: "address", indexed: true },
    { name: "proposer", type: "address", indexed: false },
    { name: "outcomeIndex", type: "uint256", indexed: false },
    { name: "challengeWindow", type: "uint256", indexed: false },
  ],
} as const;

export const disputedEvent = {
  type: "event",
  name: "Disputed",
  inputs: [
    { name: "marketId", type: "bytes32", indexed: true },
    { name: "market", type: "address", indexed: true },
    { name: "disputer", type: "address", indexed: false },
  ],
} as const;

export const votedEvent = {
  type: "event",
  name: "Voted",
  inputs: [
    { name: "marketId", type: "bytes32", indexed: true },
    { name: "market", type: "address", indexed: true },
    { name: "voter", type: "address", indexed: false },
    { name: "supportProposer", type: "bool", indexed: false },
  ],
} as const;

export const umaOracleAbi = [
  {
    type: "function",
    name: "getResolutionRequestStatus",
    stateMutability: "view",
    inputs: [{ name: "marketId", type: "bytes32" }],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "getResolutionRequest",
    stateMutability: "view",
    inputs: [{ name: "marketId", type: "bytes32" }],
    outputs: [
      { name: "storedMarketId", type: "bytes32" },
      { name: "rewardPool", type: "address" },
      { name: "outcomeCount", type: "uint256" },
      { name: "reward", type: "uint256" },
      { name: "requestTime", type: "uint256" },
      { name: "finalOutcomeIndex", type: "uint256" },
      { name: "resolvedTime", type: "uint256" },
      { name: "status", type: "uint8" },
    ],
  },
  {
    type: "function",
    name: "bondThreshold",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "challengeWindow",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "quorumBps",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "isRegisteredProposer",
    stateMutability: "view",
    inputs: [{ name: "proposer", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "isRegisteredDisputer",
    stateMutability: "view",
    inputs: [{ name: "disputer", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "isCommitteeMember",
    stateMutability: "view",
    inputs: [{ name: "member", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "assertOutcome",
    stateMutability: "nonpayable",
    inputs: [
      { name: "marketId", type: "bytes32" },
      { name: "_outcomeIndex", type: "uint256" },
      { name: "_bond", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "disputeOutcome",
    stateMutability: "nonpayable",
    inputs: [
      { name: "marketId", type: "bytes32" },
      { name: "_disputerOutcomeIndex", type: "uint256" },
      { name: "_bond", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "vote",
    stateMutability: "nonpayable",
    inputs: [
      { name: "marketId", type: "bytes32" },
      { name: "supportProposer", type: "bool" },
    ],
    outputs: [],
  },
  assertionCreatedEvent,
  disputedEvent,
  votedEvent,
] as const;

export const predictionMarketAbi = [
  {
    type: "function",
    name: "marketId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bytes32" }],
  },
] as const;

export const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;
