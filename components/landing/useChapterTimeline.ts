"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { useRef } from "react";
import { FORM, sceneMotion } from "./three/sceneMotion";
import { flashScreen } from "./useForgeEntrance";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * Wrap each character of `el` in a span.char, grouped into nowrap word
 * spans so line wrapping is preserved. Walks text nodes, so nested markup
 * (colored spans, <br>) survives. Idempotent via data-split.
 */
export function splitChars(el: HTMLElement) {
  if (el.dataset.split) return;
  el.dataset.split = "1";
  const splitTextNode = (node: Text) => {
    const text = node.textContent ?? "";
    if (!text.trim()) return;
    const frag = document.createDocumentFragment();
    for (const word of text.split(/(\s+)/)) {
      if (!word) continue;
      if (/^\s+$/.test(word)) {
        frag.appendChild(document.createTextNode(" "));
        continue;
      }
      const w = document.createElement("span");
      w.style.display = "inline-block";
      w.style.whiteSpace = "nowrap";
      for (const ch of word) {
        const s = document.createElement("span");
        s.className = "char";
        s.style.display = "inline-block";
        s.textContent = ch;
        w.appendChild(s);
      }
      frag.appendChild(w);
    }
    node.parentNode?.replaceChild(frag, node);
  };
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) splitTextNode(node as Text);
    else [...node.childNodes].forEach(walk);
  };
  walk(el);
}

/**
 * Scroll choreography after the forge. Each act section (300vh, CSS-sticky
 * inner viewport) gets:
 *  - a formation ScrollTrigger writing sceneMotion directly (token state is
 *    a pure function of scroll — no tween conflicts), and
 *  - a scrubbed text-reveal timeline (char stagger in, fade out).
 */
export function useChapterTimeline(enabled: boolean) {
  const truthFlashed = useRef(false);

  useGSAP(
    () => {
      if (!enabled) return;
      const ease = gsap.parseEase("power1.inOut");

      /* ── formations ── */
      const chapter = (
        id: string,
        a: number,
        b: number,
        extra?: (p: number) => void
      ) =>
        ScrollTrigger.create({
          trigger: `#${id}`,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.6,
          onUpdate: (self) => {
            sceneMotion.formA = a;
            sceneMotion.formB = b;
            sceneMotion.mix = ease(self.progress);
            sceneMotion.turb = 0.8;
            extra?.(self.progress);
          },
        });

      chapter("act-split", FORM.COIN, FORM.STREAMS, () => {
        sceneMotion.sweep = -2.5;
        sceneMotion.zoom = 1;
      });
      chapter("act-price", FORM.STREAMS, FORM.RIBBON, () => {
        sceneMotion.sweep = -2.5;
        sceneMotion.zoom = 1;
      });
      // Resolution: a white-hot scanline sweeps the ribbon, locking price
      // to mint as it passes — then the ribbon reassembles into a giant
      // pixel YES (flash on lock). Camera pushes in the whole way.
      ScrollTrigger.create({
        trigger: "#act-truth",
        start: "top top",
        end: "bottom bottom",
        scrub: 0.6,
        onUpdate: (self) => {
          const p = self.progress;
          if (p < 0.5) {
            const q = p / 0.5;
            sceneMotion.formA = FORM.RIBBON;
            sceneMotion.formB = FORM.RIBBON;
            sceneMotion.mix = 0;
            sceneMotion.sweep = -1.4 + q * 2.8;
            sceneMotion.damp = 1 - 0.6 * q;
            truthFlashed.current = false;
          } else {
            const q = (p - 0.5) * 2;
            sceneMotion.formA = FORM.RIBBON;
            sceneMotion.formB = FORM.VERDICT;
            sceneMotion.mix = ease(q);
            sceneMotion.sweep = 1.4;
            sceneMotion.damp = 0.4;
            if (q > 0.6 && !truthFlashed.current) {
              truthFlashed.current = true;
              flashScreen(0.5);
            }
          }
          sceneMotion.zoom = 1 + 0.08 * ease(Math.min(1, p * 1.4));
          sceneMotion.bgShift = gsap.utils.clamp(0, 1, (p - 0.75) / 0.25);
          sceneMotion.turb = 0.8;
        },
      });
      // Payout: first half the YES detonates, second half the burst
      // regroups into a mini coin above the CTA.
      ScrollTrigger.create({
        trigger: "#act-payout",
        start: "top top",
        end: "bottom bottom",
        scrub: 0.6,
        onUpdate: (self) => {
          const p = self.progress;
          if (p < 0.5) {
            sceneMotion.formA = FORM.VERDICT;
            sceneMotion.formB = FORM.BURST;
            sceneMotion.mix = ease(p * 2);
          } else {
            sceneMotion.formA = FORM.BURST;
            sceneMotion.formB = FORM.MINI;
            sceneMotion.mix = ease((p - 0.5) * 2);
          }
          sceneMotion.spinSpeed = p > 0.75 ? 1.4 : 0.35;
          sceneMotion.turb = 0.8;
          // Release the truth push-in and settle the bg back to dark so
          // the CTA sits on high contrast.
          sceneMotion.zoom = 1.08 - 0.08 * ease(Math.min(1, p * 2));
          sceneMotion.bgShift = gsap.utils.clamp(0, 1, 1 - p * 1.6);
        },
      });

      /* ── text reveals ── */
      const reveal = (id: string, holdEnd = false) => {
        const sec = document.getElementById(id);
        const copy = sec?.querySelector<HTMLElement>(".act-copy");
        if (!sec || !copy) return;
        const title = copy.querySelector<HTMLElement>(".act-title");
        if (title) splitChars(title);
        const chars = title?.querySelectorAll(".char") ?? [];

        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: sec,
            start: "top top",
            end: "bottom bottom",
            scrub: 0.6,
          },
        });
        tl.fromTo(
          copy,
          { opacity: 0 },
          { opacity: 1, duration: 0.2, ease: "power1.out" },
          0.1
        );
        if (chars.length)
          tl.fromTo(
            chars,
            { opacity: 0, y: "0.35em" },
            { opacity: 1, y: 0, duration: 0.18, stagger: 0.012, ease: "power2.out" },
            0.1
          );
        if (!holdEnd) tl.to(copy, { opacity: 0, duration: 0.15, ease: "power1.in" }, 0.8);
        tl.to({}, { duration: 0.05 }, 0.95); // pad so scrub spans the full act
      };
      reveal("act-split");
      reveal("act-price");
      reveal("act-truth");
      reveal("act-payout", true);

      // Hero copy + cue fade out over the hero's early scroll.
      gsap.to("#hero-copy, .scroll-cue", {
        autoAlpha: 0,
        ease: "none",
        scrollTrigger: {
          trigger: "#act-hero",
          start: "top top",
          end: "40% top",
          scrub: 0.6,
        },
      });

      ScrollTrigger.refresh();
    },
    { dependencies: [enabled] }
  );
}
