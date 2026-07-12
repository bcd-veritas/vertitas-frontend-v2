import type { OrderWire } from "./eip712";

/**
 * Kill switch: when false the flow completes at "signed" and NOTHING is
 * posted (keeps the shared Supabase DB clean). With
 * NEXT_PUBLIC_TRADING_SUBMIT=true, orders post to the middleware's intake.
 */
export const submitEnabled = process.env.NEXT_PUBLIC_TRADING_SUBMIT === "true";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api/v1";

export type OrderRejectionDetails = Record<string, string | number>;

/** A backend order rejection with its stable code + structured details. */
export class OrderRejectedError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly details?: OrderRejectionDetails,
  ) {
    super(message);
    this.name = "OrderRejectedError";
  }
}

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
    const body = (await res.json().catch(() => null)) as {
      code?: string;
      message?: string;
      details?: OrderRejectionDetails;
    } | null;
    throw new OrderRejectedError(
      body?.message ?? `order rejected (${res.status})`,
      body?.code,
      body?.details,
    );
  }
}
