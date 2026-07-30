import { useMemo } from "react";
import type { SplitSide } from "./splitSides";

/** Positions generated per side. The rendered count is a share of this, so a
 *  price move adds or removes dots from the end of a FIXED list rather than
 *  relaying the field — the dots that stay, stay put. */
const MAX_STARS = 30;

/** FNV-1a. Only needs to spread ids across the seed space, not to be secure. */
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — small, fast, and good enough for scattering dots. */
function mulberry32(a: number) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Star = {
  left: number;
  top: number;
  size: number;
  opacity: number;
  rise: number;
  blink: number;
  delay: number;
};

/**
 * The drifting field behind a mass.
 *
 * Seeded off the market id and the side, never Math.random(): this renders on
 * the server too, and a random field would differ across hydration — React
 * would either warn or quietly swap every dot on mount.
 */
export function MassField({
  side,
  index,
  marketId,
}: {
  side: SplitSide;
  index: number;
  marketId: string;
}) {
  const stars = useMemo(() => {
    const rand = mulberry32(hashSeed(`${marketId}:${index}`));
    const out: Star[] = [];
    for (let i = 0; i < MAX_STARS; i++) {
      out.push({
        left: rand() * 100,
        top: rand() * 100,
        // A few larger dots stop the field reading as uniform noise.
        size: rand() < 0.22 ? 3 : 2,
        opacity: 0.4 + rand() * 0.6,
        rise: 7 + rand() * 9,
        blink: 1.6 + rand() * 3.4,
        // Negative delay starts each dot mid-cycle, so the field is already
        // running on the first frame instead of every dot lighting at once.
        delay: -rand() * 12,
      });
    }
    return out;
  }, [marketId, index]);

  // Count follows the side's AREA, which keeps density even; the share is
  // carried by brightness instead. Density-proportional was the first
  // instinct, but it leaves a 20% side looking broken rather than unlikely.
  const count = Math.max(3, Math.round((side.pct / 100) * MAX_STARS));
  const lit = 0.45 + 0.55 * (side.pct / 100);
  const tint = side.tone === "yes" ? "bg-yes" : "bg-no";

  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      {stars.slice(0, count).map((s, i) => (
        <span
          key={i}
          className={`mass-star absolute ${tint}`}
          style={
            {
              left: `${s.left}%`,
              top: `${s.top}%`,
              width: `${s.size}px`,
              height: `${s.size}px`,
              "--o": (s.opacity * lit).toFixed(2),
              animationDuration: `${s.rise.toFixed(1)}s, ${s.blink.toFixed(1)}s`,
              animationDelay: `${s.delay.toFixed(1)}s, ${s.delay.toFixed(1)}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
}
