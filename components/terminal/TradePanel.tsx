"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useChainId, useSignTypedData } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import type { ApiMarket, OrderBookData } from "@/lib/markets/types";
import { binaryYesOutcome, oneDp, toCents } from "@/lib/markets/format";
import {
  walkBuy,
  walkSell,
  toWin,
  bookDepthDollars,
  bookDepthShares,
  complementBook,
} from "@/lib/orders/book-math";
import { buildOrder, type OrderIntent } from "@/lib/orders/eip712";
import { submitEnabled, submitSignedOrder } from "@/lib/orders/data";
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
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
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

  const pos = selection
    ? market.outcomes.findIndex((o) => o.id === selection.outcomeId)
    : -1;
  const outcome = pos !== -1 ? market.outcomes[pos] : null;
  const side = selection?.side ?? "yes";
  const book = outcome ? books[pos] ?? EMPTY_BOOK : EMPTY_BOOK;
  // NO trades walk the complementary book (YES bids/asks mirrored at 100−p),
  // matching OutcomesPanel's "Buy no" chip and eip712's complement mapping.
  const sideBook = side === "no" ? complementBook(book) : book;
  // The real token this order trades. Binary markets map the selected side to
  // the Yes or No outcome token; multi-outcome only trades the outcome's own
  // token. Null → not directly submittable (CTA blocked).
  const orderTokenId: string | null = !outcome
    ? null
    : (() => {
      const yes = binaryYesOutcome(market.outcomes);
      if (yes) {
        const no = market.outcomes.find((o) => o.id !== yes.id);
        return side === "yes" ? yes.tokenId : no?.tokenId ?? null;
      }
      return side === "yes" ? outcome.tokenId : null;
    })();
  const live = market.status === "ACTIVE";
  // Per lib/markets/types.ts: tickSize "10000" == 1¢; minOrderSize "1000000" == 1 share.
  const tickCents = Number(market.tickSize) / 10_000;
  const minShares = Number(market.minOrderSize) / 1_000_000;

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
  const invalidReason = !live
    ? "market closed"
    : !outcome
      ? "select an outcome"
      : mode === "MARKET" && (Number(amount) || 0) <= 0
        ? null // empty input: CTA shows action label, disabled without reason row
        : mode === "MARKET" && est.shares <= 0
          ? "no liquidity"
          : mode === "LIMIT" && ((Number(limitCents) || 0) <= 0 || (Number(limitShares) || 0) <= 0)
            ? null
            : mode === "LIMIT" &&
              Math.abs((Number(limitCents) / tickCents) - Math.round(Number(limitCents) / tickCents)) > 1e-9
              ? `price must step by ${tickCents}¢`
              : est.shares > 0 && est.shares < minShares
                ? `min order ${minShares} shares`
                : null;
  const ready =
    live && outcome && orderTokenId && est.shares >= minShares && invalidReason == null && phase !== "signing" && phase !== "submitting";

  /* ---------- submit ---------- */
  const placeOrder = async () => {
    if (!outcome || !address || !orderTokenId) return;
    // Limit orders use the typed price/size; market orders use the walked avg.
    const priceCents = mode === "LIMIT" ? Number(limitCents) || 0 : est.avg;
    const shares = mode === "LIMIT" ? Number(limitShares) || 0 : est.shares;
    const intent: OrderIntent = {
      marketId: market.id,
      tokenId: orderTokenId,
      action,
      orderType: mode,
      priceCents,
      shares,
    };
    setError(null);
    setPhase("signing");
    try {
      const { typedData, body } = buildOrder(intent, address, chainId);
      const signature = await signTypedDataAsync(typedData);
      if (submitEnabled) {
        setPhase("submitting");
        await submitSignedOrder({ ...body, signature });
      }
      setPhase("done");
      if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = setTimeout(() => setPhase("idle"), 2500);
      setAmount("");
      setLimitShares("");
    } catch (e) {
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
            className={`px-2.5 py-1 rounded border font-mono text-[11px] tracking-[0.14em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${on ? "text-fg bg-fg/10 border-fg/25" : "text-muted border-fg/15 bg-fg/4 hover:text-fg/90 hover:border-fg/35"
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
                    className="px-2 py-1 border border-line font-mono text-[11px] uppercase tracking-widest text-muted hover:text-fg/80 hover:border-line/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                  >
                    +${d}
                  </button>
                ))}
              <button
                onClick={setMax}
                className="px-2 py-1 border border-line font-mono text-[11px] uppercase tracking-widest text-muted hover:text-fg/80 hover:border-line/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
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
                className="px-2 py-1 border border-line font-mono text-[11px] uppercase tracking-widest text-muted hover:text-fg/80 hover:border-line/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
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
          disabled={!ready && isConnected}
          onClick={isConnected ? placeOrder : openConnectModal}
          style={!ready && isConnected ? undefined : { background: flood, color: "var(--color-bg)" }}
          className={`relative overflow-hidden w-full px-4 py-3 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${busy ? "cta-busy" : ""
            } ${!ready && isConnected ? "bg-fg/10 text-muted" : ""}`}
        >
          {cta}
        </button>
        {isConnected && invalidReason && (
          <p className="pt-2 text-center font-mono text-[11px] uppercase tracking-widest text-muted/70">
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
        <p className="font-mono text-[11px] uppercase tracking-widest text-muted/50">
          {submitEnabled
            ? "orders are eip-712 signed · sim.data"
            : "orders are eip-712 signed · submission pending backend · sim.data"}
        </p>
      </div>
    </Frame>
  );
}
