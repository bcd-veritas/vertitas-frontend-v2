"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import Lenis from "lenis";
import { Topbar } from "./Topbar";
import { Loader } from "./Loader";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";
import { useTokenScrollTimeline } from "./useTokenScrollTimeline";
import { Hero } from "./sections/Hero";
import { HowItWorks } from "./sections/HowItWorks";
import { MarketsTeaser } from "./sections/MarketsTeaser";
import { Resolution } from "./sections/Resolution";
import { FinalCta } from "./sections/FinalCta";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const TokenCanvas = dynamic(
  () => import("./three/TokenCanvas").then((m) => m.TokenCanvas),
  { ssr: false }
);

function subscribeNoop() {
  return () => { };
}

function getSkipSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getSkipServerSnapshot() {
  return false;
}

export default function LandingPage() {
  const reduceMotion = usePrefersReducedMotion();
  const [canvasReady, setCanvasReady] = useState(false);
  const [revealed, setRevealed] = useState(false);

  // Loader plays on every page load; skipped only for reduced motion.
  // Server snapshot is `false` so SSR renders loader-visible/main-invisible;
  // React re-renders with the real client value after hydration.
  const skip = useSyncExternalStore(
    subscribeNoop,
    getSkipSnapshot,
    getSkipServerSnapshot
  );

  // `revealed` flips when the loader's exit ride STARTS: the page assembles
  // beneath the rising curtain while the pixel number is still traveling up.
  const entered = skip || revealed;

  // Always start at the top on refresh — the loader + choreography assume a
  // scroll-0 start; browser scroll restoration would drop the user mid-page.
  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
  }, []);

  useTokenScrollTimeline(entered && !reduceMotion);

  // Slow, weighted smooth-scroll for the landing page only (Lenis unmounts
  // with this component). Drives ScrollTrigger via GSAP's ticker.
  useGSAP(
    () => {
      if (reduceMotion) return;
      const lenis = new Lenis({
        duration: 1.7,
        wheelMultiplier: 0.85,
        touchMultiplier: 1.4,
      });
      lenis.on("scroll", ScrollTrigger.update);
      const raf = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(raf);
      gsap.ticker.lagSmoothing(0);
      // Lenis caches the page height at init — but the lifecycle pin adds
      // its spacer AFTER the loader reveal, so re-measure on every
      // ScrollTrigger refresh or Lenis will refuse to scroll past the stale
      // maximum (scroll jams mid-pin).
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
  const handleReveal = useCallback(() => setRevealed(true), []);

  // Scroll reveals for [data-reveal] — plain fades under reduced motion.
  useGSAP(
    () => {
      if (!entered) return;
      const items = gsap.utils.toArray<HTMLElement>("[data-reveal]");
      items.forEach((el) => {
        gsap.from(el, {
          opacity: 0,
          y: reduceMotion ? 0 : 24,
          duration: reduceMotion ? 0.3 : 0.7,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
        });
      });
    },
    { dependencies: [entered, reduceMotion] }
  );

  return (
    <div className="dot-grid min-h-screen">
      {/* Loader unmounts itself after the exit ride completes */}
      {!skip && <Loader ready={canvasReady} onReveal={handleReveal} />}
      <Topbar />
      <TokenCanvas onReady={handleCanvasReady} interactive={!reduceMotion} />
      <main id="landing-main" className={entered ? "" : "invisible"}>
        <Hero />
        <HowItWorks />
        <MarketsTeaser />
        <Resolution />
        <FinalCta />
      </main>
    </div>
  );
}
