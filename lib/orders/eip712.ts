import type { ApiOutcome } from "@/lib/markets/types";

/**
 * Mirrors veritas-contracts OrderVerifier.sol / ExchangeTypes.sol — the
 * canonical on-chain order. The middleware's current verifier still expects
 * the older "Veritas CLOB" struct; the backend team is aligning it to this
 * one. If their final format differs, THIS FILE is the only place to change.
 */
export const ORDER_TYPES = {
  Order: [
    { name: "maker", type: "address" },
    { name: "market", type: "address" },
    { name: "outcomeIndex", type: "uint256" },
    { name: "side", type: "uint8" },
    { name: "quantity", type: "uint256" },
    { name: "price", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "expiration", type: "uint256" },
    { name: "salt", type: "bytes32" },
  ],
} as const;

/** ExchangeTypes.PRICE_SCALE — 1e6, NOT the API's 1e8. */
export const CONTRACT_PRICE_SCALE = 1_000_000n;
/** Provisional share scale (USDC-aligned); confirm with backend team. */
export const CONTRACT_QTY_SCALE = 1_000_000n;

/** Zero until the exchange is deployed; signatures are throwaway until then. */
const EXCHANGE_ADDRESS = (process.env.NEXT_PUBLIC_EXCHANGE_CONTRACT ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

export type OrderIntent = {
  marketId: string;
  outcome: ApiOutcome;
  side: "yes" | "no";
  action: "buy" | "sell";
  orderType: "MARKET" | "LIMIT";
  /** Price of the SELECTED side in whole-ish cents (market orders: worst walked price). */
  priceCents: number;
  shares: number;
};

function randomSalt(): `0x${string}` {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * PROVISIONAL yes/no mapping (backend team owns the final word): the API
 * exposes one tokenId per outcome (its YES token), so a NO trade is encoded
 * on the same outcomeIndex with the complementary price and flipped side —
 * which is how complementary CLOB matching treats it. Revisit when the
 * backend finalizes whether NO gets its own outcome index (per
 * ExchangeTypes.sol's "0 = NO, 1 = YES" comment).
 */
export function buildOrderTypedData(
  intent: OrderIntent,
  maker: `0x${string}`,
  chainId: number,
) {
  const yesSide = intent.action === "buy" ? 0 : 1; // BID : ASK
  const side = intent.side === "yes" ? yesSide : 1 - yesSide;
  const priceCents =
    intent.side === "yes" ? intent.priceCents : 100 - intent.priceCents;

  const message = {
    maker,
    market: EXCHANGE_ADDRESS, // PredictionMarket addr unknown until deploy; placeholder
    outcomeIndex: BigInt(intent.outcome.index),
    side,
    quantity: BigInt(Math.round(intent.shares * Number(CONTRACT_QTY_SCALE))),
    price: BigInt(Math.round((priceCents / 100) * Number(CONTRACT_PRICE_SCALE))),
    nonce: BigInt(Date.now()),
    expiration: BigInt(Math.floor(Date.now() / 1000) + 24 * 60 * 60),
    salt: randomSalt(),
  };

  return {
    domain: {
      name: "VeritasExchange",
      version: "1",
      chainId,
      verifyingContract: EXCHANGE_ADDRESS,
    },
    types: ORDER_TYPES,
    primaryType: "Order" as const,
    message,
  };
}

export type OrderMessage = ReturnType<typeof buildOrderTypedData>["message"];
