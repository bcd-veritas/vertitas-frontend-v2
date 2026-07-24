"use client";

import { useAccount, useReadContracts } from "wagmi";
import { umaOracleAbi } from "./abi";
import { UMA_ORACLE } from "./config";

const ORACLE = { address: UMA_ORACLE, abi: umaOracleAbi } as const;

export type OracleRole = {
  /** Whitelisted to propose outcomes. */
  proposer: boolean;
  /** Whitelisted to dispute outcomes. */
  disputer: boolean;
  /** Committee member — votes on disputes. */
  voter: boolean;
  /** Any oracle role at all. These wallets are barred from trading to avoid a
   *  conflict of interest (they help decide market outcomes). */
  isOracleParticipant: boolean;
  /** False until the reads resolve — callers should not gate on a role until
   *  this is true, so a normal trader isn't blocked during the RPC round-trip. */
  loaded: boolean;
};

/**
 * The connected wallet's global UMA oracle role (proposer / disputer /
 * committee voter). Market-independent: the conflict-of-interest trading block
 * applies on every market, not just the one a wallet is whitelisted for, so
 * this reads only the wallet's address — no market context needed.
 *
 * Reuses the same on-chain reads as useUmaState's wallet block, but stands
 * alone so TradePanel (which renders on every market, UMA or not) can gate
 * trading without pulling in the heavy market-scoped oracle state / log scans.
 */
export function useOracleRole(): OracleRole {
  const { address, isConnected } = useAccount();

  const { data } = useReadContracts({
    contracts: [
      { ...ORACLE, functionName: "isRegisteredProposer", args: [address!] },
      { ...ORACLE, functionName: "isRegisteredDisputer", args: [address!] },
      { ...ORACLE, functionName: "isCommitteeMember", args: [address!] },
    ],
    query: { enabled: isConnected && address != null, refetchInterval: 30_000 },
  });

  const proposer = data?.[0]?.result === true;
  const disputer = data?.[1]?.result === true;
  const voter = data?.[2]?.result === true;

  return {
    proposer,
    disputer,
    voter,
    isOracleParticipant: proposer || disputer || voter,
    loaded: data != null,
  };
}
