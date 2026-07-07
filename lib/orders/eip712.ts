/**
 * Mirrors the middleware's order intake EXACTLY — the "Veritas CLOB" EIP-712
 * struct the backend verifies (src/infra/blockchain/signature/eip712.config.ts)
 * and the SignedOrder body POST /orders expects. If the backend format changes,
 * THIS FILE is the only place to change.
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

/** PRICE_SCALE / AMOUNT_SCALE in the middleware — both 1e8. */
const PRICE_SCALE = 100_000_000n;
const AMOUNT_SCALE = 100_000_000n;

/** Must equal the middleware's EXCHANGE_CONTRACT (the signature domain). */
const EXCHANGE_ADDRESS = (process.env.NEXT_PUBLIC_EXCHANGE_CONTRACT ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

export type OrderIntent = {
  marketId: string;
  /** The real outcome token this order trades (Yes token or No token). */
  tokenId: string;
  action: "buy" | "sell";
  orderType: "MARKET" | "LIMIT";
  /** Price for THIS token, in cents (0–100). */
  priceCents: number;
  shares: number;
};

export type SignedOrderBody = {
  orderId: string;
  marketId: string;
  tokenId: string;
  maker: `0x${string}`;
  side: "BID" | "ASK";
  price: string;
  amount: string;
  orderType: "MARKET" | "LIMIT";
  expiration: number;
  nonce: string;
  signature: string;
};

/** Decimal string -> fixed-point bigint, matching the backend's parseFixedPointDecimal. */
function toFixedPoint(value: string, scale: bigint): bigint {
  const decimals = scale.toString().length - 1;
  const [whole, frac = ""] = value.split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(whole || "0") * scale + BigInt(fracPadded || "0");
}

/**
 * Build the typed data to sign plus the POST body (minus signature). Since the
 * operator seeds both token books and complementary matching is off, each side
 * trades its OWN token directly: buy = BID, sell = ASK, no price flipping.
 */
export function buildOrder(intent: OrderIntent, maker: `0x${string}`, chainId: number) {
  const orderId = crypto.randomUUID();
  const sideNum = intent.action === "buy" ? 0 : 1; // BID : ASK
  const priceStr = (intent.priceCents / 100).toFixed(6);
  const amountStr = String(intent.shares);
  const expiration = Date.now() + 24 * 60 * 60 * 1000; // ms
  const nonce = String(Date.now());

  const typedData = {
    domain: {
      name: "Veritas CLOB",
      version: "1",
      chainId,
      verifyingContract: EXCHANGE_ADDRESS,
    },
    types: ORDER_TYPES,
    primaryType: "Order" as const,
    message: {
      orderId,
      marketId: intent.marketId,
      tokenId: intent.tokenId,
      maker,
      side: sideNum,
      price: toFixedPoint(priceStr, PRICE_SCALE),
      amount: toFixedPoint(amountStr, AMOUNT_SCALE),
      expiration: BigInt(expiration),
      nonce: BigInt(nonce),
    },
  };

  const body: Omit<SignedOrderBody, "signature"> = {
    orderId,
    marketId: intent.marketId,
    tokenId: intent.tokenId,
    maker,
    side: sideNum === 0 ? "BID" : "ASK",
    price: priceStr,
    amount: amountStr,
    orderType: intent.orderType,
    expiration,
    nonce,
  };

  return { typedData, body };
}
