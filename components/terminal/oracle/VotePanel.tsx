"use client";

import { useEffect, useState } from "react";
import { useAccount, useWriteContract } from "wagmi";
import type { ApiMarket } from "@/lib/markets/types";
import { umaOracleAbi } from "@/lib/uma/abi";
import { UMA_ORACLE, UMA_VOTE_QUIET_MS } from "@/lib/uma/config";
import type { UmaState } from "@/lib/uma/useUmaState";
import { toneForLabel } from "./atoms";
import { TxButton } from "./TxButton";

function walletShort(w: string): string {
  return `${w.slice(0, 6)}…${w.slice(-4)}`;
}

/** Deliberation clock: counts down the vote-quiet window ("going… going…
 *  gone"). Each new ballot moves the anchor, so the clock visibly resets.
 *  Interval lives in an effect with cleanup (React 19 rule). */
function QuietClock({ deadlineMs }: { deadlineMs: number }) {
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
  if (now == null) return null;
  const left = Math.max(0, deadlineMs - now);
  if (left === 0) {
    return (
      <p className="text-center font-mono text-[11px] uppercase tracking-[0.16em] text-accent">
        deliberation over — finalizing on the next sweep
      </p>
    );
  }
  const m = Math.floor(left / 60_000);
  const s = Math.floor((left % 60_000) / 1_000);
  return (
    <p className="text-center font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
      finalizes in{" "}
      <span className="tabular-nums text-accent">
        {m}m {String(s).padStart(2, "0")}s
      </span>{" "}
      — a new vote resets the clock
    </p>
  );
}

/**
 * The judges' table: committee voting on a disputed match. Tallies come from
 * Voted events (visible to every role); the vote buttons — the only
 * clickable elements, rendered filled — appear only for committee members
 * who haven't voted. The on-chain committee size isn't readable, so quorum
 * shows as the configured threshold of votes cast. The cron finalizes
 * automatically once quorum is reached.
 */
export function VotePanel({
  market,
  uma,
}: {
  market: ApiMarket;
  uma: UmaState;
}) {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();

  if (uma.onchainMarketId == null) return null;
  const marketId = uma.onchainMarketId;

  const labelFor = (index: number | null) =>
    index == null
      ? null
      : (market.outcomes.find((o) => o.index === index)?.label ?? `#${index}`);
  const proposedLabel = labelFor(uma.events.assertion?.outcomeIndex ?? null);
  // Binary market: the disputer necessarily backs the other outcome. With
  // more outcomes the Disputed event doesn't carry the pick — stay generic.
  const disputerLabel =
    market.outcomes.length === 2 && uma.events.assertion != null
      ? (market.outcomes.find(
          (o) => o.index !== uma.events.assertion!.outcomeIndex,
        )?.label ?? null)
      : null;

  const proposerTone = toneForLabel(proposedLabel);
  const disputerTone =
    disputerLabel != null ? toneForLabel(disputerLabel) : "var(--color-no)";

  const votes = uma.events.votes;
  const forProposer = votes.filter((v) => v.supportProposer).length;
  const against = votes.length - forProposer;
  const proposerPct =
    votes.length === 0 ? 50 : Math.round((forProposer / votes.length) * 100);
  const myVote = address
    ? votes.find((v) => v.voter.toLowerCase() === address.toLowerCase())
    : undefined;

  return (
    <div className="flex flex-col gap-4">
      {/* Tug-of-war meter */}
      <div>
        <div
          className="flex h-3.5 border border-line/70 overflow-hidden"
          role="img"
          aria-label={`Votes: ${forProposer} for the proposer, ${against} for the disputer`}
        >
          <div
            className="transition-all duration-500"
            style={{ width: `${proposerPct}%`, background: proposerTone, opacity: votes.length === 0 ? 0.25 : 0.9 }}
          />
          <div
            className="transition-all duration-500"
            style={{ width: `${100 - proposerPct}%`, background: disputerTone, opacity: votes.length === 0 ? 0.25 : 0.9 }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.12em]">
          <span style={{ color: proposerTone }}>
            {forProposer} vote{forProposer === 1 ? "" : "s"} proposer
          </span>
          {uma.quorumBps != null && (
            <span className="text-muted/70">
              {(uma.quorumBps / 100).toFixed(0)}% of votes cast required
            </span>
          )}
          <span style={{ color: disputerTone }}>
            {against} vote{against === 1 ? "" : "s"} disputer
          </span>
        </div>
      </div>

      {/* Deliberation clock — silence finalizes, ballots reset it */}
      {votes.length === 0 ? (
        <p className="text-center font-mono text-[11px] uppercase tracking-[0.16em] text-muted/70">
          the judges&apos; clock starts at the first ballot
        </p>
      ) : (
        uma.lastVoteAtMs != null && (
          <QuietClock deadlineMs={uma.lastVoteAtMs + UMA_VOTE_QUIET_MS} />
        )
      )}

      {/* Judges who have voted */}
      {votes.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {votes.map((v) => (
            <span
              key={v.voter}
              className="border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em]"
              style={{
                borderColor: v.supportProposer ? proposerTone : disputerTone,
                color: v.supportProposer ? proposerTone : disputerTone,
              }}
            >
              judge {walletShort(v.voter)} →{" "}
              {v.supportProposer
                ? (proposedLabel ?? "proposer")
                : (disputerLabel ?? "disputer")}
            </span>
          ))}
        </div>
      )}

      {/* Committee actions — filled buttons, the only clickable elements */}
      {uma.roles.committee &&
        (myVote ? (
          <p className="text-center font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            you voted —{" "}
            <span className="text-fg/85">
              {myVote.supportProposer
                ? `proposer${proposedLabel ? ` (${proposedLabel})` : ""}`
                : `disputer${disputerLabel ? ` (${disputerLabel})` : ""}`}
            </span>
          </p>
        ) : (
          <div className="flex flex-wrap items-start justify-center gap-3">
            <TxButton
              label={`vote proposer${proposedLabel ? ` (${proposedLabel})` : ""}`}
              tone={proposerTone}
              send={() =>
                writeContractAsync({
                  address: UMA_ORACLE,
                  abi: umaOracleAbi,
                  functionName: "vote",
                  args: [marketId, true],
                })
              }
              onConfirmed={uma.refetch}
            />
            <TxButton
              label={`vote disputer${disputerLabel ? ` (${disputerLabel})` : ""}`}
              tone={disputerTone}
              send={() =>
                writeContractAsync({
                  address: UMA_ORACLE,
                  abi: umaOracleAbi,
                  functionName: "vote",
                  args: [marketId, false],
                })
              }
              onConfirmed={uma.refetch}
            />
          </div>
        ))}
    </div>
  );
}
