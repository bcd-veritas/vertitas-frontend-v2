/** Blocky 5×5 identicon derived from an address — pixel "avatar". */
export function Identicon({
  seed,
  color,
  className = "h-14 w-14 p-1.5",
}: {
  seed: string;
  color: string;
  /** Size + padding overrides (keep border/bg consistent across uses). */
  className?: string;
}) {
  const s = seed.toLowerCase().replace(/^0x/, "") || "000000";
  const cells: boolean[] = [];
  for (let row = 0; row < 5; row++) {
    const half = [0, 1, 2].map(
      (col) => parseInt(s[(row * 3 + col) % s.length], 16) % 2 === 0,
    );
    cells.push(half[0], half[1], half[2], half[1], half[0]);
  }
  return (
    <svg
      viewBox="0 0 5 5"
      shapeRendering="crispEdges"
      className={`shrink-0 border border-line bg-bg/60 ${className}`}
      aria-hidden="true"
    >
      {cells.map((on, i) =>
        on ? (
          <rect key={i} x={i % 5} y={Math.floor(i / 5)} width={1} height={1} fill={color} />
        ) : null,
      )}
    </svg>
  );
}
