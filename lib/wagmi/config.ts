import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { sepolia, foundry } from "wagmi/chains";

export const wagmiConfig = getDefaultConfig({
  appName: "Veritas",
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? "YOUR_PROJECT_ID",
  chains: [sepolia, foundry],
  ssr: true,
});
