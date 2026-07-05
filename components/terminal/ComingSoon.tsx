/** A panel-styled placeholder for terminal sections whose data isn't wired yet. */
export function ComingSoonPanel({
  heading,
  minHeight = "min-h-[280px]",
}: {
  heading: string;
  minHeight?: string;
}) {
  return (
    <section className="relative bg-surface/70 border border-line rounded-xl overflow-hidden">
      <span aria-hidden="true" className="absolute top-2.5 right-3 font-mono text-muted/40 text-xs select-none">+</span>
      <div className="px-5 pt-4">
        <h2 className="font-pixel text-xl tracking-wide text-fg/60">{heading}</h2>
      </div>
      <div className={`flex flex-col items-center justify-center gap-3 ${minHeight} px-5 pb-6`}>
        <span aria-hidden="true" className="w-12 border-b border-dashed border-line" />
        <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted/70">coming soon</span>
        <span aria-hidden="true" className="w-12 border-b border-dashed border-line" />
      </div>
    </section>
  );
}

/** Inline "coming soon" body, e.g. inside a tab panel. */
export function ComingSoonBody({ minHeight = "min-h-[160px]" }: { minHeight?: string }) {
  return (
    <div className={`flex items-center justify-center ${minHeight}`}>
      <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted/70">coming soon</span>
    </div>
  );
}
