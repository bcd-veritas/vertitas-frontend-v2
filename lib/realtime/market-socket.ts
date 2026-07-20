"use client";

import { useEffect, useRef } from "react";

import { mapCommentPayload } from "@/lib/markets/data";
import type { FeaturedComment } from "@/lib/markets/types";
import { getSocket } from "./socket";
import { acquireRoom, releaseRoom } from "./hooks";

type RawComment = Parameters<typeof mapCommentPayload>[0];

export interface CommentStreamHandlers {
  onNew?: (comment: FeaturedComment) => void;
  onUpdated?: (comment: FeaturedComment) => void;
  onDeleted?: (commentId: string) => void;
  onCatchUp?: () => void;
}

/**
 * Subscribes to live comment events for one market over the app's SHARED
 * socket (see ./socket.ts — one connection per tab, rooms fan out on it).
 * Room holds go through the shared acquire/release ledger in ./hooks.ts:
 * TerminalPage's market hook and this stream ride the same market:{id} room,
 * so whichever unmounts last is the one that actually unsubscribes.
 *
 * Handlers are read through a ref, so passing fresh closures every render
 * does NOT re-subscribe. No-ops on the server and when no socket exists.
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
    const key = "market:" + marketId;
    acquireRoom(key);

    const join = () => s.emit("market:subscribe", marketId);
    const rejoin = () => {
      join();
      handlersRef.current.onCatchUp?.();
    };
    s.on("connect", rejoin);
    if (s.connected) join();

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
      s.off("connect", rejoin);
      s.off("comment:new", onNew);
      s.off("comment:updated", onUpdated);
      s.off("comment:deleted", onDeleted);
      if (releaseRoom(key)) s.emit("market:unsubscribe", marketId);
    };
  }, [marketId]);
}
