import type { ApiMarket, ApiOutcome } from "./types";

/** Middleware fixed-point price scale: 1e6 == 1.00 == 100%. */
const PRICE_SCALE = 1_000_000;

/** Fixed-point price string -> 0–1 fraction, or null when unpriced (null/≤0). */
export function chanceFraction(price: string | null): number | null {
  if (price == null) return null;
  const f = Number(price) / PRICE_SCALE;
  return f > 0 ? f : null;
}

/**
 * Fixed-point price string -> percentage to one decimal (e.g. 49.5), or null
 * when there's no real price. Sub-0.1% reads as unpriced (empty books, and
 * junk seed prices like "1" == 1e-8) rather than a misleading "0.0%".
 */
export function chancePct(price: string | null): number | null {
  const f = chanceFraction(price);
  if (f == null) return null;
  const pct = f * 100;
  return pct >= 0.1 ? Math.round(pct * 10) / 10 : null;
}

/**
 * The YES outcome of a pure Yes/No market, else null. Binary markets render
 * as one row (the YES row), but the NO outcome is a real token with its own
 * book — NO prices/trades must be read from it, not mirrored from YES.
 */
export function binaryYesOutcome(outcomes: ApiOutcome[]): ApiOutcome | null {
  if (outcomes.length !== 2) return null;
  const yes = outcomes.find((o) => o.label.trim().toLowerCase() === "yes");
  const no = outcomes.find((o) => o.label.trim().toLowerCase() === "no");
  return yes && no ? yes : null;
}

export type RankedOutcome = { outcome: ApiOutcome; pct: number | null };

/** Outcomes sorted by chance desc, with unpriced ones sunk to the bottom. */
export function rankedOutcomes(m: ApiMarket): RankedOutcome[] {
  return m.outcomes
    .map((o) => ({ outcome: o, pct: chancePct(o.price) }))
    .sort((a, b) => {
      if (a.pct === b.pct) return 0;
      if (a.pct == null) return 1;
      if (b.pct == null) return -1;
      return b.pct - a.pct;
    });
}

/** Payout multiplier for a side priced 0–1: 1/price. "—" when unpriced. */
export function multiplier(price: number | null): string {
  if (!price || price <= 0) return "—";
  const v = 1 / price;
  return `${v >= 10 ? v.toFixed(1) : v.toFixed(2)}x`;
}

/** "31422067000000" (6-dec USDC) -> "$31,422,067 VOL" */
export function formatVol(volume: string): string {
  const dollars = BigInt(volume) / 1_000_000n;
  return `$${dollars.toLocaleString("en-US")} VOL`;
}

/** Volume for dense lists — "$18.6M VOL", "$1.1K VOL", "$152 VOL".
 *  formatVol prints the figure in full, which reads fine on a card but makes a
 *  list column lurch between "$1 VOL" and "$18,587,500 VOL". */
export function formatVolCompact(volume: string): string {
  const dollars = Number(BigInt(volume) / 1_000_000n);
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M VOL`;
  if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(1)}K VOL`;
  return `$${dollars} VOL`;
}

/** ISO -> "MAR 1 @ 11:00PM" (UTC, so SSR and client agree) */
export function closesLabel(iso: string): string {
  const d = new Date(iso);
  const month = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const time = d
    .toLocaleString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "UTC",
    })
    .replace(" ", "");
  return `${month} ${d.getUTCDate()} @ ${time}`.toUpperCase();
}

/** Mission-clock countdown: "T-27D" / "T-16H" / "T-42M" / "CLOSED" */
export function countdown(iso: string, now: number = Date.now()): string {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return "CLOSED";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `T-${mins}M`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `T-${hours}H`;
  return `T-${Math.floor(hours / 24)}D`;
}

/** Two-unit countdown for the board card: "37d02h" / "04h09m" / "12m30s" /
 *  "CLOSED". Always shows a second unit so the readout never jumps width
 *  class as a market approaches close. */
export function countdownPair(iso: string, now: number = Date.now()): string {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return "CLOSED";
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86_400);
  const h = Math.floor((totalSec % 86_400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (d > 0) return `${d}D ${pad(h)}H`;
  if (h > 0) return `${h}H ${pad(m)}M`;
  return `${m}M ${pad(s)}S`;
}

/** Fixed-point price string (1e6 == 100%) -> cents number: "620000" -> 62. */
export function toCents(price: string): number {
  return Number(price) / 10_000;
}

/**
 * One-decimal display that drops a redundant trailing ".0":
 * 59.9 -> "59.9", 50 -> "50", 46.0 -> "46".
 */
export function oneDp(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

/** Fixed-point price -> "62¢" / "61.5¢" (one decimal, trailing ".0" dropped). */
export function centsLabel(price: string): string {
  return `${oneDp(toCents(price))}¢`;
}

/** Fixed-point share quantity (1e6 == 1 share) -> "1,250" (whole shares). */
export function sharesLabel(quantity: string): string {
  return (BigInt(quantity) / 1_000_000n).toLocaleString("en-US");
}
