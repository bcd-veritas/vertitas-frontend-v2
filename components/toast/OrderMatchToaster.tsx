"use client";

import { useAccount } from "wagmi";
import { useUserRoom } from "@/lib/realtime/hooks";
import { useToast } from "./ToastProvider";

/**
 * Listens on the connected wallet's room for `order:matched` (a taker hit one
 * of their resting orders) and raises a top-right toast. Renders nothing —
 * mounted once, app-wide, inside the Wagmi + Toast providers. Balance refetch
 * is left to the Topbar's own useUserRoom, so this passes a no-op onUpdate.
 */
export function OrderMatchToaster() {
  const { address, isConnected } = useAccount();
  const { push } = useToast();

  useUserRoom(
    isConnected ? address : null,
    () => { },
    (p) => {
      push({
        title: "Order matched",
        tone: p.side === "BUY" ? "yes" : "no",
        href: `/markets/${p.marketId}`,
        body: (
          <>
            Your <span className={p.side === "BUY" ? "text-yes" : "text-no"}>{p.side}</span>{" "}
            filled: <span className="tabular-nums text-fg">{p.shares}</span> sh @{" "}
            <span className="tabular-nums text-fg">{Math.round(p.priceCents)}¢</span>
            <br />
            <span className="text-muted/80">
              {p.outcomeLabel} · {p.marketTitle}
            </span>
          </>
        ),
      });
    },
  );

  return null;
}
