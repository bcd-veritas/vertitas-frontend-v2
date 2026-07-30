import type { ApiMarket } from "@/lib/markets/types";
import { rankedOutcomes } from "@/lib/markets/format";

/** One coloured mass in the card's split block. */
export type SplitSide = {
  label: string;
  pct: number;
  tone: "yes" | "no";
};

/** Yes reads green, No reads red; for 3+ outcomes the leader is green and the
 *  combined field red. Matched on the LABEL — outcome.index is not a reliable
 *  Yes/No signal. */
function toneFor(label: string, rank: number): "yes" | "no" {
  const l = label.trim().toLowerCase();
  if (l === "yes") return "yes";
  if (l === "no") return "no";
  return rank === 0 ? "yes" : "no";
}

/**
 * The card's two masses, or null when the market has no usable price.
 *
 * Binary markets keep a FIXED Yes-left / No-right order rather than
 * leader-first: if the sides swapped as a price crossed 50%, a market drifting
 * across the midpoint would visibly flip its own card and the grid would churn
 * for no informational gain.
 *
 * For 3+ outcomes the masses are leader vs. the combined field. Rendering the
 * top two normalised to full width would imply a ratio that does not exist —
 * 41/27 would read as 60/40.
 */
export function splitSides(market: ApiMarket): SplitSide[] | null {
  const ranked = rankedOutcomes(market);
  const lead = ranked[0];
  if (!lead || lead.pct == null) return null;

  if (ranked.length === 2) {
    const yes = ranked.find(
      (r) => r.outcome.label.trim().toLowerCase() === "yes",
    );
    const no = ranked.find(
      (r) => r.outcome.label.trim().toLowerCase() === "no",
    );

    // A true Yes/No pair renders in fixed order.
    if (yes && no) {
      const yesPct = yes.pct;
      const noPct = no.pct;

      // If one side is null, derive it from the other: a settled market has one side
      // at 100% and the other at ~0% (which chancePct may null instead of 0).
      if (yesPct == null && noPct == null) return null;

      // Clamp: an upstream price >100% would otherwise derive a negative
      // counterpart, and `flexGrow: -N` is invalid CSS that silently
      // collapses to 0 rather than erroring.
      const derivedYesPct: number =
        yesPct ?? Math.max(0, Math.round((100 - noPct!) * 10) / 10);
      const derivedNoPct: number =
        noPct ?? Math.max(0, Math.round((100 - yesPct!) * 10) / 10);

      return [
        { label: yes.outcome.label, pct: derivedYesPct, tone: "yes" },
        { label: no.outcome.label, pct: derivedNoPct, tone: "no" },
      ];
    }

    // Two outcomes that aren't Yes/No (e.g. two named candidates): leader first.
    const other = ranked[1];
    let otherPct: number;

    // If the non-leader side is null, derive it from the leader: a settled market has
    // the loser at ~0% (which chancePct may null instead of 0).
    if (other.pct == null) {
      otherPct = Math.max(0, Math.round((100 - lead.pct) * 10) / 10);
    } else {
      otherPct = other.pct;
    }

    return [
      { label: lead.outcome.label, pct: lead.pct, tone: toneFor(lead.outcome.label, 0) },
      { label: other.outcome.label, pct: otherPct, tone: toneFor(other.outcome.label, 1) },
    ];
  }

  const field = Math.max(0, Math.round((100 - lead.pct) * 10) / 10);
  if (field <= 0) return null;
  return [
    { label: lead.outcome.label, pct: lead.pct, tone: "yes" },
    { label: "Field", pct: field, tone: "no" },
  ];
}
