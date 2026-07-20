import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { fallback, http } from "wagmi";
import { sepolia, foundry } from "wagmi/chains";

// Sepolia transport, in survey-tested order. The oracle desk needs wide-range
// eth_getLogs (assertion story, votes, round-clock anchor) and almost nobody
// free serves it: the chain's default public RPC rejects getLogs outright,
// Alchemy Free caps it at a 10-BLOCK range, publicnode calls it an archive
// request, 1rpc caps at 50 blocks. Tenderly's public gateway serves the full
// range, so it leads; the configured RPC (Alchemy) is the fallback for
// everything else if Tenderly hiccups.
const LOGS_CAPABLE_RPC = "https://sepolia.gateway.tenderly.co";
const sepoliaRpc = process.env.NEXT_PUBLIC_RPC_HTTP_URL;

export const wagmiConfig = getDefaultConfig({
  appName: "Veritas",
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? "YOUR_PROJECT_ID",
  chains: [sepolia, foundry],
  transports: {
    [sepolia.id]: sepoliaRpc
      ? fallback([http(LOGS_CAPABLE_RPC), http(sepoliaRpc)])
      : http(LOGS_CAPABLE_RPC),
    [foundry.id]: http(),
  },
  ssr: true,
});
