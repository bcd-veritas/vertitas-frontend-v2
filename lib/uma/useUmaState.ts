"use client";

import { useCallback, useEffect, useState } from "react";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useReadContracts,
} from "wagmi";
import type { ApiMarket } from "@/lib/markets/types";
import { UMA_FROM_BLOCK, UMA_ORACLE, VTK_TOKEN } from "./config";
import {
  assertionCreatedEvent,
  disputedEvent,
  erc20Abi,
  predictionMarketAbi,
  umaOracleAbi,
  votedEvent,
} from "./abi";

/** 0/1 = awaiting assertion, 2 = ASSERTED, 3 = DISPUTED, 4 = RESOLVED, 5 = SETTLED. */
export type UmaStatus = 0 | 1 | 2 | 3 | 4 | 5;

export type UmaEvents = {
  assertion: { proposer: `0x${string}`; outcomeIndex: number } | null;
  dispute: { disputer: `0x${string}` } | null;
  votes: { voter: `0x${string}`; supportProposer: boolean }[];
};

export type UmaState = {
  onchainMarketId: `0x${string}` | null;
  status: UmaStatus | null;
  /** Unix ms when the challenge window closes (null until asserted). */
  deadlineMs: number | null;
  /** Unix ms of the latest committee vote (null = no votes yet) — anchors
   *  the deliberation quiet window on disputed markets. */
  lastVoteAtMs: number | null;
  bondThreshold: bigint | null;
  quorumBps: number | null;
  roles: { proposer: boolean; disputer: boolean; committee: boolean };
  hasAnyRole: boolean;
  walletVtk: bigint | null;
  allowance: bigint | null;
  events: UmaEvents;
  /** Refresh everything (call after own tx confirms). */
  refetch: () => void;
};

const ORACLE = { address: UMA_ORACLE, abi: umaOracleAbi } as const;

