"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useChainId, useSignTypedData, useSwitchChain } from "wagmi";
import { sepolia } from "wagmi/chains";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import type { ApiMarket, OrderBookData } from "@/lib/markets/types";
import { oneDp, toCents } from "@/lib/markets/format";
import {
  walkBuy,
  walkSell,
  toWin,
  bookDepthDollars,
  bookDepthShares,
  complementBook,
} from "@/lib/orders/book-math";
import { buildOrderTypedData, type OrderIntent } from "@/lib/orders/eip712";
import { submitEnabled, submitSignedOrder, OrderRejectedError } from "@/lib/orders/data";
import { getCollateralDollars, getPositionShares } from "@/lib/profile/data";
import { useOracleRole } from "@/lib/uma/useOracleRole";
import { useUserRoom } from "@/lib/realtime/hooks";
import { RollingNumber } from "../profile/RollingNumber";
import { Frame } from "./Frame";
import type { TradeSelection } from "./OutcomesPanel";

type Mode = "MARKET" | "LIMIT";
type Action = "buy" | "sell";
type Phase = "idle" | "signing" | "submitting" | "done" | "error";

const EMPTY_BOOK: OrderBookData = { bids: [], asks: [] };
const CHIP_DOLLARS = [1, 20, 100] as const;

/** Strip anything that isn't a digit or a single decimal point. */
function sanitizeNumeric(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot === -1) return cleaned;
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
}

/** details amounts are 1e8 fixed-point strings. */
const dollars = (v: unknown) => (Number(v) / 1e8).toFixed(2);

function rejectionMessage(e: OrderRejectedError): string {
  switch (e.code) {
    case "INSUFFICIENT_COLLATERAL":
      return `not enough funds — $${dollars(e.details?.available)} available, $${dollars(e.details?.required)} needed`;
    case "INSUFFICIENT_SHARES":
      return `not enough shares — ${dollars(e.details?.available)} held, ${dollars(e.details?.required)} needed`;
    case "MARKET_ENDED":
      return "market has ended";
    case "MARKET_NOT_OPEN":
      return "market is not accepting orders";
    case "INVALID_TICK":
      return "price must be on the tick grid";
    case "BELOW_MIN_SIZE":
      return "order below the minimum size";
    case "ORDER_EXPIRED":
    case "DUPLICATE_ORDER":
      return "order went stale — try again";
    case "INVALID_SIGNATURE":
      return "signature rejected — reconnect your wallet";
    case "SELF_TRADE":
      return "this would match your own resting order — cancel it first or change your price";
    default:
      return e.message.slice(0, 120);
  }
}

