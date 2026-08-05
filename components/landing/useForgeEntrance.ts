"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import {
  FORM,
  INK_HEX,
  YES_HEX,
  resetSceneMotion,
  sceneMotion,
} from "./three/sceneMotion";
import { splitChars } from "./useChapterTimeline";

gsap.registerPlugin(useGSAP);

const SCROLL_LOCK = "overflow-hidden";

/**
 * The dissolve: ~8.5s time-driven entrance, every load, no skip.
 * A SOLID pixel-type counter (#count-solid, real DOM text) runs 0 → 100
 * with a jerky loader rhythm (0–3.4), dressed as a market resolving:
 * "P(truth)" above, % on the numeral, a YES/NO tick rule filling mint
 * beneath, a status line swapping on the stall/burst beats, the numeral
 * tinting mint as certainty climbs → theater exits, gradual handover:
 * the pixel-registered particle replica breathes in beneath the solid
 * type, which melts into a blur as it cedes (3.55–4.5) → the number
 * grains up and disintegrates, edges first — a true dissolve, not a
 * fade (4.4–5.1) → the COLLAPSE: the cloud swirls tight and falls into
 * a single blinding star, world draining dark (5.0–5.65), one held
 * beat (→5.9) → the BIRTH: the coin detonates out of the point — rim
 * ring first, face condensing, $ stamping last with a camera kick
 * (5.9–6.9) → settles into the hero pose; headline pops in char by
 * char (6.85–8.5). Scroll is locked throughout.
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

      // The SOLID counter (real DOM text), dressed as a market resolving
      // to certainty: the numeral tints toward mint as probability climbs,
      // a YES/NO tick rule fills beneath it, and NO concedes near the top.
      // Particles stay hidden until 100.
      const numEl = document.getElementById("count-num");
      const glyphEl = document.getElementById("count-glyph");
      const noEl = document.getElementById("count-no");
      const ticks = gsap.utils.toArray<HTMLElement>("#count-ticks span");
      const tint = gsap.utils.interpolate(INK_HEX, YES_HEX);
      const counter = { v: 0 };
      const setNum = () => {
        const v = Math.round(counter.v);
        if (numEl) numEl.textContent = String(v);
        // Quadratic ramp: mostly ink early, mint rushing in near 100.
        const t = Math.min(1, counter.v / 100);
        if (glyphEl) glyphEl.style.color = tint(t * t);
        const filled = Math.round((v / 100) * ticks.length);
        ticks.forEach((el, i) => {
          const on = i < filled;
          el.style.background = on ? "var(--yes)" : "var(--no)";
          el.style.opacity = on ? "0.9" : "0.28";
        });
        if (noEl)
          noEl.style.opacity = String(1 - 0.8 * Math.max(0, (v - 80) / 20));
      };
      setNum();

      // Status line beats — swapped on the loader's stalls and bursts so
      // the jerky rhythm reads as real work being done.
      const STATUS: [number, string][] = [
        [1.05, "weighing positions"],
        [1.8, "pricing outcomes"],
        [2.3, "verifying on-chain"],
        [3.0, "settling truth"],
      ];
      const setStatus = (msg: string, color?: string) => () => {
        const s = document.getElementById("count-status");
        if (!s) return;
        s.textContent = msg;
        if (color) s.style.color = color;
      };

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
        .to(m, { dissolve: 1, tint: 0.7, bgGlow: 0.7, duration: 0.7, ease: "power2.in" }, 4.4)
        // ── The collapse: every belief falls into ONE point — the frayed
        // cloud swirls tighter (spin-up rotates the source form) and packs
        // into a single blinding star while the world drains dark. The
        // brightness spike is free physics: additive blending × density. ──
        .set(m, { formA: FORM.COUNT, formB: FORM.POINT, mix: 0, turb: 0.55 }, 5.0)
        .to(m, { mix: 1, duration: 0.65, ease: "power3.in" }, 5.0)
        .to(m, { spinSpeed: 3, duration: 0.65, ease: "power2.in" }, 5.0)
        .to(m, { zoom: 1.2, duration: 0.65, ease: "power2.in" }, 5.0)
        .to(m, { bgGlow: 0.08, duration: 0.6, ease: "power1.in" }, 5.05)
        // …one held beat: black void, one star (5.65 – 5.9)…
        // ── The birth: the coin detonates out of the point. kindLag
        // orders the arrival — rim ring erupts first, face condenses
        // behind it, the $ stamps last. Camera kicks back; nebula
        // ignites; spin sheds down to the hero's idle. ──
        .set(m, { formA: FORM.POINT, formB: FORM.COIN, mix: 0, turb: 0.25, dissolve: 0, kindLag: 1 }, 5.9)
        .to(m, { mix: 1, duration: 1.0, ease: "power2.out" }, 5.9)
        .to(m, { zoom: 1, duration: 0.65, ease: "power3.out" }, 5.9)
        .to(m, { bgGlow: 1, duration: 1.2, ease: "power1.inOut" }, 5.95)
        .to(m, { spinSpeed: 0.35, duration: 1.0, ease: "power2.out" }, 6.1)
        // the $ stamp lands — a tiny camera kick, not a flash
        .to(m, { zoom: 1.035, duration: 0.09, yoyo: true, repeat: 1, ease: "power2.out" }, 6.62)
        // ── Settle into the hero ──
        .to(m, { tint: 0.6, turb: 0, duration: 0.9, ease: "power2.out" }, 6.9)
        // kindLag is SET back (never tweened — mid values un-complete a
        // finished morph); safe here, both endpoints yield mix=1 → coin
        .set(m, { kindLag: 0 }, 7.0)
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

      // ── Loader theater (satellites of the numeral) ──
      tl.to("#count-frame", { autoAlpha: 1, duration: 0.5, ease: "power2.out" }, 0.25)
        // exits before the dissolve so the particle 100 stands alone
        .to(
          "#count-frame",
          { autoAlpha: 0, filter: "blur(4px)", duration: 0.55, ease: "power1.in" },
          3.75
        )
        // the mint numeral returns to ink as the (ink) particle replica
        // breathes in beneath it — the blur melt masks the shift
        .to("#count-glyph", { color: INK_HEX, duration: 0.5, ease: "power1.inOut" }, 3.55);

      // Status swaps: quick ticker flick down-and-in on each beat.
      for (const [t, msg] of STATUS) {
        tl.to("#count-status", { opacity: 0, y: -5, duration: 0.12, ease: "power1.in" }, t)
          .call(setStatus(msg), undefined, t + 0.12)
          .fromTo(
            "#count-status",
            { opacity: 0, y: 5 },
            { opacity: 1, y: 0, duration: 0.16, ease: "power1.out" },
            t + 0.13
          );
      }
      // The verdict beat: the market locks mint.
      tl.to("#count-status", { opacity: 0, y: -5, duration: 0.1, ease: "power1.in" }, 3.38)
        .call(setStatus("consensus reached", YES_HEX), undefined, 3.48)
        .fromTo(
          "#count-status",
          { opacity: 0, y: 5 },
          { opacity: 1, y: 0, duration: 0.18, ease: "power1.out" },
          3.49
        );

      // Physical punch: the numeral kicks on each burst, hardest at 100.
      for (const t of [1.55, 2.3, 3.0]) {
        tl.fromTo(
          "#count-glyph",
          { scale: 1 },
          { scale: 1.045, duration: 0.07, yoyo: true, repeat: 1, ease: "power2.out" },
          t
        );
      }
      tl.fromTo(
        "#count-glyph",
        { scale: 1 },
        { scale: 1.09, duration: 0.09, yoyo: true, repeat: 1, ease: "power2.out" },
        3.35
      );

      return () => {
        document.documentElement.classList.remove(SCROLL_LOCK);
        tl.kill();
      };
    },
    { dependencies: [enabled, ready] }
  );
}
