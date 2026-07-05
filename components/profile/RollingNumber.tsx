"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { usePrefersReducedMotion } from "../landing/usePrefersReducedMotion";

gsap.registerPlugin(useGSAP);

type RollingNumberProps = {
  value: number;
  className?: string;
  /** Leading +/- instead of only a minus sign. */
  signed?: boolean;
  currency?: boolean;
  decimals?: number;
  suffix?: string;
};

function formatValue(
  value: number,
  {
    signed,
    currency,
    decimals,
    suffix,
  }: Required<Pick<RollingNumberProps, "signed" | "currency" | "decimals" | "suffix">>,
): string {
  const sign = value < 0 ? "−" : signed ? "+" : "";
  const body = Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${sign}${currency ? "$" : ""}${body}${suffix}`;
}

const ROLL = { duration: 0.4, ease: "back.out(1.4)" };

function Slot({ char, value, animate }: { char: string; value: number; animate: boolean }) {
  const wrapRef = useRef<HTMLSpanElement | null>(null);
  const curRef = useRef<HTMLSpanElement | null>(null);
  const prevCharRef = useRef(char);
  const prevValueRef = useRef(value);

  useGSAP(
    () => {
      const prevChar = prevCharRef.current;
      const dir = value >= prevValueRef.current ? 1 : -1;
      prevCharRef.current = char;
      prevValueRef.current = value;

      const el = curRef.current;
      const wrap = wrapRef.current;
      if (!animate || prevChar === char || !el || !wrap) return;

      const out = document.createElement("span");
      out.textContent = prevChar;
      out.style.position = "absolute";
      out.style.inset = "0";
      wrap.appendChild(out);
      gsap.fromTo(
        out,
        {
          yPercent: Number(gsap.getProperty(el, "yPercent")) || 0,
          opacity: Number(gsap.getProperty(el, "opacity")),
        },
        { yPercent: dir >= 0 ? 115 : -115, opacity: 0, ...ROLL, onComplete: () => out.remove() },
      );

      // Enter: the current glyph rolls in from the direction of change.
      gsap.fromTo(
        el,
        { yPercent: dir >= 0 ? -115 : 115, opacity: 0 },
        { yPercent: 0, opacity: 1, ...ROLL, overwrite: "auto" },
      );
    },
    { dependencies: [char, value, animate] },
  );

  return (
    <span
      ref={wrapRef}
      className="relative inline-block overflow-hidden tabular-nums"
      style={{ height: "1.15em", lineHeight: "1.15em", verticalAlign: "baseline" }}
    >
      {/* keep width reserved so the reel never collapses mid-swap */}
      <span aria-hidden className="invisible inline-block">
        {char === " " ? " " : char}
      </span>
      <span ref={curRef} className="absolute inset-0 inline-block">
        {char}
      </span>
    </span>
  );
}

export function RollingNumber({
  value,
  className = "",
  signed = false,
  currency = false,
  decimals = 0,
  suffix = "",
}: RollingNumberProps) {
  const reduce = usePrefersReducedMotion();
  const text = formatValue(value, { signed, currency, decimals, suffix });

  if (reduce) {
    return <span className={`${className} tabular-nums`}>{text}</span>;
  }

  const chars = [...text];
  const len = chars.length;

  return (
    <span className={`${className} inline-flex tabular-nums`}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className="inline-flex">
        {chars.map((ch, i) => (
          // key by position from the right so digit places keep identity as
          // the number grows or shrinks; only digits animate.
          <Slot key={len - 1 - i} char={ch} value={value} animate={/[0-9]/.test(ch)} />
        ))}
      </span>
    </span>
  );
}
