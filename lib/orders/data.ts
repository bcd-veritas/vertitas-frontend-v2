import type { SignedOrderBody } from "./eip712";

/**
 * Kill switch for live submission. When false the flow completes at "signed"
 * and nothing is posted. Flip NEXT_PUBLIC_TRADING_SUBMIT=true to go live.
 */
export const submitEnabled = process.env.NEXT_PUBLIC_TRADING_SUBMIT === "true";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api/v1";

/** POST a fully-signed order to the middleware's order intake. */
export async function submitSignedOrder(order: SignedOrderBody): Promise<void> {
  const res = await fetch(`${API}/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(order),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `order rejected (${res.status})`);
  }
}
