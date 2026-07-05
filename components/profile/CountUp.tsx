"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { usePrefersReducedMotion } from "../landing/usePrefersReducedMotion";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

export function CountUp({
  value,
  className = "",
  prefix = "",
  suffix = "",
  decimals = 0,
  pad = 1,
}: {
  value: number;
  className?: string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  pad?: number;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const reduce = usePrefersReducedMotion();

  const fmt = (v: number) =>
    `${prefix}${v.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      minimumIntegerDigits: pad,
    })}${suffix}`;

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || reduce) return;
      const counter = { v: 0 };
      el.textContent = fmt(0);
      gsap.to(counter, {
        v: value,
        duration: 1.2,
        ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 90%", once: true },
        onUpdate: () => {
          el.textContent = fmt(counter.v);
        },
      });
    },
    { dependencies: [value, decimals, pad, prefix, suffix, reduce], revertOnUpdate: true },
  );

  return (
    <span className={className}>
      <span className="sr-only">{fmt(value)}</span>
      <span ref={ref} aria-hidden="true" className="tabular-nums">
        {fmt(value)}
      </span>
    </span>
  );
}
