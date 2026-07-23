"use client";

import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider, useAccountEffect } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/wagmi/config";
import { ensureAccount } from "@/lib/profile/data";
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
          <AccountSync />
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
