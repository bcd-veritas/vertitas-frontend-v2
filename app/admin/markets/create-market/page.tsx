"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { CreateMarketForm } from "@/components/admin/CreateMarketForm";

export default function CreateMarketPage() {
  return (
    <div className="flex w-full flex-col gap-5">
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
        <div className="relative px-5 py-5">
          <Link
            href="/admin"
            className="mb-2 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-fg"
          >
            <ChevronLeft size={12} aria-hidden="true" /> Dashboard
          </Link>
          <h1 className="font-pixel text-4xl uppercase leading-none tracking-wide text-fg">
            Create Market
          </h1>
          <p className="mt-1.5 font-mono text-[11px] text-muted">
            Deploy + seed a binary market on-chain
          </p>
        </div>
      </header>

      <CreateMarketForm />
    </div>
  );
}
