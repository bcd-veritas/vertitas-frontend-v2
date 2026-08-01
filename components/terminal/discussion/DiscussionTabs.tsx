"use client";

/**
 * The tab bar. Counts are the whole point: four unlabelled tabs each needed a
 * click to discover whether they were empty, and on a quiet market all four
 * are. `dot` replaces the count on Your Position, where a number is meaningless.
 */
export function DiscussionTabs({
  tabs,
  active,
  onSelect,
}: {
  tabs: { id: string; label: string; count?: number; dot?: boolean }[];
  active: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Sections"
      className="flex flex-wrap items-center gap-0.5 border-b border-line px-3"
    >
      {tabs.map(({ id, label, count, dot }) => {
        const on = active === id;
        return (
          <button
            key={id}
            role="tab"
            aria-selected={on}
            onClick={() => onSelect(id)}
            className={`relative flex items-center gap-1.5 px-3 py-2.5 font-mono text-[11px] tracking-[0.14em] uppercase transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ${
              on ? "text-fg" : "text-muted hover:text-fg/80"
            }`}
          >
            {label}
            {dot ? (
              <span
                aria-hidden="true"
                className="h-[5px] w-[5px] rounded-full bg-yes"
              />
            ) : count != null ? (
              <span
                className={`min-w-[1.35rem] rounded-[3px] px-1 py-px text-center font-mono text-[10px] tracking-[0.04em] tabular-nums ${
                  on ? "bg-accent text-bg" : "bg-white/[0.06] text-fg/45"
                }`}
              >
                {count.toLocaleString("en-US")}
              </span>
            ) : null}
            {on && (
              <span
                aria-hidden="true"
                className="absolute right-2 -bottom-px left-2 h-[2px] bg-accent"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
