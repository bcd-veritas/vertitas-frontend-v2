import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";

import { mapCommentPayload } from "@/lib/markets/data";
import type { FeaturedComment } from "@/lib/markets/types";

// The socket.io server attaches to the API's root HTTP server, NOT the
// `/api/v1` REST prefix — so we connect to the origin, dropping the path.
function socketOrigin(): string {
  const api = process.env.NEXT_PUBLIC_API_URL ?? "";
  try {
    return new URL(api).origin;
  } catch {
    return "";
  }
}

// One shared connection for the whole tab; rooms fan out per market.
let socket: Socket | null = null;
function getSocket(): Socket | null {
  if (typeof window === "undefined") return null;
  if (!socket) {
    const origin = socketOrigin();
    if (!origin) return null;
    socket = io(origin, { transports: ["websocket"], autoConnect: true });
  }
  return socket;
}

// Ref-count subscribers per market so a second listener can't leave the room
// out from under the first on unmount.
const roomCounts = new Map<string, number>();

type RawComment = Parameters<typeof mapCommentPayload>[0];

export interface CommentStreamHandlers {
  onNew?: (comment: FeaturedComment) => void;
  onUpdated?: (comment: FeaturedComment) => void;
  onDeleted?: (commentId: string) => void;
}

/**
 * Subscribes to live comment events for one market over the shared socket.
 * Handlers are read through a ref, so passing fresh closures every render does
 * NOT re-subscribe. No-ops on the server and when no socket origin is set.
 */
export function useMarketCommentStream(
  marketId: string | null,
  handlers: CommentStreamHandlers,
): void {
  const handlersRef = useRef(handlers);
  // Keep the ref current without touching it during render.
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (!marketId) return;
    const s = getSocket();
    if (!s) return;

    const join = () => s.emit("market:subscribe", marketId);
    // Re-join on every (re)connect so a dropped socket recovers its room.
    s.on("connect", join);
    if (s.connected) join();

    roomCounts.set(marketId, (roomCounts.get(marketId) ?? 0) + 1);

    const onNew = (p: { marketId: string; comment: RawComment }) => {
      if (p?.marketId !== marketId || !p.comment) return;
      handlersRef.current.onNew?.(mapCommentPayload(p.comment));
    };
    const onUpdated = (p: { marketId: string; comment: RawComment }) => {
      if (p?.marketId !== marketId || !p.comment) return;
      handlersRef.current.onUpdated?.(mapCommentPayload(p.comment));
    };
    const onDeleted = (p: { marketId: string; commentId: string }) => {
      if (p?.marketId !== marketId || !p.commentId) return;
      handlersRef.current.onDeleted?.(p.commentId);
    };

    s.on("comment:new", onNew);
    s.on("comment:updated", onUpdated);
    s.on("comment:deleted", onDeleted);

    return () => {
      s.off("connect", join);
      s.off("comment:new", onNew);
      s.off("comment:updated", onUpdated);
      s.off("comment:deleted", onDeleted);

      const next = (roomCounts.get(marketId) ?? 1) - 1;
      if (next <= 0) {
        roomCounts.delete(marketId);
        s.emit("market:unsubscribe", marketId);
      } else {
        roomCounts.set(marketId, next);
      }
    };
  }, [marketId]);
}