export function useUmaState(market: ApiMarket, enabled = true): UmaState {
  const { address } = useAccount();
  const client = usePublicClient();
  const marketAddress = (market.marketAddress ?? null) as
    | `0x${string}`
    | null;

  // `enabled` gates the QUERIES, not just the render: hooks must run on
  // every market page (React rules), but only pages where an oracle fight
  // can exist should spend RPC calls. When false, every read below is
  // dormant — zero requests.

  // The oracle keys everything by the market's on-chain marketId — never
  // persisted in the DB, so read it off the market contract first.
  const { data: onchainMarketId } = useReadContract({
    address: marketAddress ?? undefined,
    abi: predictionMarketAbi,
    functionName: "marketId",
    query: { enabled: enabled && marketAddress != null, staleTime: Infinity },
  });

  // Note: getResolutionRequest is deliberately NOT polled here — its
  // requestTime is market-creation time, not the assertion's assertTime, and
  // was the wrong anchor for the challenge-window countdown (see
  // assertTimeSec below, resolved from the AssertionCreated log's block).
  const { data: views, refetch: refetchViews } = useReadContracts({
    contracts: [
      {
        ...ORACLE,
        functionName: "getResolutionRequestStatus",
        args: [onchainMarketId!],
      },
      { ...ORACLE, functionName: "bondThreshold" },
      { ...ORACLE, functionName: "quorumBps" },
      { ...ORACLE, functionName: "challengeWindow" },
    ],
    query: {
      enabled: enabled && onchainMarketId != null,
      refetchInterval: 10_000,
    },
  });

  const { data: wallet, refetch: refetchWallet } = useReadContracts({
    contracts: [
      { ...ORACLE, functionName: "isRegisteredProposer", args: [address!] },
      { ...ORACLE, functionName: "isRegisteredDisputer", args: [address!] },
      { ...ORACLE, functionName: "isCommitteeMember", args: [address!] },
      {
        address: VTK_TOKEN,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address!],
      },
      {
        address: VTK_TOKEN,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address!, UMA_ORACLE],
      },
    ],
    query: { enabled: enabled && address != null, refetchInterval: 10_000 },
  });

  const status =
    views?.[0]?.result != null
      ? (Number(views[0].result) as UmaStatus)
      : null;
  const challengeWindowSec =
    views?.[3]?.result != null ? Number(views[3].result) : null;

  // Event story: who asserted what, dispute, votes. Views don't expose these.
  const [events, setEvents] = useState<UmaEvents>({
    assertion: null,
    dispute: null,
    votes: [],
  });
  // The challenge window is anchored on the assertion's on-chain block
  // timestamp (assertTime), not market-creation time — no view exposes it,
  // so it's resolved from the AssertionCreated log's block once fetched.
  const [assertTimeSec, setAssertTimeSec] = useState<number | null>(null);
  // When the latest committee vote landed — anchors the deliberation quiet
  // window (a disputed market finalizes after N minutes of vote silence).
  const [lastVoteAtSec, setLastVoteAtSec] = useState<number | null>(null);
  const [eventsNonce, setEventsNonce] = useState(0);
  useEffect(() => {
    if (
      !enabled ||
      !client ||
      onchainMarketId == null ||
      status == null ||
      status < 2
    ) {
      return;
    }
    let alive = true;
    const common = {
      address: UMA_ORACLE,
      args: { marketId: onchainMarketId },
      fromBlock: UMA_FROM_BLOCK,
      toBlock: "latest",
    } as const;
    Promise.all([
      client.getLogs({ ...common, event: assertionCreatedEvent }),
      client.getLogs({ ...common, event: disputedEvent }),
      client.getLogs({ ...common, event: votedEvent }),
    ])
      .then(([asserts, disputes, votes]) => {
        if (!alive) return;
        const a = asserts.at(-1);
        const d = disputes.at(-1);
        setEvents({
          assertion: a?.args.proposer
            ? {
                proposer: a.args.proposer,
                outcomeIndex: Number(a.args.outcomeIndex ?? 0),
              }
            : null,
          dispute: d?.args.disputer ? { disputer: d.args.disputer } : null,
          votes: votes.flatMap((v) =>
            v.args.voter != null && v.args.supportProposer != null
              ? [{ voter: v.args.voter, supportProposer: v.args.supportProposer }]
              : [],
          ),
        });
        if (a?.blockNumber != null) {
          client
            .getBlock({ blockNumber: a.blockNumber })
            .then((b) => {
              if (alive) setAssertTimeSec(Number(b.timestamp));
            })
            .catch(() => {});
        } else {
          setAssertTimeSec(null);
        }
        const lastVote = votes.at(-1);
        if (lastVote?.blockNumber != null) {
          client
            .getBlock({ blockNumber: lastVote.blockNumber })
            .then((b) => {
              if (alive) setLastVoteAtSec(Number(b.timestamp));
            })
            .catch(() => {});
        } else {
          setLastVoteAtSec(null);
        }
      })
      .catch(() => {
        // Degrade: the stage still renders from views; only the "who did
        // what" detail is hidden. Next poll retries.
      });
    return () => {
      alive = false;
    };
  }, [enabled, client, onchainMarketId, status, eventsNonce]);

  // Re-pull the event story on the same cadence as the view polls — votes by
  // other members must appear without a local tx, and one failed getLogs
  // (transient RPC) must not blank the assertion for the whole window.
  useEffect(() => {
    if (!enabled || onchainMarketId == null || status == null || status < 2)
      return;
    const id = setInterval(() => setEventsNonce((n) => n + 1), 10_000);
    return () => clearInterval(id);
  }, [enabled, onchainMarketId, status]);

  const deadlineMs =
    status != null && status >= 2 && assertTimeSec != null && challengeWindowSec != null
      ? (assertTimeSec + challengeWindowSec) * 1000
      : null;

  const refetch = useCallback(() => {
    void refetchViews();
    void refetchWallet();
    setEventsNonce((n) => n + 1);
  }, [refetchViews, refetchWallet]);

  const roles = {
    proposer: wallet?.[0]?.result === true,
    disputer: wallet?.[1]?.result === true,
    committee: wallet?.[2]?.result === true,
  };

  return {
    onchainMarketId: (onchainMarketId ?? null) as `0x${string}` | null,
    status,
    deadlineMs,
    lastVoteAtMs: lastVoteAtSec != null ? lastVoteAtSec * 1000 : null,
    bondThreshold: (views?.[1]?.result as bigint | undefined) ?? null,
    quorumBps: views?.[2]?.result != null ? Number(views[2].result) : null,
    roles,
    hasAnyRole: roles.proposer || roles.disputer || roles.committee,
    walletVtk: (wallet?.[3]?.result as bigint | undefined) ?? null,
    allowance: (wallet?.[4]?.result as bigint | undefined) ?? null,
    events,
    refetch,
  };
}
