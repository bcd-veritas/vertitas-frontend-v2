"use client";

import { useState, type AnimationEvent } from "react";
import { usePrefersReducedMotion } from "../landing/usePrefersReducedMotion";

/**
 * Odometer-style numeric readout. When `value` changes, each changed
 * character slides like a slot reel in the direction of the change:
 * value rising → reels slide DOWN (new digit enters from above),
 * value falling → reels slide UP (new digit enters from below).
 *
 * Rapid updates (e.g. chart scrubbing) don't kill the slide mid-flight:
 * while a slide is animating, the newest value waits in `pending` and the
 * next slide starts when the current one finishes (animationend-driven —
 * no timers). Characters align from the right so magnitude changes keep
 * trailing digits in their columns. Pass a mono font via className.
 */

/** Numeric worth of a formatted string ("−$1,234.56" → -1234.56). */
function numericWorth(formatted: string): number {
  const cleaned = formatted.replace("−", "-").replace(/[^0-9.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

const PAD = " ";

type OdoState = {
  cur: string;
  prev: string | null;
  dir: "down" | "up";
  tick: number;
  animating: boolean;
  pending: string | null;
};

function startSlide(s: OdoState, next: string): OdoState {
  return {
    cur: next,
    prev: s.cur,
    dir: numericWorth(next) >= numericWorth(s.cur) ? "down" : "up",
    tick: s.tick + 1,
    animating: true,
    pending: null,
  };
}

export function Odometer({ value, className }: { value: string; className?: string }) {
  const reduced = usePrefersReducedMotion();
  const [state, setState] = useState<OdoState>({
    cur: value,
    prev: null,
    dir: "down",
    tick: 0,
    animating: false,
    pending: null,
  });

  // Adjust-during-render on prop change (React-sanctioned pattern).
  const latestTarget = state.pending ?? state.cur;
  if (value !== latestTarget) {
    if (reduced) {
      // No animation: plain swap.
      setState({ cur: value, prev: null, dir: "down", tick: state.tick + 1, animating: false, pending: null });
    } else if (state.animating) {
      // A slide is in flight — queue the newest target.
      setState({ ...state, pending: value });
    } else {
      setState(startSlide(state, value));
    }
  }

  // First animationend of the current tick advances the queue; stale events
  // from earlier ticks (or later siblings of the same tick) no-op.
  const onAnimationEnd = (e: AnimationEvent<HTMLSpanElement>) => {
    const target = e.target as HTMLElement;
    if (target.dataset.odoTick !== String(state.tick)) return;
    setState((s) => {
      if (!s.animating || String(s.tick) !== target.dataset.odoTick) return s;
      return s.pending != null ? startSlide(s, s.pending) : { ...s, animating: false };
    });
  };

  const { cur, prev, dir, tick, animating } = state;
  const showSlide = animating && prev != null;
  const len = Math.max(cur.length, prev?.length ?? 0);
  const curChars = [...cur.padStart(len, PAD)];
  const prevChars = [...(prev ?? cur).padStart(len, PAD)];

  return (
    <span
      className={`inline-flex overflow-hidden align-baseline ${className ?? ""}`}
      style={{ lineHeight: 1, height: "1em" }}
      aria-label={cur}
      role="img"
      onAnimationEnd={onAnimationEnd}
    >
      {curChars.map((c, i) => {
        const p = prevChars[i];
        if (!showSlide || p === c) {
          return (
            <span key={`s${i}`} aria-hidden="true" className="block" style={{ height: "1em" }}>
              {c}
            </span>
          );
        }
        // Changed column: a 2-row strip animates through the 1em window.
        // dir "down" (rise): strip [new, old] slides from -1em → 0.
        // dir "up" (fall): strip [old, new] slides from 0 → -1em.
        return (
          <span
            key={`w${i}`}
            aria-hidden="true"
            className="inline-block overflow-hidden"
            style={{ height: "1em" }}
          >
            <span
              key={tick}
              data-odo-tick={tick}
              className={dir === "down" ? "odo-reel-down" : "odo-reel-up"}
            >
              <span className="block" style={{ height: "1em" }}>
                {dir === "down" ? c : p}
              </span>
              <span className="block" style={{ height: "1em" }}>
                {dir === "down" ? p : c}
              </span>
            </span>
          </span>
        );
      })}
    </span>
  );
}
