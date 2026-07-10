"use client";

import { useState } from "react";

import { MarketsHeader } from "@/components/admin/MarketsHeader";
import { MarketsTable } from "@/components/admin/MarketsTable";

export default function AdminMarketsPage() {
  // Status filter lives here: the header census tiles set it, the board reads it.
  const [status, setStatus] = useState("");

  return (
    <div className="flex flex-col gap-5">
      <MarketsHeader status={status} onStatusChange={setStatus} />
      <div className="reveal-rise" style={{ animationDelay: "140ms" }}>
        <MarketsTable status={status} onStatusChange={setStatus} />
      </div>
    </div>
  );
}
