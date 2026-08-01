"use client";

import { useEffect, useRef } from "react";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider, useAccount } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/wagmi/config";
import { ensureAccount } from "@/lib/profile/data";
import { OnboardingProvider } from "@/components/onboarding/OnboardingProvider";
import { ToastProvider } from "@/components/toast/ToastProvider";
import { OrderMatchToaster } from "@/components/toast/OrderMatchToaster";
import "@rainbow-me/rainbowkit/styles.css";

const queryClient = new QueryClient();

/**
 * Watches the connected `address` itself rather than wagmi's `onConnect`
 * event — `onConnect` only fires on an actual connect/reconnect, not when
 * MetaMask's `accountsChanged` swaps the active account while already
 * connected, so a mid-session account switch never reached the backend.
 */
function AccountSync() {
  const { address, isConnected } = useAccount();
  const lastEnsured = useRef<string | null>(null);

  useEffect(() => {
    if (!isConnected || !address || lastEnsured.current === address) return;

    lastEnsured.current = address;
    ensureAccount(address);

  }, [isConnected, address]);


  return null;
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
            <OnboardingProvider>
              <OrderMatchToaster />
              {children}
            </OnboardingProvider>
          </ToastProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
