"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useAccount } from "wagmi";
import type { ApiMarket } from "@/lib/markets/types";
import { useUmaState } from "@/lib/uma/useUmaState";
import { Frame } from "../Frame";
import { StagePill, toneForLabel } from "./atoms";
import { BondForm } from "./BondForms";
import { VotePanel } from "./VotePanel";

function walletShort(w: string): string {
  return `${w.slice(0, 6)}…${w.slice(-4)}`;
}

/** Live countdown to the challenge-window close. Interval lives in an
 *  effect with cleanup (React 19 rule); null until mounted (SSR-safe). */
function Countdown({ deadlineMs }: { deadlineMs: number }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, 1_000);
    const t = setTimeout(tick, 0);
    return () => {
      clearInterval(id);
      clearTimeout(t);
    };
  }, []);
  if (now == null) return <span className="tabular-nums">—</span>;
  const left = Math.max(0, deadlineMs - now);
  if (left === 0) {
    return (
      <span className="text-[13px] uppercase tracking-[0.16em]">
        bell rung — settling…
      </span>
    );
  }
  const h = Math.floor(left / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  const s = Math.floor((left % 60_000) / 1_000);
  return (
    <span className="tabular-nums">
      {h}h {String(m).padStart(2, "0")}m {String(s).padStart(2, "0")}s
    </span>
  );
}

/** One side of the arena. `tone` colors the border + heading; `dormant`
 *  renders the dashed, waiting variant. Pure chrome — nothing here is
 *  clickable unless the child itself is a form. */
function Corner({
  title,
  tone,
  dormant = false,
  children,
}: {
  title: string;
  tone: string;
  dormant?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`flex flex-col justify-center gap-2 p-4 border ${dormant ? "border-dashed border-line" : ""}`}
      style={dormant ? undefined : { borderColor: tone }}
    >
      <p
        className="text-center font-mono text-sm font-bold uppercase tracking-[0.22em]"
        style={{ color: dormant ? "var(--color-muted)" : tone }}
      >
        {title}
      </p>
      {children}
    </div>
  );
}

function VsDivider() {
  return (
    <div className="flex items-center justify-center sm:flex-col gap-1.5 py-1">
      <span className="hidden sm:block w-px h-6 bg-line" aria-hidden="true" />
      <span className="font-mono text-lg tracking-[0.1em] text-fg/80 select-none">
        VS
      </span>
      <span className="hidden sm:block w-px h-6 bg-line" aria-hidden="true" />
    </div>
  );
}

/**
 * Oracle participation desk, staged as a truth match: proposer's corner vs
 * challenger's corner, bonds on the table, the challenge window as a round
 * clock, the committee as judges. Visible ONLY to whitelisted wallets on
 * ended UMA markets — everyone else keeps the rail's "determining winner"
 * panel. Interaction hierarchy: filled buttons and outcome chips are the
 * clickable elements; everything else is readout.
 */
