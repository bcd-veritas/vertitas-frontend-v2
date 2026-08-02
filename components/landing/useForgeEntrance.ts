"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { FORM, resetSceneMotion, sceneMotion } from "./three/sceneMotion";
import { splitChars } from "./useChapterTimeline";

gsap.registerPlugin(useGSAP);

/** Full-screen white flash (#forge-flash). Shared with the truth chapter. */
export function flashScreen(peak: number) {
  const el = document.getElementById("forge-flash");
  if (!el) return;
  gsap.fromTo(
    el,
    { opacity: peak },
    { opacity: 0, duration: 1.1, ease: "power2.out", overwrite: "auto" }
  );
}

const SCROLL_LOCK = "overflow-hidden";

/**
 * The dissolve: ~8.5s time-driven entrance, every load, no skip.
 * A SOLID pixel-type counter (#count-solid, real DOM text) runs 0 → 100
 * with a jerky loader rhythm (0–3.4) → gradual handover: the pixel-
 * registered particle replica breathes in beneath the solid type, which
 * melts into a blur as it cedes (3.55–4.5) → the number grains up and
 * disintegrates, edges first — a true dissolve, not a fade (4.4–5.3) →
 * the loosened cloud flows into the coin, no flash (5.3–6.4) → settles
 * into the hero pose; headline pops in char by char (6.5–8.5). Scroll is
 * locked throughout.
 */
export function useForgeEntrance({
  enabled,
  ready,
  onDone,
}: {
  enabled: boolean;
  /** canvas has rendered a frame — don't run the show to an empty screen */
  ready: boolean;
  onDone: () => void;
}) {
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useGSAP(
    () => {
      if (!enabled || !ready) return;
      resetSceneMotion();
      document.documentElement.classList.add(SCROLL_LOCK);
      window.scrollTo(0, 0);

      const m = sceneMotion;
      const h1 = document.querySelector<HTMLElement>("#hero-copy h1");
      if (h1) splitChars(h1);

      // The SOLID counter (real DOM text). Particles stay hidden until 100.
      const solidEl = document.getElementById("count-solid");
      const counter = { v: 0 };
      const setNum = () => {
        if (solidEl) solidEl.textContent = String(Math.round(counter.v));
      };
      setNum();

      const tl = gsap.timeline({
        onComplete: () => {
          document.documentElement.classList.remove(SCROLL_LOCK);
          onDoneRef.current();
        },
      });
      // ── The count: SOLID type runs 0 → 100 like a REAL loader —
      // bursts, stutters, the classic stall at 83, then the snap ──
      tl.to("#count-solid", { autoAlpha: 1, duration: 0.5, ease: "power2.out" }, 0.1)
        .to(counter, { v: 12, duration: 0.3, ease: "power3.in", onUpdate: setNum }, 0.5)
        // stall…
        .to(counter, { v: 17, duration: 0.35, ease: "steps(5)", onUpdate: setNum }, 1.05)
        .to(counter, { v: 46, duration: 0.22, ease: "power2.in", onUpdate: setNum }, 1.55)
        .to(counter, { v: 51, duration: 0.3, ease: "steps(5)", onUpdate: setNum }, 1.8)
        // burst
        .to(counter, { v: 83, duration: 0.28, ease: "power1.inOut", onUpdate: setNum }, 2.3)
        // the long 83 stall everyone knows…
        .to(counter, { v: 99, duration: 0.22, ease: "power3.in", onUpdate: setNum }, 3.0)
        .to(counter, { v: 100, duration: 0.08, ease: "none", onUpdate: setNum }, 3.35)
        .to(m, { bgGlow: 0.5, duration: 2.9, ease: "power1.in" }, 0.4)
        .to(m, { zoom: 1.06, duration: 3.2, ease: "none" }, 0.2)
        // ── The handover: the particle "100" breathes in BENEATH the solid
        // type (both overlap — a complete 100 is always on screen), then
        // the solid melts into a soft blur as it cedes. No hard cut. ──
        .to(m, { alpha: 1, duration: 0.7, ease: "power1.inOut" }, 3.55)
        .set("#count-solid", { filter: "blur(0px)" }, 3.75)
        .to(
          "#count-solid",
          { autoAlpha: 0, filter: "blur(6px)", duration: 0.7, ease: "power1.in" },
          3.8
        )
        // ── The dissolve: it grains up and frays apart, edges first ──
        .to(m, { dissolve: 1, tint: 0.7, bgGlow: 0.9, duration: 0.9, ease: "power2.in" }, 4.4)
        // ── The loosened cloud flows into the coin — no flash; the
        // formation itself is the moment ──
        .set(m, { formA: FORM.COUNT, formB: FORM.COIN, mix: 0, turb: 0.9 }, 5.3)
        .to(m, { mix: 1, duration: 1.1, ease: "power2.inOut" }, 5.3)
        // ── Settle into the hero ──
        .to(m, { zoom: 1, spinSpeed: 0.35, tint: 0.6, bgGlow: 1, turb: 0, dissolve: 0, duration: 1.1, ease: "power2.out" }, 6.45)
        // ── Reveal: headline pops in char by char ──
        .to("#hero-copy, .scroll-cue", { autoAlpha: 1, duration: 0.4, ease: "power1.out" }, 6.85)
        .fromTo(
          "#hero-copy .char",
          { opacity: 0, y: "0.5em" },
          { opacity: 1, y: 0, duration: 0.45, stagger: 0.028, ease: "back.out(2)" },
          6.9
        )
        .fromTo(
          "#hero-copy > :not(h1)",
          { opacity: 0, y: 8 },
          { opacity: 1, y: 0, duration: 0.6, stagger: 0.15, ease: "power2.out" },
          7.35
        );

      return () => {
        document.documentElement.classList.remove(SCROLL_LOCK);
        tl.kill();
      };
    },
    { dependencies: [enabled, ready] }
  );
}
