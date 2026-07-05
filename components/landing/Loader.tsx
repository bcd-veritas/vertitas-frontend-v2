"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

export function Loader({
  ready,
  onReveal,
}: {
  ready: boolean;
  /** Fired when the exit ride STARTS — the page reveals beneath the rising
   *  curtain while the number is still traveling up (reference behavior). */
  onReveal: () => void;
}) {
  const overlay = useRef<HTMLDivElement>(null);
  const counter = useRef({ value: 0 });
  const [display, setDisplay] = useState(0);
  const [gone, setGone] = useState(false);

  // `phase` only gates logic (no render dependency), so it lives in a ref.
  const phase = useRef<"counting" | "waiting" | "exiting">("counting");
  const readyRef = useRef(ready);
  const finished = useRef(false);
  const onRevealRef = useRef(onReveal);

  // Keep refs current for use inside GSAP callbacks/effects. Plain
  // assignment during render is a lint violation for refs, so this happens
  // via useEffect (a lint-legal location for ref writes).
  useEffect(() => {
    readyRef.current = ready;
    onRevealRef.current = onReveal;
  });

  // Idempotent: tweens the counter 90->100, then rides the curtain (with the
  // number anchored at its bottom edge) slowly up and off-screen. The page
  // reveals underneath from the start of the ride, so the big pixel number
  // travels up the right side of the assembling hero — like the reference.
  function finish() {
    if (finished.current) return;
    finished.current = true;
    phase.current = "exiting";
    gsap.to(counter.current, {
      value: 100,
      duration: 0.35,
      ease: "power1.out",
      onUpdate: () => setDisplay(Math.round(counter.current.value)),
      onComplete: () => {
        onRevealRef.current();
        gsap.to(overlay.current, {
          yPercent: -100,
          duration: 0.7,
          ease: "expo.inOut",
          onComplete: () => setGone(true),
        });
      },
    });
  }

  useGSAP(() => {
    gsap.to(counter.current, {
      value: 90,
      duration: 1.6,
      ease: "power2.inOut",
      onUpdate: () => setDisplay(Math.round(counter.current.value)),
      onComplete: () => {
        phase.current = "waiting";
        if (readyRef.current) finish();
      },
    });
  });

  // Covers the case where `ready` turns true only after the count tween
  // already completed and phase is sitting at "waiting". Only starts
  // tweens/mutates refs here — no synchronous setState in the effect body.
  useEffect(() => {
    if (phase.current === "waiting" && ready) finish();
  }, [ready]);

  if (gone) return null;

  return (
    <div
      ref={overlay}
      className="fixed inset-0 z-50 bg-bg flex items-end justify-end p-8 sm:p-12 pointer-events-none"
      aria-hidden="true"
    >
      <span className="font-pixel text-accent leading-none text-[clamp(6rem,18vw,14rem)] tabular-nums select-none">
        {display}
      </span>
    </div>
  );
}
