"use client";

import { useEffect, useState } from "react";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider, useAccount, useAccountEffect } from "wagmi";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/wagmi/config";
import { ensureAccount, getUserIdentity } from "@/lib/profile/data";
import { useDepositState } from "@/lib/deposit/useDepositState";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { ToastProvider } from "@/components/toast/ToastProvider";
import { OrderMatchToaster } from "@/components/toast/OrderMatchToaster";
import "@rainbow-me/rainbowkit/styles.css";

const queryClient = new QueryClient();

function AccountSync() {
  useAccountEffect({
    onConnect({ address }) {
      ensureAccount(address);
    },
  });
  return null;
}

/**
 * Auto-opens the onboarding wizard for a connected wallet that hasn't enabled
 * trading yet (no VTK→Exchange allowance). Once dismissed it stays closed for
 * the session, and it never opens for wallets that are already set up.
 */
function OnboardingGate() {
  const { address, isConnected } = useAccount();
  const [active, setActive] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const { vtkAllowanceToExchange } = useDepositState();

  const { data: identity } = useQuery({
    queryKey: ["identity", address],
    queryFn: () => getUserIdentity(address as string),
    enabled: isConnected && !!address,
  });

  const onboarded = vtkAllowanceToExchange != null && vtkAllowanceToExchange > 0n;

  useEffect(() => {
    if (!isConnected || !address || dismissed) return;
    if (vtkAllowanceToExchange == null) return; // still loading on-chain reads
    if (!onboarded) setActive(true);
  }, [isConnected, address, dismissed, onboarded, vtkAllowanceToExchange]);

  if (!isConnected || !address) return null;

  return (
    <OnboardingFlow
      active={active}
      onDismiss={() => {
        setActive(false);
        setDismissed(true);
      }}
      address={address}
      identity={identity ?? null}
    />
  );
}

const theme = darkTheme({
  accentColor: "#F6DCD4",
  accentColorForeground: "#1A1616",
  borderRadius: "small",
  fontStack: "system",
});

export function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={theme}>
          <ToastProvider>
            <AccountSync />
            <OnboardingGate />
            <OrderMatchToaster />
            {children}
          </ToastProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
