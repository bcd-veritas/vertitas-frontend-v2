import { MonoLabel } from "./ui/MonoLabel";

export function Topbar() {
  return (
    <header className="fade-on-enter fixed top-0 inset-x-0 z-30 flex items-center justify-between px-5 sm:px-8 h-14">
      <span className="font-pixel text-xl tracking-widest text-fg">VERITAS</span>
      <span className="hidden sm:block">
        <MonoLabel>
          <span className="text-yes">Yes</span> / <span className="text-no">No</span> · truth pays
        </MonoLabel>
      </span>
      <a
        href="/home"
        className="font-mono text-[11px] uppercase tracking-[0.25em] border border-line px-4 py-2 text-fg transition-colors hover:border-[var(--yes)] hover:text-[var(--yes)]"
      >
        Launch App
      </a>
    </header>
  );
}
