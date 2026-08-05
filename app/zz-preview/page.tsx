"use client";

import { UsersTable } from "@/components/admin/UsersTable";

/* Mounts UsersTable outside the /admin layout's wallet gate, purely to
   verify the role-filter/pagination fix against the live API without wallet
   automation. Delete before finishing. */
export default function ZzPreview() {
  return (
    <div className="min-h-screen bg-bg p-6">
      <UsersTable />
    </div>
  );
}
