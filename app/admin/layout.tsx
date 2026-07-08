import type { ReactNode } from "react";

import { AdminGate } from "@/components/admin/AdminGate";
import { AdminNav } from "@/components/admin/AdminNav";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-bg text-fg">
      <AdminNav />
      <div className="flex-1">
        <AdminGate>
          <main className="mx-auto max-w-6xl px-6 py-6">{children}</main>
        </AdminGate>
      </div>
    </div>
  );
}
