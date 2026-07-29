"use client";

import { useEffect, useRef } from "react";
import { getSocket } from "./socket";

/** Keep the latest callback in a ref so room effects don't resubscribe on
 *  every render (React 19: ref writes happen inside an effect, not render). */
function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

// One socket is shared by every hook instance, but rooms are per-socket on
// the server and *:unsubscribe leaves unconditionally — so two components
// sharing a room (e.g. Topbar balance + Your Position on user:{wallet})
// must not let the first unmount evict the second. Reference-count room
// holds; only the last release actually unsubscribes.
const roomRefs = new Map<string, number>();

/** Shared across every realtime consumer (these hooks AND the comment
 *  stream): all holds on one socket room must count in ONE ledger, or the
 *  first module to fully unmount evicts the room from under the others. */
export function acquireRoom(key: string): void {
  roomRefs.set(key, (roomRefs.get(key) ?? 0) + 1);
}

/** True when this was the last holder — caller should emit the unsubscribe. */
export function releaseRoom(key: string): boolean {
  const next = (roomRefs.get(key) ?? 1) - 1;
  if (next <= 0) {
    roomRefs.delete(key);
    return true;
  }
  roomRefs.set(key, next);
  return false;
}

/** Join a token's room; fire on THIS token's order-book dirty-signals.
 *  Events arrive on the shared socket regardless of which room caused them,
 *  so the handler filters by the payload's tokenId — without this, every
 *  book event fires every token hook and refetches amplify. */
export function useTokenRoom(tokenId: string | null, onBookUpdate: () => void) {
  const saved = useLatest(onBookUpdate);
  useEffect(() => {
    const s = getSocket();
    if (!s || !tokenId) return;
    const key = "token:" + tokenId;
    acquireRoom(key);
    const handler = (p?: { tokenId?: string }) => {
      if (p?.tokenId == null || p.tokenId === tokenId) saved.current();
    };
    // (Re)join on every connection: socket.io does not restore room
    // membership after an auto-reconnect, so a bare one-shot subscribe goes
    // silently stale on the first network blip. resub() also doubles as a
    // catch-up refetch — it re-fires the handler so any events missed while
    // disconnected aren't lost until the next live emit — and covers the one
    // initial freshness fetch on mount too.
    const resub = () => { s.emit("token:subscribe", tokenId); saved.current(); };
    resub();
    s.on("connect", resub);
    s.on("order-book:update", handler);
    return () => {
      s.off("connect", resub);
      if (releaseRoom(key)) s.emit("token:unsubscribe", tokenId);
      s.off("order-book:update", handler);
    };
  }, [tokenId, saved]);
}

/** Join a market's room; fire on activity signals and resolution. The
 *  payload's `kind` ("book" | "activity") reaches onUpdate so consumers can
 *  refetch selectively; an undefined payload means catch-up (mount or
 *  reconnect) — refetch everything. */
export function useMarketRoom(
  marketId: string | null,
  handlers: {
    onUpdate?: (p?: { kind?: string }) => void;
    onResolved?: (p: { marketId: string; winningOutcome: number }) => void;
    /** Lifecycle status flip other than RESOLVED (today ACTIVE→ENDED). */
    onStatus?: (p: { marketId: string; status: string }) => void;
  },
) {
  const saved = useLatest(handlers);
  useEffect(() => {
    const s = getSocket();
    if (!s || !marketId) return;
    const key = "market:" + marketId;
    acquireRoom(key);
    const onUpdate = (p?: { kind?: string }) => saved.current.onUpdate?.(p);
    const onResolved = (p: { marketId: string; winningOutcome: number }) =>
      saved.current.onResolved?.(p);
    const onStatus = (p: { marketId: string; status: string }) =>
      saved.current.onStatus?.(p);
    // (Re)join on every connection: socket.io does not restore room
    // membership after an auto-reconnect, so a bare one-shot subscribe goes
    // silently stale on the first network blip. resub() also doubles as a
    // catch-up refetch — it re-fires onUpdate so any events missed while
    // disconnected aren't lost until the next live emit — and covers the one
    // initial freshness fetch on mount too. Deliberately excludes onResolved:
    // resolution is a one-time terminal event, not a refetchable "current
    // state" signal.
    const resub = () => { s.emit("market:subscribe", marketId); saved.current.onUpdate?.(); };
    resub();
    s.on("connect", resub);
    s.on("market:update", onUpdate);
    s.on("market:status", onStatus);
    s.on("market:resolved", onResolved);
    return () => {
      s.off("connect", resub);
      if (releaseRoom(key)) s.emit("market:unsubscribe", marketId);
      s.off("market:update", onUpdate);
      s.off("market:status", onStatus);
      s.off("market:resolved", onResolved);
    };
  }, [marketId, saved]);
}

/** Rich payload for a passive fill of the wallet's resting order — drives the
 *  "someone matched your order" toast. Mirrors the middleware's OrderMatchedPayload. */
export type OrderMatchedPayload = {
  marketId: string;
  marketTitle: string;
  outcomeLabel: string;
  side: "BUY" | "SELL";
  shares: number;
  priceCents: number;
};

/** Join the connected wallet's room; fire when balances/positions change, and
 *  (optionally) when one of the wallet's resting orders is matched by a taker. */
export function useUserRoom(
  walletAddress: string | null | undefined,
  onUpdate: () => void,
  onMatched?: (p: OrderMatchedPayload) => void,
) {
  const saved = useLatest(onUpdate);
  const savedMatched = useLatest(onMatched);
  useEffect(() => {
    const s = getSocket();
    if (!s || !walletAddress) return;
    const wallet = walletAddress.toLowerCase();
    const key = "user:" + wallet;
    acquireRoom(key);
    const handler = () => saved.current();
    const matched = (p: OrderMatchedPayload) => savedMatched.current?.(p);
    // (Re)join on every connection: socket.io does not restore room
    // membership after an auto-reconnect, so a bare one-shot subscribe goes
    // silently stale on the first network blip. resub() also doubles as a
    // catch-up refetch — it re-fires the handler so any events missed while
    // disconnected aren't lost until the next live emit — and covers the one
    // initial freshness fetch on mount too.
    const resub = () => { s.emit("user:subscribe", wallet); saved.current(); };
    resub();
    s.on("connect", resub);
    s.on("user:update", handler);
    s.on("order:matched", matched);
    return () => {
      s.off("connect", resub);
      if (releaseRoom(key)) s.emit("user:unsubscribe", wallet);
      s.off("user:update", handler);
      s.off("order:matched", matched);
    };
  }, [walletAddress, saved, savedMatched]);
}
