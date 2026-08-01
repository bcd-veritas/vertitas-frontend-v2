"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, LineChart, Plus, Users, Wallet, LogOut, Unplug } from "lucide-react";
import { useAccount, useDisconnect } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";

const LINKS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/markets", label: "Markets", icon: LineChart },
  { href: "/admin/markets/create-market", label: "Create Market", icon: Plus },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/funds", label: "Funds", icon: Wallet },
];

function WalletWidget() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();

  if (!isConnected || !address) {
    return (
      <div className="border-t border-line p-3">
        <button
          type="button"
          onClick={openConnectModal}
          className="flex w-full items-center justify-center gap-2 border border-fg/30 px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-fg/60 transition-colors hover:border-fg hover:bg-fg/5 hover:text-fg"
        >
          <Unplug size={12} aria-hidden="true" />
          Connect Wallet
        </button>
      </div>
    );
  }

  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;

  return (
    <div className="border-t border-line p-3 space-y-2">
      {/* Address pill */}
      <div className="flex items-center gap-2 border border-line bg-fg/[0.03] px-2.5 py-2">
        <span
          className="h-2 w-2 shrink-0 rounded-full bg-yes"
          style={{ boxShadow: "0 0 5px var(--color-yes)" }}
          aria-hidden="true"
        />
        <span className="flex-1 truncate font-mono text-[11px] tabular-nums text-fg/80">
          {short}
        </span>
      </div>
      {/* Disconnect button */}
      <button
        type="button"
        onClick={() => disconnect()}
        className="flex w-full items-center justify-center gap-2 border border-no/30 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-no/70 transition-colors hover:border-no hover:bg-no/10 hover:text-no"
      >
        <LogOut size={12} aria-hidden="true" />
        Disconnect
      </button>
    </div>
  );
}

export function AdminNav() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-line bg-surface/30 backdrop-blur-md">
      <div className="border-b border-line px-5 py-4 flex items-center justify-between">
        <div>
          <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-accent font-semibold">
            Veritas Protocol
          </div>
          <div className="font-mono text-xs uppercase tracking-wider text-fg font-bold mt-0.5">
            Admin Console
          </div>
        </div>
        <span className="pulse-dot h-2 w-2 rounded-full bg-yes" aria-hidden="true" />
      </div>

      <nav className="flex flex-col gap-1.5 p-3">
        <div className="px-3 pt-2 pb-1 font-mono text-[9px] uppercase tracking-[0.2em] text-muted/50 font-semibold">
          Overview
        </div>
        {LINKS.slice(0, 3).map((l) => {
          const active = pathname === l.href;
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex cursor-pointer items-center gap-3 rounded-sm border-l-2 px-3 py-2 font-mono text-xs uppercase tracking-wider transition-all ${
                active
                  ? "border-accent bg-accent/10 text-fg shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]"
                  : "border-transparent text-fg/50 hover:bg-fg/5 hover:text-fg"
              }`}
            >
              <Icon size={15} strokeWidth={active ? 2.5 : 2} className={active ? "text-accent" : ""} aria-hidden="true" />
              {l.label}
            </Link>
          );
        })}

        <div className="mt-3 px-3 pt-2 pb-1 font-mono text-[9px] uppercase tracking-[0.2em] text-muted/50 font-semibold border-t border-line/40">
          Management
        </div>
        {LINKS.slice(3).map((l) => {
          const active = pathname === l.href;
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex cursor-pointer items-center gap-3 rounded-sm border-l-2 px-3 py-2 font-mono text-xs uppercase tracking-wider transition-all ${
                active
                  ? "border-accent bg-accent/10 text-fg shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]"
                  : "border-transparent text-fg/50 hover:bg-fg/5 hover:text-fg"
              }`}
            >
              <Icon size={15} strokeWidth={active ? 2.5 : 2} className={active ? "text-accent" : ""} aria-hidden="true" />
              {l.label}
            </Link>
          );
        })}
      </nav>
      {/* Push wallet widget to the bottom */}
      <div className="mt-auto">
        <WalletWidget />
      </div>
    </aside>
  );
}
