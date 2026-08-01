/**
 * Progress across a multi-step flow, drawn as a full-bleed segmented bar. It
 * doubles as the rule between a dialog's header and its body, so the header
 * needs no border of its own.
 *
 * Three layers: the segments themselves (how many steps there are), a light
 * that flows along the completed length (that you're moving), and a lit head at
 * the boundary (how far you've got). The head slides to its new position when a
 * step completes, so advancing reads as the glow travelling forward.
 */
export function StepRail({
  steps,
  index,
}: {
  steps: readonly string[];
  index: number;
}) {
  const progress = ((index + 1) / steps.length) * 100;

  return (
    <div
      className="relative"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={steps.length}
      aria-valuenow={index + 1}
      aria-valuetext={`Step ${index + 1} of ${steps.length}: ${steps[index]}`}
    >
      <div className="flex gap-[3px]">
        {steps.map((label, i) => (
          <span key={label} className="h-[3px] flex-1 overflow-hidden bg-line">
            <span
              className={`block h-full w-full origin-left bg-accent transition-transform duration-500 ease-out motion-reduce:transition-none ${
                i <= index ? "scale-x-100" : "scale-x-0"
              }`}
            />
          </span>
        ))}
      </div>

      {/* Clipped to the completed length, so the light never runs past the head. */}
      <div
        aria-hidden="true"
        className="rail-lit pointer-events-none absolute inset-y-0 left-0 overflow-hidden transition-[width] duration-500 ease-out motion-reduce:transition-none"
        style={{ width: `${progress}%` }}
      >
        <span className="rail-flow absolute inset-0 block" />
      </div>

      <span
        aria-hidden="true"
        className="rail-head pointer-events-none absolute top-1/2 -ml-[3px] block h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-accent"
        style={{ left: `${progress}%` }}
      />
    </div>
  );
}
