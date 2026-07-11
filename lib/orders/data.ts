import type { OrderWire } from "./eip712";

/**
 * Kill switch: when false the flow completes at "signed" and NOTHING is
 * posted (keeps the shared Supabase DB clean). With
 * NEXT_PUBLIC_TRADING_SUBMIT=true, orders post to the middleware's intake.
 */
export const submitEnabled = process.env.NEXT_PUBLIC_TRADING_SUBMIT === "true";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api/v1";

/**
 * POST /orders with the exact wire body the signature was computed over —
 * intake re-derives the signed bigints from these decimal strings
 * (Eip712SignatureVerifier), so the wire object must be passed through
 * untouched.
 */
export async function submitSignedOrder(
  wire: OrderWire,
  signature: string,
): Promise<void> {
  const res = await fetch(`${API}/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...wire, signature }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `order rejected (${res.status})`);
  }
}
