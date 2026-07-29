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

/** What the intake reports back about a submitted order — just enough for the
 *  ticket's confirmation receipt to say what actually happened. */
export type OrderResult = {
  /** Shares matched immediately (0 if the whole order rested on the book). */
  filledShares: number;
};

// Shares are AMOUNT_SCALE (1e8) on the wire, same as the ledger.
const AMOUNT_SCALE = 100_000_000;

/**
 * POST /orders with the exact wire body the signature was computed over —
 * intake re-derives the signed bigints from these decimal strings
 * (Eip712SignatureVerifier), so the wire object must be passed through
 * untouched. Returns how much filled immediately, summed from the match result.
 */
export async function submitSignedOrder(
  wire: OrderWire,
  signature: string,
): Promise<OrderResult> {
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

  const data = (await res.json().catch(() => null)) as {
    matchingResult?: { matchedPairs?: { amount?: string }[] };
  } | null;
  let filledBase = 0n;
  for (const pair of data?.matchingResult?.matchedPairs ?? []) {
    try {
      filledBase += BigInt(pair.amount ?? "0");
    } catch {
      // Non-numeric amount — skip; a wrong receipt shouldn't break the flow.
    }
  }
  return { filledShares: Number(filledBase) / AMOUNT_SCALE };
}
