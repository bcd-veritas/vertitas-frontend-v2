import { MonoLabel } from "../ui/MonoLabel";
import { CornerMarks } from "../ui/CornerMarks";

export function FinalCta() {
  return (
    <section
      id="cta"
      className="relative min-h-screen flex flex-col items-center justify-end pb-16 pt-40"
      aria-label="Launch Veritas"
    >
      <CornerMarks />
      {/* Empty upper space: the token returns to center stage here */}
      <div className="text-center px-5">
        <h2
          className="font-pixel uppercase leading-none text-[clamp(4rem,14vw,12rem)] text-fg"
          data-reveal
        >
          Veritas
        </h2>
        <MonoLabel className="block mt-2" data-reveal>primary identity mark</MonoLabel>
        <div className="mt-10" data-reveal>
          <a href="/home" className="pill pill-solid">Launch App</a>
        </div>
      </div>
      <footer className="mt-24 w-full max-w-7xl mx-auto px-5 sm:px-8 pt-6 border-t border-line flex flex-wrap items-center justify-between gap-3">
        <MonoLabel>© 2026 veritas — prediction markets</MonoLabel>
        <MonoLabel>built on-chain // settled by truth</MonoLabel>
      </footer>
    </section>
  );
}
