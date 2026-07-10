"use client";

import { UsersTable } from "@/components/admin/UsersTable";

export default function AdminUsersPage() {
  return (
    <div className="flex flex-col gap-5">
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
        <div className="relative flex items-end justify-between gap-4 px-5 py-5">
          <div>
            <h1 className="font-pixel text-4xl uppercase leading-none tracking-wide text-fg">
              Users
            </h1>
            <p className="mt-1.5 font-mono text-[11px] text-muted">
              View accounts, balances &amp; roles — with on-chain whitelist drift
            </p>
          </div>
          <div className="flex items-center gap-2 pb-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-yes" aria-hidden="true" />
            Live · 30s
          </div>
        </div>
      </header>

      <div className="reveal-rise" style={{ animationDelay: "140ms" }}>
        <UsersTable />
      </div>
    </div>
  );
}
