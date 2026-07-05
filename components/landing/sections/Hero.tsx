import { MonoLabel } from "../ui/MonoLabel";
import { PixelHeading } from "../ui/PixelHeading";
import { AnnotationLine } from "../ui/AnnotationLine";
import { CornerMarks } from "../ui/CornerMarks";

export function Hero() {
  return (
    <section
      id="hero"
      className="relative min-h-screen flex items-center pt-14"
      aria-label="Veritas — prediction markets"
    >
      <CornerMarks />

      {/* Annotations pointing at the token's hero position (center-right) */}
      <div className="hidden lg:block absolute right-[38%] top-[30%]">
        <AnnotationLine side="right" label="mesh.token — usdc collateral" />
      </div>
      <div className="hidden lg:block absolute right-[34%] bottom-[32%]">
        <AnnotationLine side="right" label="probability engine" />
      </div>

      <div className="w-full max-w-7xl mx-auto px-5 sm:px-8 grid lg:grid-cols-2 items-center">
        <div>
          <div className="flex items-center gap-3 mb-6" data-reveal>
            <span className="text-accent" aria-hidden="true">✦</span>
            <MonoLabel>for forecasters, not gamblers</MonoLabel>
          </div>
          <PixelHeading as="h1" className="text-[clamp(3.5rem,9vw,8rem)]" >
            <span className="block" data-reveal>Trade</span>
            <span className="block" data-reveal>what comes</span>
            <span className="block" data-reveal>next.</span>
          </PixelHeading>
          <p className="mt-6 max-w-md text-muted text-lg leading-relaxed" data-reveal>
            Veritas turns real-world questions into live markets. Prices are
            probabilities — back your view and get paid when you&apos;re right.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3" data-reveal>
            <button title="hello world" style={{}} />
            <a href="/home" className="pill pill-solid">Launch App</a>
            <a href="#how" className="pill pill-ghost">How It Works</a>
          </div>
        </div>
        {/* Right column: reserved for the 3D token overlay */}
        <div aria-hidden="true" className="hidden lg:block min-h-[60vh]" />
      </div>

      <div className="absolute bottom-5 left-5 sm:left-8">
        <MonoLabel>sys.id: vrt-landing-01</MonoLabel>
      </div>
      <div className="absolute bottom-5 right-5 sm:right-8">
        <MonoLabel>status: live</MonoLabel>
      </div>
    </section>
  );
}