export function OracleDesk({ market }: { market: ApiMarket }) {
  const { isConnected } = useAccount();
  // Poll the chain ONLY where an oracle fight can exist: UMA market, past
  // its end, not yet resolved. Everywhere else (admin markets, still-trading
  // UMA, resolved pages, spectators on those) the hook stays dormant — zero
  // RPC. liveStatus flows in via the market prop, so the switch flips (and
  // polling starts/stops) without a refresh when the market ends/resolves.
  const oracleLive =
    market.resolverType === "UMA" && market.status === "ENDED";
  const uma = useUmaState(market, oracleLive);

  if (market.resolverType !== "UMA") return null;
  if (market.status !== "ENDED") return null;
  if (!isConnected || !uma.hasAnyRole) return null;
  if (uma.status == null) return null; // oracle unreachable / still loading
  if (uma.status >= 4) return null; // resolved — ResolutionPanel takes over

  const labelFor = (index: number) =>
    market.outcomes.find((o) => o.index === index)?.label ?? `#${index}`;
  const proposed = uma.events.assertion;
  const proposedLabel = proposed ? labelFor(proposed.outcomeIndex) : null;
  // Corners tone by the outcome they BACK (label convention); before a claim
  // exists the proposer corner carries the neutral accent, and the challenger
  // corner always carries the challenge red as its identity.
  const proposerTone = proposedLabel
    ? toneForLabel(proposedLabel)
    : "var(--color-accent)";
  const disputerLabel =
    market.outcomes.length === 2 && proposed != null
      ? (market.outcomes.find((o) => o.index !== proposed.outcomeIndex)
          ?.label ?? null)
      : null;
  const challengerTone =
    disputerLabel != null ? toneForLabel(disputerLabel) : "var(--color-no)";
  const bondVtk = (Number(uma.bondThreshold ?? 0n) / 1e6).toFixed(0);
  const arena =
    "grid grid-cols-1 sm:grid-cols-[1fr_56px_1fr] gap-3 sm:gap-0 items-stretch";

  return (
    <Frame
      label="ORACLE DESK // TRUTH MATCH"
      ariaLabel="UMA oracle participation"
    >
      <div className="px-5 py-4 flex flex-col gap-4">
        {/* Stage rail + round clock */}
        <div className="flex flex-wrap items-center gap-2">
          <StagePill n={1} label="propose" active={uma.status <= 1} />
          <StagePill n={2} label="challenge" active={uma.status === 2} />
          <StagePill n={3} label="vote" active={uma.status === 3} />
        </div>

        {/* Round clock — front and center the moment a proposer exists */}
        {uma.status === 2 && (
          <div className="flex flex-col items-center gap-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
              challenge window closes in
            </p>
            {uma.deadlineMs != null ? (
              <p className="font-mono text-3xl tracking-[0.06em] text-accent">
                <Countdown deadlineMs={uma.deadlineMs} />
              </p>
            ) : (
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted/70">
                syncing round clock…
              </p>
            )}
          </div>
        )}

        {/* Stage 1 — awaiting a proposal */}
        {uma.status <= 1 && (
          <div className={arena}>
            <Corner title="proposer corner" tone="var(--color-accent)">
              {uma.roles.proposer ? (
                <BondForm mode="propose" market={market} uma={uma} />
              ) : (
                <p className="py-3 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
                  awaiting a proposer — {bondVtk} vtk stakes the claim
                </p>
              )}
            </Corner>
            <VsDivider />
            <Corner title="challenger corner" tone={challengerTone} dormant>
              <p className="py-3 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-muted/70">
                opens after a claim lands
              </p>
            </Corner>
          </div>
        )}

        {/* Stage 2 — claim posted, challenge window running */}
        {uma.status === 2 && (
          <>
            <div className={arena}>
              <Corner title="proposer" tone={proposerTone}>
                <p
                  className="text-center font-mono text-2xl uppercase tracking-[0.08em]"
                  style={{ color: proposerTone }}
                >
                  {proposedLabel ?? "…"}
                </p>
                {proposed && (
                  <p className="text-center font-mono text-[11px] tracking-[0.1em] text-muted">
                    {walletShort(proposed.proposer)}
                  </p>
                )}
                <p className="text-center font-mono text-[11px] uppercase tracking-[0.14em] text-fg/85">
                  {bondVtk} vtk on the table
                </p>
              </Corner>
              <VsDivider />
              <Corner
                title="open challenge"
                tone={challengerTone}
                dormant={!uma.roles.disputer}
              >
                {uma.roles.disputer ? (
                  <BondForm mode="dispute" market={market} uma={uma} />
                ) : (
                  <p className="py-3 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-muted/70">
                    a disputer may step in before the bell
                  </p>
                )}
              </Corner>
            </div>
            <p className="text-center font-mono text-[10px] uppercase tracking-[0.16em] text-muted/60">
              no challenge before the bell → {proposedLabel ?? "the claim"}{" "}
              wins by walkover
            </p>
          </>
        )}

        {/* Stage 3 — disputed, judges decide */}
        {uma.status === 3 && (
          <>
            <div className={arena}>
              <Corner title="proposer" tone={proposerTone}>
                <p
                  className="text-center font-mono text-xl uppercase tracking-[0.08em]"
                  style={{ color: proposerTone }}
                >
                  {proposedLabel ?? "…"}
                </p>
                {proposed && (
                  <p className="text-center font-mono text-[11px] tracking-[0.1em] text-muted">
                    {walletShort(proposed.proposer)} · {bondVtk} vtk
                  </p>
                )}
              </Corner>
              <VsDivider />
              <Corner title="disputer" tone={challengerTone}>
                <p
                  className="text-center font-mono text-xl uppercase tracking-[0.08em]"
                  style={{ color: challengerTone }}
                >
                  {disputerLabel ?? "counter-claim"}
                </p>
                {uma.events.dispute && (
                  <p className="text-center font-mono text-[11px] tracking-[0.1em] text-muted">
                    {walletShort(uma.events.dispute.disputer)} · {bondVtk} vtk
                  </p>
                )}
              </Corner>
            </div>
            <VotePanel market={market} uma={uma} />
          </>
        )}
      </div>
    </Frame>
  );
}
