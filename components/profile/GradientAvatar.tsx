import { hashAddress } from "@/lib/profile/mock";

/**
 * Circle filled with a 3-color conic gradient derived from the seed (wallet
 * address) — "random"-looking but stable per user. Pure string math: SSR-safe.
 */
export function GradientAvatar({
  seed,
  size,
  className,
}: {
  seed: string;
  size: number;
  className?: string;
}) {
  const h = hashAddress(seed.toLowerCase());
  const h1 = h % 360;
  const h2 = (h1 + 120 + ((h >>> 8) % 40)) % 360;
  const h3 = (h1 + 240 + ((h >>> 16) % 40)) % 360;
  const stop = (hue: number) => `hsl(${hue} 55% 62%)`;

  return (
    <span
      aria-hidden="true"
      className={`inline-block rounded-full shrink-0 ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        background: `conic-gradient(${stop(h1)}, ${stop(h2)}, ${stop(h3)}, ${stop(h1)})`,
      }}
    />
  );
}