export function TradePanel({
  market,
  selection,
  books,
  accent,
  binary = false,
  action,
  onActionChange,
}: {
  market: ApiMarket;
  selection: TradeSelection | null;
  books: OrderBookData[];
  /** Selected outcome's rank color — floods the ticket chrome and CTA. */
  accent?: string;
  /** Yes/No market — the outcome IS the market, so labels drop it. */
  binary?: boolean;
  /** Buy/Sell, owned by the page so the outcomes list can relabel its buttons. */
  action: Action;
  onActionChange: (a: Action) => void;
}) {
  const { address, isConnected, chainId: walletChainId } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  // Oracle participants (proposer / disputer / committee voter) are barred from
  // trading on ANY market — they help decide outcomes, so trading is a conflict
  // of interest. Global role, market-independent. `loaded` gates the block so a
  // normal trader isn't blocked during the read's round-trip.
  const oracleRole = useOracleRole();
  const oracleBlocked = isConnected && oracleRole.loaded && oracleRole.isOracleParticipant;
  // useChainId() reports the CONFIG's chain (falls back to sepolia even when
  // the wallet sits on mainnet), so the guard must read the wallet's actual
  // chain from useAccount — otherwise signTypedData dies with viem's
  // "Provided chainId must match the active chainId" instead of a clear CTA.
  const wrongNetwork = isConnected && walletChainId !== sepolia.id;
  const { signTypedDataAsync } = useSignTypedData();
  const { openConnectModal } = useConnectModal();

  const [mode, setMode] = useState<Mode>("MARKET");
  const [amount, setAmount] = useState(""); // MARKET: $ (buy) or shares (sell)
  const [limitCents, setLimitCents] = useState(""); // LIMIT: price in cents
  const [limitShares, setLimitShares] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // React-sanctioned "adjust state during render" — reset stale error/done
  // state when the selection prop changes context (does not clobber an
  // in-flight signing/submitting phase). Mirrors the pattern used by
  // OutcomesPanel's `Collapsible`.
  const [prevSelectionId, setPrevSelectionId] = useState(
    selection ? `${selection.outcomeId}:${selection.side}` : null,
  );
  const selectionId = selection ? `${selection.outcomeId}:${selection.side}` : null;
  if (selectionId !== prevSelectionId) {
    setPrevSelectionId(selectionId);
    if (phase === "error" || phase === "done") {
      setPhase("idle");
      setError(null);
    }
  }

  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
    };
  }, []);

  // Balance preflight (best-effort UX — the backend lock is authoritative).
  // null = unknown (loading/failed); never blocks on unknown.
  const [collateral, setCollateral] = useState<{ available: number; locked: number } | null>(null);
  const [heldShares, setHeldShares] = useState<number | null>(null);
  const [balanceEpoch, setBalanceEpoch] = useState(0); // bump to refetch after a rejection

  // Preflight numbers (balance + shares held) go stale the moment a fill
  // lands — including our own buy a second ago. The user room signals every
  // balance/position change for this wallet, so bump the epoch and let the
  // existing effects refetch; otherwise "sell 20 shares" fails preflight
  // with "0 shares" until a manual refresh.
  useUserRoom(isConnected ? address : null, () => setBalanceEpoch((n) => n + 1));

  // Hydration-safe clock: null on first paint (assume live), real after mount.
  // setState deferred into a resolved-promise callback (not called directly
  // in the effect body) per the project's set-state-in-effect lint rule.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    Promise.resolve().then(() => alive && setNow(Date.now()));
    return () => {
      alive = false;
    };
  }, []);

  const pos = selection
    ? market.outcomes.findIndex((o) => o.id === selection.outcomeId)
    : -1;
  const outcome = pos !== -1 ? market.outcomes[pos] : null;
  const side = selection?.side ?? "yes";
  const book = outcome ? books[pos] ?? EMPTY_BOOK : EMPTY_BOOK;
  // Binary NO trades walk the REAL No book (each token has its own book; the
  // matching engine only crosses same-token orders), matching OutcomesPanel's
  // "Buy no" chip. The mirrored complement view survives only as the
  // non-binary fallback, where no complement token exists.
  const noPos =
    binary && outcome
      ? market.outcomes.findIndex((o) => o.id !== outcome.id)
      : -1;
  const noOutcome = noPos !== -1 ? market.outcomes[noPos] : null;
  const tradedOutcome = side === "no" && noOutcome ? noOutcome : outcome;
  const sideBook =
    side === "no"
      ? noPos !== -1
        ? books[noPos] ?? EMPTY_BOOK
        : complementBook(book)
      : book;
  const ended = now != null && new Date(market.endTime).getTime() <= now;
  const live = market.status === "ACTIVE" && !ended;
  // Per lib/markets/types.ts: tickSize "1000000" == 1¢ (price units); minOrderSize "100000000" == 1 share (amount units).
  const tickCents = Number(market.tickSize) / 1_000_000;
  const minShares = Number(market.minOrderSize) / 100_000_000;

  useEffect(() => {
    let alive = true;
    if (!address) {
      Promise.resolve().then(() => alive && setCollateral(null));
    } else {
      getCollateralDollars(address).then((c) => alive && setCollateral(c));
    }
    return () => {
      alive = false;
    };
  }, [address, balanceEpoch]);

  useEffect(() => {
    let alive = true;
    if (!address || !tradedOutcome) {
      Promise.resolve().then(() => alive && setHeldShares(null));
    } else {
      getPositionShares(address, market.id, tradedOutcome.index).then(
        (s) => alive && setHeldShares(s),
      );
    }
    return () => {
      alive = false;
    };
  }, [address, market.id, tradedOutcome, balanceEpoch]);

  /* ---------- derived order math ---------- */
  const est = useMemo(() => {
    const n = Number(amount) || 0;
    const pc = Number(limitCents) || 0;
    const ls = Number(limitShares) || 0;
    if (mode === "MARKET") {
      if (action === "buy") {
        const w = walkBuy(sideBook.asks, n);
        return { shares: w.shares, cost: w.dollars, avg: w.avgPriceCents, exhausted: w.exhausted };
      }
      const w = walkSell(sideBook.bids, n);
      return { shares: w.shares, cost: w.dollars, avg: w.avgPriceCents, exhausted: w.exhausted };
    }
    return { shares: ls, cost: (pc / 100) * ls, avg: pc, exhausted: false };
  }, [mode, action, amount, limitCents, limitShares, sideBook]);

  const win = toWin(est.shares, market.feeBps);

  /* ---------- validation → CTA state ladder ---------- */
  // Each check returns the disabled-reason label or null.
  const invalidReason = oracleBlocked
    ? "oracle participants can’t trade"
    : !live
      ? ended
        ? "market ended"
        : "market closed"
      : !outcome
        ? "select an outcome"
        : mode === "MARKET" && (Number(amount) || 0) <= 0
          ? null // empty input: CTA shows action label, disabled without reason row
          : mode === "MARKET" && est.shares <= 0
            ? "no liquidity"
            : action === "buy" && collateral != null && est.cost > collateral.available + 1e-9
              ? `insufficient funds — $${collateral.available.toFixed(2)} available`
              : action === "sell" && heldShares != null && est.shares > heldShares + 1e-9
                ? `you hold ${heldShares.toFixed(2)} shares`
                : mode === "LIMIT" && ((Number(limitCents) || 0) <= 0 || (Number(limitShares) || 0) <= 0)
                  ? null
                  : mode === "LIMIT" &&
                    Math.abs((Number(limitCents) / tickCents) - Math.round(Number(limitCents) / tickCents)) > 1e-9
                    ? `price must step by ${tickCents}¢`
                    : est.shares > 0 && est.shares < minShares
                      ? `min order ${minShares} shares`
                      : null;
  const ready =
    live && outcome && est.shares >= minShares && invalidReason == null && phase !== "signing" && phase !== "submitting";

  /* ---------- submit ---------- */
  const placeOrder = async () => {
    if (!outcome || !address) return;
    // Safety belt: the CTA is already disabled for oracle participants, but
    // never let a role-holder's order through even if the button is reached.
    if (oracleBlocked) return;
    // Intake rejects prices off the tick grid, and a market order's VWAP can
    // land between ticks — snap toward the marketable side (buys round up,
    // sells down) so the order still crosses, clamped inside (0, 100).
    const snapped =
      action === "buy"
        ? Math.min(100 - tickCents, Math.ceil(est.avg / tickCents) * tickCents)
        : Math.max(tickCents, Math.floor(est.avg / tickCents) * tickCents);
    const intent: OrderIntent = {
      marketId: market.id,
      // The outcome token actually traded: a binary NO order trades the real
      // NO token at its own book's price — no complement re-encoding.
      outcome: tradedOutcome!,
      side,
      action,
      orderType: mode,
      priceCents: snapped,
      shares: est.shares,
      // Live until the market ends — no premature expiry emptying the book.
      expirationMs: new Date(market.endTime).getTime(),
    };
    setError(null);
    setPhase("signing");
    try {
      const { wire, ...typed } = buildOrderTypedData(intent, address, chainId);
      const signature = await signTypedDataAsync(typed);
      if (submitEnabled) {
        setPhase("submitting");
        await submitSignedOrder(wire, signature);
      }
      setPhase("done");
      if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = setTimeout(() => setPhase("idle"), 2500);
      setAmount("");
      setLimitShares("");
      // Our own order just moved balance/shares — refresh preflight without
      // waiting for the socket round-trip (also covers socket-down mode).
      setBalanceEpoch((n) => n + 1);
    } catch (e) {
      // Backend rejection: check first — OrderRejectedError's fallback
      // message is literally "order rejected (N)", which would otherwise
      // match the wallet-rejection regex below and get silently swallowed.
      if (e instanceof OrderRejectedError) {
        setError(rejectionMessage(e));
        setPhase("error");
        // A balance rejection means our preflight numbers were stale.
        if (e.code === "INSUFFICIENT_COLLATERAL" || e.code === "INSUFFICIENT_SHARES") {
          setBalanceEpoch((n) => n + 1);
        }
        return;
      }
      // Wallet rejection = user changed their mind, silent reset.
      const msg = e instanceof Error ? e.message : String(e);
      if (/rejected|denied/i.test(msg)) {
        setPhase("idle");
        return;
      }
      setError(msg.slice(0, 120));
      setPhase("error");
    }
  };

  /* ---------- CTA label ---------- */
  const cta = !isConnected
    ? "CONNECT"
    : oracleBlocked
      ? "TRADING DISABLED"
      : phase === "signing"
        ? "CONFIRM IN WALLET…"
        : phase === "submitting"
          ? "SUBMITTING…"
          : phase === "done"
            ? submitEnabled
              ? "ORDER PLACED"
              : "ORDER SIGNED"
            : (binary
              ? `${action} ${side}`
              : `${action} ${side} — ${outcome?.label ?? ""}`
            ).toUpperCase();

  const yesToneActive = side === "yes";
  // Buy shows the ask (what you pay); Sell shows the bid (what you receive).
  const outcomeLevel = action === "sell" ? sideBook.bids[0] : sideBook.asks[0];
  const outcomeCents = outcome && outcomeLevel ? toCents(outcomeLevel.price) : null;

  // Wrapped setters: switching mode/action mid-error or post-done should
  // drop the stale banner/label, but never clobber an in-flight wallet
  // prompt (signing/submitting).
  const changeMode = (m: Mode) => {
    setMode(m);
    if (phase === "error" || phase === "done") {
      setPhase("idle");
      setError(null);
    }
  };

  const changeAction = (a: Action) => {
    onActionChange(a);
    if (phase === "error" || phase === "done") {
      setPhase("idle");
      setError(null);
    }
  };

  const addChipDollars = (d: number) => {
    const current = Number(amount) || 0;
    setAmount(String(current + d));
  };

  const setMax = () => {
    if (mode === "MARKET") {
      if (action === "buy") {
        setAmount(String(bookDepthDollars(sideBook.asks)));
      } else {
        setAmount(String(bookDepthShares(sideBook.bids)));
      }
    } else {
      setLimitShares(
        String(
          action === "buy"
            ? bookDepthShares(sideBook.asks)
            : bookDepthShares(sideBook.bids),
        ),
      );
    }
  };

  const stepLimitPrice = (dir: 1 | -1) => {
    const current = Number(limitCents) || 0;
    const next = Math.max(0, current + dir * tickCents);
    setLimitCents(String(Math.round(next * 100) / 100));
  };

  // The ticket floods with the selected outcome's rank color: full strength
  // on the ticks, label, dot, and CTA; the border runs at partial opacity.
  const flood = accent ?? "var(--color-accent)";
  const dimFlood = `color-mix(in srgb, ${flood} 45%, transparent)`;
  const busy = phase === "signing" || phase === "submitting";

  const modeTabs = (
    <div role="tablist" aria-label="Order type" className="flex items-center gap-1">
      {(["MARKET", "LIMIT"] as const).map((m) => {
        const on = mode === m;
        return (
          <button
            key={m}
            role="tab"
            aria-selected={on}
            onClick={() => changeMode(m)}
            className={`px-2.5 py-1 rounded border font-mono text-[11px] tracking-[0.14em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${on ? "text-fg bg-fg/10 border-fg/25" : "text-muted border-fg/15 bg-fg/[0.04] hover:text-fg/90 hover:border-fg/35"
              }`}
          >
            {m}
          </button>
        );
      })}
    </div>
  );

  return (
    <Frame
      label="TRADE"
      ariaLabel="Trade"
      accent={dimFlood}
      tickColor={flood}
      right={modeTabs}
    >
      {/* Oracle participants (proposer / disputer / voter) are barred from
          trading — cover the whole panel rather than hide it, so the context
          stays visible behind a dimmed, non-interactive veil. */}
      {oracleBlocked && (
        <div
          role="note"
          aria-label="Trading disabled for oracle participants"
          className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-surface/85 px-8 text-center backdrop-blur-[3px]"
        >
          <span aria-hidden="true" className="text-2xl leading-none text-muted/70">
            ⊘
          </span>
          <p className="font-pixel text-lg uppercase tracking-[0.12em] text-fg">
            trading disabled
          </p>
          <p className="max-w-[15rem] font-mono text-[11px] leading-relaxed uppercase tracking-[0.1em] text-muted">
            oracle participants can’t trade — your wallet helps decide market
            outcomes
          </p>
        </div>
      )}

      {/* outcome strip: color dot + label + side chip + live cents */}
      <div className="flex items-center gap-2 px-5 pt-1 pb-3 border-b border-line/50">
        <span
          aria-hidden="true"
          className="w-2 h-2 shrink-0 transition-colors duration-300"
          style={{ background: flood }}
        />
        <span className="text-sm text-fg truncate">
          {outcome ? (binary ? "Yes / No" : outcome.label) : "select an outcome"}
        </span>
        <span
          className={`ml-auto shrink-0 px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.08em] ${yesToneActive ? "bg-yes/10 text-yes" : "bg-no/10 text-no"
            }`}
        >
          {side}
        </span>
        <span className="font-mono tabular-nums text-sm text-fg shrink-0">
          {outcomeCents != null ? `${oneDp(outcomeCents)}¢` : "—"}
        </span>
      </div>

      {/* BUY/SELL tabs */}
      <div className="grid grid-cols-2 gap-2 px-5 pt-3">
        {(["buy", "sell"] as const).map((a) => {
          const on = action === a;
          const tone =
            a === "buy"
              ? on
                ? "bg-yes/15 text-yes border-yes/40"
                : "border-line text-muted hover:text-fg/80"
              : on
                ? "bg-no/15 text-no border-no/40"
                : "border-line text-muted hover:text-fg/80";
          return (
            <button
              key={a}
              aria-pressed={on}
              onClick={() => changeAction(a)}
              className={`px-3 py-2 border font-mono text-[11px] uppercase tracking-[0.14em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${tone}`}
            >
              {a}
            </button>
          );
        })}
      </div>

      {/* inputs */}
      <div className="px-5 pt-4">
        {mode === "MARKET" ? (
          <>
            <div className="flex items-center gap-1">
              {action === "buy" && (
                <span className="font-mono text-3xl text-muted">$</span>
              )}
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(sanitizeNumeric(e.target.value))}
                placeholder="0"
                aria-label={action === "buy" ? "Amount in dollars" : "Amount in shares"}
                className="w-full bg-transparent font-mono text-3xl text-fg placeholder:text-muted/40 focus-visible:outline-none"
              />
            </div>
            <div className="flex items-center gap-1.5 pt-2">
              {action === "buy" &&
                CHIP_DOLLARS.map((d) => (
                  <button
                    key={d}
                    onClick={() => addChipDollars(d)}
                    className="px-2 py-1 border border-line font-mono text-[11px] uppercase tracking-[0.1em] text-muted hover:text-fg/80 hover:border-line/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                  >
                    +${d}
                  </button>
                ))}
              <button
                onClick={setMax}
                className="px-2 py-1 border border-line font-mono text-[11px] uppercase tracking-[0.1em] text-muted hover:text-fg/80 hover:border-line/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                MAX
              </button>
            </div>
          </>
        ) : (
          <>
            <label className="block font-mono text-[11px] uppercase tracking-[0.14em] text-muted mb-1.5">
              limit price
            </label>
            <div className="flex items-center gap-2">
              <button
                aria-label="Decrease price"
                onClick={() => stepLimitPrice(-1)}
                className="px-2 py-1 border border-line font-mono text-sm text-muted hover:text-fg/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                −
              </button>
              <input
                inputMode="decimal"
                value={limitCents}
                onChange={(e) => setLimitCents(sanitizeNumeric(e.target.value))}
                placeholder="0"
                aria-label="Limit price in cents"
                className="w-full bg-transparent text-center font-mono text-3xl text-fg placeholder:text-muted/40 focus-visible:outline-none"
              />
              <button
                aria-label="Increase price"
                onClick={() => stepLimitPrice(1)}
                className="px-2 py-1 border border-line font-mono text-sm text-muted hover:text-fg/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                +
              </button>
            </div>
            <label className="block font-mono text-[11px] uppercase tracking-[0.14em] text-muted mb-1.5 mt-4">
              shares
            </label>
            <div className="flex items-center gap-1.5">
              <input
                inputMode="decimal"
                value={limitShares}
                onChange={(e) => setLimitShares(sanitizeNumeric(e.target.value))}
                placeholder="0"
                aria-label="Shares"
                className="w-full bg-transparent font-mono text-lg text-fg placeholder:text-muted/40 focus-visible:outline-none border border-line px-2 py-1"
              />
              <button
                onClick={setMax}
                className="px-2 py-1 border border-line font-mono text-[11px] uppercase tracking-[0.1em] text-muted hover:text-fg/80 hover:border-line/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                MAX
              </button>
            </div>
          </>
        )}
      </div>

      {/* readout rows */}
      <div className="flex flex-col gap-1.5 px-5 pt-4 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
        <div className="flex items-center justify-between">
          <span>{action === "buy" ? "balance" : "you hold"}</span>
          <span className="tabular-nums text-fg/85">
            {action === "buy"
              ? collateral != null
                ? `$${collateral.available.toFixed(2)}`
                : "—"
              : heldShares != null
                ? `${heldShares.toFixed(2)} sh`
                : "—"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>avg price</span>
          <span className="tabular-nums text-fg/85">{est.avg > 0 ? `${oneDp(est.avg)}¢` : "—"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>{action === "buy" ? "est shares" : "est proceeds"}</span>
          <span className="tabular-nums text-fg/85">
            {action === "buy" ? est.shares.toFixed(2) : `$${est.cost.toFixed(2)}`}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>to win</span>
          <RollingNumber value={win} currency decimals={2} className="text-yes" />
        </div>
        {est.exhausted && (
          <p className="text-[11px] normal-case tracking-normal text-muted/70 pt-1">
            partial fill only — book depth exhausted
          </p>
        )}
      </div>

      {/* CTA button */}
      <div className="px-5 pt-4">
        <button
          disabled={isConnected && !wrongNetwork && !ready}
          onClick={
            !isConnected
              ? openConnectModal
              : wrongNetwork
                ? () => switchChain({ chainId: sepolia.id })
                : placeOrder
          }
          style={
            isConnected && !wrongNetwork && !ready
              ? undefined
              : { background: flood, color: "var(--color-bg)" }
          }
          className={`relative overflow-hidden w-full px-4 py-3 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${busy ? "cta-busy" : ""
            } ${isConnected && !wrongNetwork && !ready ? "bg-fg/10 text-muted" : ""}`}
        >
          {wrongNetwork ? "switch wallet to sepolia" : cta}
        </button>
        {isConnected && invalidReason && (
          <p className="pt-2 text-center font-mono text-[11px] uppercase tracking-[0.1em] text-muted/70">
            {invalidReason}
          </p>
        )}
      </div>

      {/* error row */}
      {phase === "error" && error && (
        <div className="px-5 pt-2" role="alert">
          <p className="font-mono text-[11px] text-no">{error}</p>
        </div>
      )}

      {/* footer microcopy */}
      <div className="px-5 py-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted/50">
          {"orders are eip-712 signed"}
        </p>
      </div>
    </Frame>
  );
}
