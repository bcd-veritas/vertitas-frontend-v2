"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { tokenMotion, resetTokenMotion } from "./three/tokenMotion";

gsap.registerPlugin(ScrollTrigger, useGSAP);

type Keyframe = Partial<typeof tokenMotion>;

/** A tween of tokenMotion over an absolute scroll-fraction range. */
type Segment = { s: number; e: number; kf: Keyframe };

/** World half-height at z=0 for camera fov 40 at distance 9. */
const WORLD_HALF = Math.tan((40 / 2) * (Math.PI / 180)) * 9;

/** Convert a viewport-pixel y (of the PINNED section) to token world y. */
function pxToWorldY(px: number, vh: number) {
  return ((vh / 2 - px) / (vh / 2)) * WORLD_HALF;
}

/**
 * Pin the resolution section and translate the lifecycle track horizontally
 * with scroll. Functional values + invalidateOnRefresh keep it correct
 * across late layout shifts (fonts, images, resizes).
 */
function buildLifecyclePin() {
  const track = document.getElementById("lifecycle-track");
  const section = document.getElementById("resolution");
  if (!track || !section) return null;

  const dots = track.querySelectorAll<HTMLElement>(".lifecycle-dot");
  if (dots.length < 2) return null;
  // Horizontal distance from first to last dot = exactly what must scroll by
  // for every dot to pass the screen-center token.
  const measure = () => {
    const r = track.querySelectorAll<HTMLElement>(".lifecycle-dot");
    return Math.max(
      1,
      Math.round(
        r[r.length - 1].getBoundingClientRect().left -
          r[0].getBoundingClientRect().left
      )
    );
  };
  const distance = measure();

  gsap.to(track, {
    x: () => -measure(),
    ease: "none",
    scrollTrigger: {
      trigger: section,
      start: "top top",
      end: () => "+=" + measure(),
      pin: true,
      scrub: 0.8,
      invalidateOnRefresh: true,
    },
  });

  // The line's y within the pinned viewport = its offset from the section
  // top (the section sits at viewport top while pinned).
  const lineY =
    dots[0].getBoundingClientRect().top -
    section.getBoundingClientRect().top;

  return { distance, dotCount: dots.length, lineY };
}

/**
 * ONE master timeline scrubbed over the entire page (token state is a pure
 * function of scroll position). Built AFTER the lifecycle pin so all offsets
 * include the pin spacer.
 */
function buildTokenTimeline(segments: Segment[]) {
  const main = document.getElementById("landing-main");
  if (!main) return;

  const tl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: main,
      start: "top top",
      end: "bottom bottom",
      scrub: 0.8,
    },
  });

  // Clamp monotonic + non-overlapping so no two tweens fight a property.
  let cursor = 0;
  for (const { s, e, kf } of segments) {
    const start = Math.max(cursor, Math.min(1, Math.max(0, s)));
    const end = Math.min(1, Math.max(start + 0.002, e));
    tl.to(tokenMotion, { ...kf, duration: end - start }, start);
    cursor = end;
  }
  // Pad to duration exactly 1 so timeline time === scroll fraction.
  if (cursor < 1) tl.to({}, { duration: 1 - cursor }, cursor);
}

