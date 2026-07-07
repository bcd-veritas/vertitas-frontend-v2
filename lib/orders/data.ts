import type { OrderIntent, OrderMessage } from "./eip712";

/**
 * Kill switch while the backend team reworks order intake: when false the
 * flow completes at "signed" and NOTHING is posted (keeps the shared
 * Supabase DB clean). Flip NEXT_PUBLIC_TRADING_SUBMIT=true and update the
 * body below to their final wire shape to go live.
 */
export const submitEnabled = process.env.NEXT_PUBLIC_TRADING_SUBMIT === "true";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api/v1";

export async function submitSignedOrder(
  intent: OrderIntent,
  message: OrderMessage,
  signature: string,
): Promise<void> {
  const res = await fetch(`${API}/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      marketId: intent.marketId,
      tokenId: intent.outcome.tokenId,
      outcomeIndex: Number(message.outcomeIndex),
      maker: message.maker,
      side: message.side === 0 ? "BID" : "ASK",
      orderType: intent.orderType,
      price: (Number(message.price) / 1_000_000).toString(),
      amount: (Number(message.quantity) / 1_000_000).toString(),
      nonce: message.nonce.toString(),
      expiration: Number(message.expiration) * 1000,
      salt: message.salt,
      signature,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `order rejected (${res.status})`);
  }
}
