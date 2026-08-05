"use client";

import { useEffect, useRef } from "react";
import { MonoLabel } from "../ui/MonoLabel";
import { PixelHeading } from "../ui/PixelHeading";

/** Sine-driven fake odds — this is landing cinema, not live market data. */
function useOddsTicker() {
  const yesRef = useRef<HTMLSpanElement>(null);
  const noRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = (now: number) => {
      const t = now / 1000;
      const yes = Math.round(50 + 16 * Math.sin(t * 0.7) + 4 * Math.sin(t * 2.3));
      if (yesRef.current) yesRef.current.textContent = `${yes}¢`;
      if (noRef.current) noRef.current.textContent = `${100 - yes}¢`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return { yesRef, noRef };
}

export function PriceAct() {
  const { yesRef, noRef } = useOddsTicker();
  return (
    <section id="act-price" className="act h-[300vh]">
      <div className="act-sticky items-end pr-[8vw] text-right">
        <div className="act-copy">
          <MonoLabel>02 · The Price</MonoLabel>
          <PixelHeading as="h2" className="act-title mt-4 max-w-[12ch] ml-auto">
            Belief has a price
          </PixelHeading>
          <div className="mt-6 font-pixel text-[clamp(1.6rem,3vw,2.8rem)]">
            <span className="text-yes">
              YES <span ref={yesRef} id="odds-yes">64¢</span>
            </span>
            <span className="text-muted"> · </span>
            <span className="text-no">
              NO <span ref={noRef} id="odds-no">36¢</span>
            </span>
          </div>
          <p className="act-sub ml-auto text-right">
            The two sides braid into a single live price. Trade it any time.
          </p>
        </div>
      </div>
    </section>
  );
}
