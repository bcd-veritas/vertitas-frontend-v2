import type { CSSProperties, ReactNode } from "react";

/**
 * Schematic panel chrome shared by every terminal section: square corners,
 * hairline border, an etched label notched into the top rule, and four
 * corner ticks that take the panel's accent. The accent transitions, so a
 * panel can be "flooded" by an outcome color (the trade ticket does this).
 */
export function Frame({
  label,
  right,
  accent = "var(--color-line)",
  tickColor,
  className = "",
  children,
  ariaLabel,
}: {
  /** Etched into the top border, mono uppercase. */
  label: string;
  /** Optional right-aligned slot on the label rule (tabs, timeframes). */
  right?: ReactNode;
  /** Border + label color; defaults to the hairline. */
  accent?: string;
  /** Corner tick color; defaults to accent. */
  tickColor?: string;
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
}) {
  const ticks = tickColor ?? accent;
  const tickBase: CSSProperties = { borderColor: ticks };
  return (
    <section
      className={`relative border bg-surface/40 transition-colors duration-300 ${className}`}
      style={{ borderColor: accent }}
      aria-label={ariaLabel ?? label}
    >
      {/* Corner ticks */}
      <span aria-hidden="true" className="absolute -top-px -left-px w-2.5 h-2.5 border-t-2 border-l-2 transition-colors duration-300" style={tickBase} />
      <span aria-hidden="true" className="absolute -top-px -right-px w-2.5 h-2.5 border-t-2 border-r-2 transition-colors duration-300" style={tickBase} />
      <span aria-hidden="true" className="absolute -bottom-px -left-px w-2.5 h-2.5 border-b-2 border-l-2 transition-colors duration-300" style={tickBase} />
      <span aria-hidden="true" className="absolute -bottom-px -right-px w-2.5 h-2.5 border-b-2 border-r-2 transition-colors duration-300" style={tickBase} />

      {/* Label rule — pinned to the top border so caller padding can't push it */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex -translate-y-1/2 items-center justify-between gap-3 px-4">
        <span
          className="pointer-events-auto bg-bg px-2 font-mono text-[15px] font-semibold uppercase tracking-[0.16em] transition-colors duration-300"
          style={{ color: tickColor ?? "var(--color-fg)" }}
        >
          {label}
        </span>
        {right && <span className="pointer-events-auto bg-bg px-2 flex items-center">{right}</span>}
      </div>

      {/* Spacer standing in for the label's old flow height, so content
          below keeps its distance from the top rule. */}
      <div className="h-5" aria-hidden="true" />

      {children}
    </section>
  );
}
