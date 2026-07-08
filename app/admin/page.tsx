"use client";

import { AdminHeader } from "@/components/admin/AdminHeader";
import { KpiStrip } from "@/components/admin/KpiStrip";
import { ActivityChart } from "@/components/admin/ActivityChart";
import { MarketHealthTable } from "@/components/admin/MarketHealthTable";
import { RecentActivity } from "@/components/admin/RecentActivity";

export default function AdminDashboardPage() {
  return (
    <div className="flex flex-col gap-5">
      <AdminHeader />
      <KpiStrip />
      <div className="grid gap-5 lg:grid-cols-3">
        <div
          className="reveal-rise lg:col-span-2"
          style={{ animationDelay: "320ms" }}
        >
          <ActivityChart />
        </div>
        <div className="reveal-rise" style={{ animationDelay: "380ms" }}>
          <RecentActivity />
        </div>
      </div>
      <div className="reveal-rise" style={{ animationDelay: "440ms" }}>
        <MarketHealthTable />
      </div>
    </div>
  );
}