export function useTokenScrollTimeline(enabled: boolean) {
  useGSAP(
    () => {
      if (!enabled) return;
      resetTokenMotion();
      const mm = gsap.matchMedia();

      const setup = (desktop: boolean) => {
        const pin = buildLifecyclePin();
        // Force layout to include the pin spacer before measuring offsets.
        ScrollTrigger.refresh();

        const vh = window.innerHeight;
        const main = document.getElementById("landing-main");
        if (!main) return;
        const total = Math.max(1, main.scrollHeight - vh);
        const absTop = (id: string) => {
          const el = document.getElementById(id);
          return el ? el.getBoundingClientRect().top + window.scrollY : 0;
        };
        // Fraction range while `id`'s top travels fromVh -> toVh viewport
        // heights above the scroll position (fromVh 1 = "top hits bottom").
        const range = (id: string, fromVh: number, toVh: number, kf: Keyframe): Segment => {
          const top = absTop(id);
          return { s: (top - vh * fromVh) / total, e: (top - vh * toVh) / total, kf };
        };

        // Token hover height derived from the measured line position: the
        // coin floats with its bottom edge just above the line.
        // (Token world radius == its scale.)
        const scale = desktop ? 0.5 : 0.38;
        const lineWorldY = pin ? pxToWorldY(pin.lineY, vh) : 0;
        const restY = lineWorldY + scale + 0.22;
        // Chart position: as far right as fits on screen (chart half-width
        // ~1.1 world at scale 0.95, plus margin), capped for very wide viewports.
        const halfW = WORLD_HALF * (window.innerWidth / vh);
        const chartX = Math.min(2.9, Math.max(0.8, halfW - 1.45));

        const segments: Segment[] = desktop
          ? [
              // Hero -> How it works: shrink, glide left, flip edge-on; waves dissolve
              range("how", 1, 0.25, { x: -2.6, y: 0, scale: 0.85, rotX: 0.1, rotY: Math.PI * 0.5, spin: 0.8, wavesOpacity: 0 }),
              // How -> Markets: the coin unrolls into an upright line chart
              // (x pushed right for clear air between chart and the cards)
              range("markets", 1, 0.25, { x: chartX, y: -0.35, scale: 0.95, rotX: 0, rotY: 0, spin: 0.15, morph: 1 }),
              // Markets -> Resolution pin: reassemble the coin above the line
              range("resolution", 1, 0, { x: 0, y: restY, scale, rotX: 0.35, rotY: 0, spin: 2.0, morph: 0 }),
            ]
          : [
              range("how", 1, 0.3, { y: 2.2, scale: 0.5, spin: 1.0, wavesOpacity: 0 }),
              range("markets", 1, 0.3, { scale: 0.55, spin: 0.15, rotX: 0, morph: 1 }),
              range("resolution", 1, 0, { x: 0, y: restY, scale, rotX: 0.35, rotY: 0, spin: 2.0, morph: 0 }),
            ];

        let ctaStart: Segment["s"];
        if (pin) {
          // Stamp each dot as it passes beneath the token. All stamp
          // segments stay INSIDE the pinned scroll range; the last dot stays
          // punched (no return) and hands off to the CTA transition.
          const pinStartFrac = absTop("resolution") / total;
          const span = pin.distance / total;
          const pinEndFrac = pinStartFrac + span;
          const n = pin.dotCount;
          const delta = span * 0.04;
          // Scale-only pulses (no vertical bump) as each dot passes beneath
          for (let i = 1; i < n; i++) {
            const f = Math.min(pinEndFrac, pinStartFrac + span * (i / (n - 1)));
            const last = i === n - 1;
            segments.push({
              s: f - delta,
              e: f,
              kf: { scale: last ? scale * 1.2 : scale * 1.08 },
            });
            if (!last) segments.push({ s: f, e: f + delta, kf: { scale } });
          }
          ctaStart = pinEndFrac;
        } else {
          ctaStart = range("cta", 1, 1, {}).s;
        }

        // Pin exit -> Final CTA: runs over the post-pin scroll, never inside it.
        const ctaKf: Keyframe = desktop
          ? { x: 0, y: 1.45, scale: 1.2, rotX: 0, rotY: 0, rotZ: 0, spin: 0.5 }
          : { y: 2.4, scale: 0.5, rotX: 0, spin: 0.5 };
        segments.push({ s: ctaStart, e: Math.min(1, ctaStart + (vh * 0.9) / total), kf: ctaKf });

        buildTokenTimeline(segments);
      };

      mm.add("(min-width: 768px)", () => setup(true));
      mm.add("(max-width: 767px)", () => {
        // Mobile: token lives top-center above the headline in the hero
        gsap.set(tokenMotion, { x: 0, y: 1.95, scale: 0.68 });
        setup(false);
      });

      return () => mm.revert();
    },
    { dependencies: [enabled] }
  );
}
