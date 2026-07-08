"use client";

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";

import { getAdminAccess } from "@/lib/admin/data";

export function AdminGate({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-access", address],
    queryFn: () => getAdminAccess(address as string),
    enabled: isConnected && !!address,
  });

  if (!isConnected) {
    return (
      <Centered>
        <p className="mb-4 font-mono text-sm text-fg/60">Connect an admin wallet to continue.</p>
        <button
          onClick={openConnectModal}
          className="cursor-pointer border border-fg px-4 py-2 font-mono text-xs uppercase tracking-wider hover:bg-fg hover:text-bg"
        >
          Connect Wallet
        </button>
      </Centered>
    );
  }

  if (isLoading) {
    return <Centered><p className="font-mono text-sm text-fg/50">Checking access…</p></Centered>;
  }

  if (isError || !data?.isAdmin) {
    return (
      <Centered>
        <p className="font-mono text-sm text-fg/60">
          This wallet doesn’t have admin access.
        </p>
      </Centered>
    );
  }

  return <>{children}</>;
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      {children}
    </div>
  );
}
