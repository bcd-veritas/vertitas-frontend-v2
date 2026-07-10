"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, LineChart, Plus, Users, Wallet } from "lucide-react";

const LINKS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/markets", label: "Markets", icon: LineChart },
  { href: "/admin/markets/create-market", label: "Create Market", icon: Plus },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/funds", label: "Funds", icon: Wallet },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-line bg-surface/30">
      <div className="border-b border-line px-4 py-4 font-mono text-xs uppercase tracking-wider text-fg/50">
        Veritas · Admin
      </div>
      <nav className="flex flex-col gap-1 p-2">
        {LINKS.map((l) => {
          const active = pathname === l.href;
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex cursor-pointer items-center gap-2.5 border-l-2 px-3 py-2 font-mono text-xs uppercase tracking-wider transition-colors ${
                active
                  ? "border-fg bg-fg/5 text-fg"
                  : "border-transparent text-fg/50 hover:bg-fg/5 hover:text-fg"
              }`}
            >
              <Icon size={14} strokeWidth={2} aria-hidden="true" />
              {l.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
