import type { ApiOutcome } from "@/lib/markets/types";

/**
 * Mirrors veritas-middleware's eip712.config.ts — the "Veritas CLOB" order
 * struct that intake's Eip712SignatureVerifier actually recovers. This is the
 * canonical format: the deployed Exchange contract never verifies user order
 * signatures (settlement is operator-committed Merkle batches), so the
 * contracts' VeritasExchange struct (OrderVerifier.sol) is unwired dead code.
 * Revisit only if direct on-chain fills ever land in a future Exchange.
 */
export const ORDER_TYPES = {
  Order: [
    { name: "orderId", type: "string" },
    { name: "marketId", type: "string" },
    { name: "tokenId", type: "string" },
    { name: "maker", type: "address" },
    { name: "side", type: "uint8" },
    { name: "price", type: "uint256" },
    { name: "amount", type: "uint256" },
    { name: "expiration", type: "uint256" },
    { name: "nonce", type: "uint256" },
  ],
} as const;

/** Backend fixed-point scales (shared/utils/fixed-point.ts): 1e6 for both. */
export const PRICE_SCALE = 1_000_000n;
export const AMOUNT_SCALE = 1_000_000n;

/**
 * Must equal the middleware's EXCHANGE_CONTRACT — it is the signing domain's
 * verifyingContract, and recovery fails on any mismatch.
 */
const EXCHANGE_ADDRESS = (process.env.NEXT_PUBLIC_EXCHANGE_CONTRACT ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

export type OrderIntent = {
  marketId: string;
  /** The outcome token actually traded (binary NO orders pass the real NO outcome). */
  outcome: ApiOutcome;
  side: "yes" | "no";
  action: "buy" | "sell";
  orderType: "MARKET" | "LIMIT";
  /** Price of the SELECTED side in cents, already snapped to the tick grid. */
  priceCents: number;
  shares: number;
  /** Order expiry (unix ms) = the market's endTime — orders live for the
   *  market's whole tradeable life, never expiring early and stranding the
   *  book. Trading is blocked past endTime and settlement cancels the rest. */
  expirationMs: number;
};

/** The exact JSON body POST /orders expects (backend SignedOrder sans signature). */
export type OrderWire = {
  orderId: string;
  marketId: string;
  tokenId: string;
  maker: `0x${string}`;
  side: "BID" | "ASK";
  orderType: "MARKET" | "LIMIT";
  price: string; // decimal string, 0 < p < 1 (e.g. "0.500000")
  amount: string; // decimal shares (e.g. "2.000000")
  expiration: number; // unix ms
  nonce: string;
};

/**
 * Decimal string -> fixed-point bigint, exactly like the backend's
 * parseFixedPointDecimal — the signed bigints and the wire strings MUST parse
 * to the same values or recovery fails.
 */
function toFixedPoint(decimal: string, scale: bigint): bigint {
  const decimals = scale.toString().length - 1;
  const [whole, fraction = ""] = decimal.split(".");
  return (
    BigInt(whole || "0") * scale +
    BigInt(fraction.padEnd(decimals, "0").slice(0, decimals) || "0")
  );
}

/**
 * Binary markets carry a REAL NO token (index 0), and the CLOB matches per
 * token — so a binary NO trade arrives here already resolved by TradePanel:
 * intent.outcome IS the NO outcome and priceCents is quoted on its own book.
 * Encode it directly. Only the non-binary "no" case (no complement token
 * exists; unsupported by the backend) keeps the legacy mirror encoding.
 */
export function buildOrderTypedData(
  intent: OrderIntent,
  maker: `0x${string}`,
  chainId: number,
) {
  // Identify by label, not index — the project-wide binary convention.
  const direct =
    intent.side === "yes" ||
    intent.outcome.label.trim().toLowerCase() === "no";
  const directSide = intent.action === "buy" ? 0 : 1; // BID : ASK
  const side = direct ? directSide : 1 - directSide;
  const priceCents = direct ? intent.priceCents : 100 - intent.priceCents;

  const wire: OrderWire = {
    orderId: crypto.randomUUID(),
    marketId: intent.marketId,
    tokenId: intent.outcome.tokenId,
    maker,
    side: side === 0 ? "BID" : "ASK",
    orderType: intent.orderType,
    price: (priceCents / 100).toFixed(6),
    amount: intent.shares.toFixed(6),
    expiration: intent.expirationMs,
    nonce: String(Date.now()),
  };

  return {
    domain: {
      name: "Veritas CLOB",
      version: "1",
      chainId,
      verifyingContract: EXCHANGE_ADDRESS,
    },
    types: ORDER_TYPES,
    primaryType: "Order" as const,
    message: {
      orderId: wire.orderId,
      marketId: wire.marketId,
      tokenId: wire.tokenId,
      maker,
      side,
      price: toFixedPoint(wire.price, PRICE_SCALE),
      amount: toFixedPoint(wire.amount, AMOUNT_SCALE),
      expiration: BigInt(wire.expiration),
      nonce: BigInt(wire.nonce),
    },
    wire,
  };
}

export type OrderMessage = ReturnType<typeof buildOrderTypedData>["message"];
