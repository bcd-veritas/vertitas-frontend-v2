"use client";

import { useEffect, useRef } from "react";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider, useAccount } from "wagmi";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/wagmi/config";
import { collateralQueryKey, ensureAccount, syncUserBalances } from "@/lib/profile/data";
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
 *
 * Also does one on-chain balance sync at each end of a session: once right
 * after connecting (or switching to a new address), and once more for the
 * previous wallet right as it disconnects. This is deliberately the only
 * place an on-chain read happens automatically — see `AccountBalances`,
 * whose passive refreshes (mount, realtime socket events) stay a cheap DB
 * read for exactly this reason. Connect/disconnect happen at most a
 * handful of times per session, so paying for a chain-authoritative read
 * there catches drift (e.g. a transfer made outside the app) without
 * turning every fill in the market into an RPC call.
 */
function AccountSync() {
  const { address, isConnected } = useAccount();
  const queryClient = useQueryClient();
  const lastEnsured = useRef<string | null>(null);
  // The most recently connected wallet, kept around past a disconnect (when
  // wagmi clears `address`) so the disconnect effect below still knows who
  // to sync for.
  const connectedWallet = useRef<string | null>(null);

  useEffect(() => {
    if (!isConnected || !address) return;
    connectedWallet.current = address;
    if (lastEnsured.current === address) return;

    lastEnsured.current = address;
    ensureAccount(address);
    void syncUserBalances(address).then((fresh) =>
      queryClient.setQueryData(collateralQueryKey(address), fresh),
    );
  }, [isConnected, address, queryClient]);

  useEffect(() => {
    if (isConnected) return;
    const wallet = connectedWallet.current;
    if (!wallet) return;

    connectedWallet.current = null;
    lastEnsured.current = null;
    // Best-effort: there's no UI left to update once disconnected (the tab
    // may even be closing), so failures here are silently swallowed rather
    // than surfaced anywhere.
    void syncUserBalances(wallet).catch(() => {});
  }, [isConnected]);

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
