"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import Lenis from "lenis";
import { Topbar } from "./Topbar";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";
import { useForgeEntrance } from "./useForgeEntrance";
import { useChapterTimeline } from "./useChapterTimeline";
import {
  COUNT_DESKTOP,
  COUNT_MOBILE,
  SETTLED_MOTION,
  resetSceneMotion,
} from "./three/sceneMotion";
import { supportsWebGL } from "./three/ParticleCanvas";
import { HeroAct } from "./sections/HeroAct";
import { SplitAct } from "./sections/SplitAct";
import { PriceAct } from "./sections/PriceAct";
import { TruthAct } from "./sections/TruthAct";
import { PayoutAct } from "./sections/PayoutAct";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const ParticleCanvas = dynamic(
  () => import("./three/ParticleCanvas").then((m) => m.ParticleCanvas),
  { ssr: false }
);

export default function LandingPage() {
  const reduceMotion = usePrefersReducedMotion();
  // R3F's pointer source. The particle canvas is click-through so the page's
  // own buttons stay reachable; R3F hears the cursor via the page root.
  const rootRef = useRef<HTMLDivElement>(null);
  const [canvasReady, setCanvasReady] = useState(false);
  const [entered, setEntered] = useState(false);

  // Client-only capabilities resolve after mount (SSR renders the plain page).
  const [cinematic, setCinematic] = useState<boolean | null>(null);
  const [count, setCount] = useState(COUNT_DESKTOP);
  useEffect(() => {
    setCinematic(!reduceMotion && supportsWebGL());
    setCount(
      window.matchMedia("(max-width: 767px)").matches
        ? COUNT_MOBILE
        : COUNT_DESKTOP
    );
  }, [reduceMotion]);

  // Non-cinematic path (reduced motion / no WebGL): settled coin, no forge.
  useEffect(() => {
    if (cinematic === false) {
      resetSceneMotion(SETTLED_MOTION);
      setEntered(true);
    }
  }, [cinematic]);

  // Always start at the top on refresh — the forge + choreography assume a
  // scroll-0 start; browser scroll restoration would drop the user mid-page.
  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
  }, []);

  useForgeEntrance({
    enabled: cinematic === true,
    ready: canvasReady,
    onDone: useCallback(() => setEntered(true), []),
  });
  useChapterTimeline(entered && cinematic === true);

  // Slow, weighted smooth-scroll for the landing page only (Lenis unmounts
  // with this component). Drives ScrollTrigger via GSAP's ticker.
  useGSAP(
    () => {
      if (reduceMotion) return;
      // Slow, weighted glide: wheel covers less ground per tick and the
      // easing tail is longer. Touch stays closer to native — fighting
      // finger-tracking feels broken in a way wheel drag never does.
      const lenis = new Lenis({
        duration: 2.2,
        wheelMultiplier: 0.6,
        touchMultiplier: 1.15,
      });
      lenis.on("scroll", ScrollTrigger.update);
      const raf = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(raf);
      gsap.ticker.lagSmoothing(0);
      const onRefresh = () => lenis.resize();
      ScrollTrigger.addEventListener("refresh", onRefresh);
      return () => {
        ScrollTrigger.removeEventListener("refresh", onRefresh);
        gsap.ticker.remove(raf);
        lenis.destroy();
      };
    },
    { dependencies: [reduceMotion] }
  );

  const handleCanvasReady = useCallback(() => setCanvasReady(true), []);

  return (
    <div
      ref={rootRef}
      className={[
        "landing-v2 min-h-screen",
        entered ? "landing-entered" : "",
        cinematic === false ? "landing-rm" : "",
      ].join(" ")}
    >
      {/* The solid loader numeral — a market resolving to certainty. The
          number counts 0→100 in real type, then hands off to a pixel-
          registered particle replica that disintegrates. Size formula
          mirrors the shader's numeral scale: the particle "100" spans
          0.72·min(halfW,halfH) world units at 118px-per-170 raster, which
          reduces to min(25vh, 25vw) of font size. The % is absolutely
          positioned so the numeral's centering (= particle registration)
          never shifts. */}
      <div
        id="count-solid"
        aria-hidden="true"
        className="font-pixel fixed inset-0 z-10 flex items-center justify-center text-fg opacity-0 pointer-events-none"
        style={{ fontSize: "min(25vh, 25vw)", fontWeight: 700 }}
      >
        <span id="count-glyph" className="relative inline-block">
          <span id="count-num">0</span>
          {/* em offsets compute against the %'s OWN 0.22em size — top:1em
              lands its cap on the numeral's cap line, superscript-style */}
          <span
            className="absolute"
            style={{ fontSize: "0.22em", top: "1em", right: "-1.35em" }}
          >
            %
          </span>
        </span>
      </div>
      {/* Loader theater: probability label, YES/NO market rule, status
          line. Satellites of the numeral — they exit before the dissolve
          so the particle 100 stands alone. */}
      <div
        id="count-frame"
        aria-hidden="true"
        className="fixed inset-0 z-10 opacity-0 pointer-events-none select-none"
      >
        <div
          className="absolute left-1/2 -translate-x-1/2 font-mono text-[11px] uppercase tracking-[0.4em] text-muted"
          style={{ top: "calc(50% - min(17vh, 17vw))" }}
        >
          p ( truth )
        </div>
        <div
          className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center gap-3"
          style={{ top: "calc(50% + min(15vh, 15vw))" }}
        >
          <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.3em]">
            <span style={{ color: "var(--yes)" }}>yes</span>
            <div id="count-ticks" className="flex gap-[3px]">
              {Array.from({ length: 40 }, (_, i) => (
                <span
                  key={i}
                  className="h-[10px] w-[3px]"
                  style={{ background: "var(--no)", opacity: 0.28 }}
                />
              ))}
            </div>
            <span id="count-no" style={{ color: "var(--no)" }}>
              no
            </span>
          </div>
          <span
            id="count-status"
            className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted"
          >
            aggregating beliefs
          </span>
        </div>
      </div>
      <Topbar />
      {/* Self-gates on WebGL support (renders null without it). Reduced
          motion still gets the settled coin — just no forge or chapters. */}
      <ParticleCanvas
        onReady={handleCanvasReady}
        interactive={cinematic === true}
        eventSource={rootRef}
        count={count}
      />

      <main id="landing-main" className="relative z-10">
        <HeroAct />
        <SplitAct />
        <PriceAct />
        <TruthAct />
        <PayoutAct />
      </main>
    </div>
  );
}
