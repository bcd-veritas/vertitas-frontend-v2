"use client";

import { useEffect, useState } from "react";

export function AdminHeader() {
  const [now, setNow] = useState("");

  useEffect(() => {
    const tick = () =>
      setNow(new Date().toLocaleTimeString("en-US", { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="reveal-rise relative overflow-hidden border border-line bg-surface/30">
      <div className="dot-grid pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--color-accent), transparent)",
        }}
        aria-hidden="true"
      />
      <div className="relative flex flex-wrap items-end justify-between gap-4 px-5 py-5">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.35em] text-muted">
            Veritas · Admin
          </div>
          <h1 className="mt-1.5 font-pixel text-4xl uppercase leading-none tracking-wide text-fg">
            Operations Deck
          </h1>
        </div>
        <div className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-widest">
          <span
            className="pulse-dot inline-block h-2 w-2 rounded-full"
            style={{ background: "var(--color-yes)" }}
            aria-hidden="true"
          />
          <span className="text-yes">Systems Live</span>
          <span className="text-muted/40">/</span>
          <span className="tabular-nums text-fg/70">{now || "--:--:--"}</span>
        </div>
      </div>
    </header>
  );
}
