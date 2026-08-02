import { MonoLabel } from "../ui/MonoLabel";
import { PixelHeading } from "../ui/PixelHeading";

export function HeroAct() {
  return (
    <section id="act-hero" className="act h-[120vh]">
      <div className="act-sticky text-left">
        {/* Hero copy is NOT .act-copy — the forge timeline reveals it (GSAP,
            not the CSS fade-on-enter transition, so the scroll scrub can
            later drive its opacity without transition lag). Absolutely
            anchored: the scoped .act-sticky flex-centering rule outranks
            Tailwind's justify/items utilities. */}
        <div id="hero-copy" className="absolute left-[7vw] bottom-[9vh] z-10 opacity-0">
          <MonoLabel>A prediction market on-chain</MonoLabel>
          <PixelHeading as="h1" className="mt-5 text-[clamp(3.2rem,9vw,8.5rem)]">
            The market
            <br />
            for truth
          </PixelHeading>
          <p className="act-sub">
            Every belief becomes a position. Every outcome settles on-chain.
          </p>
        </div>
        <div className="scroll-cue absolute bottom-8 right-[7vw] opacity-0">
          <MonoLabel>Scroll ↓</MonoLabel>
        </div>
      </div>
    </section>
  );
}
