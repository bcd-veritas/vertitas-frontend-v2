"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";

import { Frame } from "@/components/terminal/Frame";
import {
  getAdminAccess,
  getAdminUsers,
  getWhitelistStatus,
  setUserRole,
  syncUserWhitelist,
} from "@/lib/admin/data";
import type { Role, UserRow, WhitelistStatusItem } from "@/lib/admin/types";
import { Identicon } from "./Identicon";
import { AMBER } from "./statusMeta";

const ROLE_COLOR: Record<Role, string> = {
  USER: "#a89f9c",
  ADMIN: "#f6dcd4",
  SUPERADMIN: "#c97a6d",
  VOTER: "#7fae8b",
  ORACLE_PARTICIPANT: "#8bb5c9",
};

/** 6-dec VTK BigInt string -> "1,250" (whole tokens). */
function fmtVtk(raw: string): string {
  return (BigInt(raw) / 1_000_000n).toLocaleString("en-US");
}

function RoleBadge({ role }: { role: Role }) {
  const color = ROLE_COLOR[role];
  return (
    <span
      className="border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider"
      style={{ color, borderColor: color }}
    >
      {role.replace("_", " ")}
    </span>
  );
}

function selectableRoles(actorRole: Role | null): Role[] {
  const base: Role[] = ["USER", "VOTER", "ORACLE_PARTICIPANT"];
  return actorRole === "SUPERADMIN" ? [...base, "ADMIN"] : base;
}

function isRowEditable(
  actorRole: Role | null,
  actorAddress: string | undefined,
  row: UserRow,
): boolean {
  if (!actorAddress) return false;
  if (row.walletAddress.toLowerCase() === actorAddress.toLowerCase()) return false; // self
  if (row.role === "SUPERADMIN") return false; // read-only in portal
  if (row.role === "ADMIN" && actorRole !== "SUPERADMIN") return false; // ADMIN rows need SUPERADMIN
  return true;
}

function isOracleRole(role: Role): boolean {
  return role === "VOTER" || role === "ORACLE_PARTICIPANT";
}

function ChainPill({
  item,
  syncing,
  onRetry,
}: {
  item: WhitelistStatusItem | undefined;
  syncing: boolean;
  onRetry: () => void;
}) {
  if (syncing) {
    return (
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
        syncing…
      </span>
    );
  }
  if (!item) {
    return <span className="font-mono text-[10px] text-muted">…</span>;
  }
  if (item.status === "unknown") {
    return (
      <button
        onClick={onRetry}
        className="border border-line px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted transition-colors hover:border-fg hover:text-fg"
      >
        unknown ↻
      </button>
    );
  }
  if (item.inSync) {
    return (
      <span
        className="font-mono text-[10px] uppercase tracking-wider"
        style={{ color: "var(--color-yes)" }}
      >
        on-chain ✓
      </span>
    );
  }
  return (
    <button
      onClick={onRetry}
      className="border border-no bg-no/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-no transition-colors hover:bg-no/20"
    >
      drift ⚠ retry ↻
    </button>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i} className="border-t border-line/60">
          <td className="py-3 pr-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 animate-pulse border border-line bg-fg/5" />
              <div className="flex-1">
                <div className="h-3 animate-pulse bg-fg/10" style={{ width: `${60 + (i % 3) * 12}%` }} />
                <div className="mt-1.5 h-2 w-20 animate-pulse bg-fg/5" />
              </div>
            </div>
          </td>
          <td className="px-2"><div className="h-4 w-16 animate-pulse bg-fg/5" /></td>
          <td className="px-2"><div className="h-3 w-14 animate-pulse bg-fg/5" /></td>
          <td className="px-2"><div className="ml-auto h-3 w-12 animate-pulse bg-fg/5" /></td>
          <td className="px-2"><div className="ml-auto h-3 w-12 animate-pulse bg-fg/5" /></td>
          <td className="pl-2"><div className="ml-auto h-3 w-14 animate-pulse bg-fg/5" /></td>
        </tr>
      ))}
    </>
  );
}

export function UsersTable() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);

  // Debounce the search box so each keystroke doesn't fire a request.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, isPlaceholderData } = useQuery({
    queryKey: ["admin-users", page, debounced],
    queryFn: () => getAdminUsers(page, 20, debounced),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });

  const { address } = useAccount();
  const queryClient = useQueryClient();

  const { data: access } = useQuery({
    queryKey: ["admin-access", address],
    queryFn: () => getAdminAccess(address as string),
    enabled: !!address,
  });
  const actorRole = access?.role ?? null;

  // On-chain status is fetched separately from the (DB-only) users list, so a
  // dead RPC never breaks the table — it just yields no status items.
  const oracleIds = (data?.items ?? [])
    .filter((u) => isOracleRole(u.role))
    .map((u) => u.id);

  const { data: whitelist } = useQuery({
    queryKey: ["admin-whitelist-status", [...oracleIds].sort()],
    queryFn: () => getWhitelistStatus(oracleIds),
    enabled: oracleIds.length > 0,
    refetchInterval: 30_000,
  });

  const statusById = new Map<string, WhitelistStatusItem>(
    (whitelist?.items ?? []).map((s) => [s.id, s]),
  );

  const [pending, setPending] = useState<{ user: UserRow; newRole: Role } | null>(null);

  const mutation = useMutation({
    mutationFn: ({ user, newRole }: { user: UserRow; newRole: Role }) =>
      setUserRole(user.id, newRole, address as string),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      if (isOracleRole(variables.newRole) || isOracleRole(variables.user.role)) {
        syncMutation.mutate(variables.user.id);
      }
      setPending(null);
    },
  });

  const syncMutation = useMutation({
    mutationFn: (userId: string) => syncUserWhitelist(userId),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-whitelist-status"] });
    },
  });

  return (
    <Frame
      label="User registry"
      right={
        data ? (
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
            {data.total} total
          </span>
        ) : null
      }
      className="p-4"
    >
      <div className="mb-3">
        <div className="relative max-w-sm">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search wallet, username, or email…"
            className="w-full border border-line bg-transparent py-2 pl-8 pr-3 font-mono text-[13px] text-fg placeholder:text-muted focus:border-fg focus:outline-none"
          />
        </div>
      </div>

      <div
        className={`overflow-x-auto transition-opacity duration-200 ${isPlaceholderData ? "opacity-50" : ""
          }`}
      >
        <table className="w-full text-left text-sm">
          <thead className="font-mono text-[10px] uppercase tracking-wider text-muted">
            <tr>
              <th className="w-[38%] pb-2 pr-3 font-normal">Account</th>
              <th className="px-2 font-normal">Role</th>
              <th className="px-2 font-normal">Chain</th>
              <th className="px-2 text-right font-normal">Avail (VTK)</th>
              <th className="px-2 text-right font-normal">Locked (VTK)</th>
              <th className="pl-2 text-right font-normal">Joined</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <SkeletonRows />
            ) : !data || data.items.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="relative my-2 overflow-hidden border border-line/60 py-10 text-center">
                    <div className="dot-grid pointer-events-none absolute inset-0 opacity-30" aria-hidden="true" />
                    <p className="relative font-mono text-xs text-muted">No users found.</p>
                    {search && (
                      <button
                        onClick={() => setSearch("")}
                        className="relative mt-3 border border-line px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted transition-colors hover:border-fg hover:text-fg"
                      >
                        Clear search
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              data.items.map((u: UserRow, i) => {
                const self =
                  !!address && u.walletAddress.toLowerCase() === address.toLowerCase();
                const locked = BigInt(u.collateralLocked) > 0n;
                return (
                  <tr
                    key={u.id}
                    className="reveal-rise border-t border-line/60 transition-colors hover:bg-fg/4"
                    style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}
                  >
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-3">
                        <Identicon
                          seed={u.walletAddress}
                          color={ROLE_COLOR[u.role]}
                          className="h-9 w-9 p-1"
                        />
                        <div className="min-w-0">
                          <div className="break-all font-mono text-xs text-fg">
                            {u.walletAddress}
                            {self && (
                              <span className="ml-1.5 border border-line px-1 font-mono text-[9px] uppercase tracking-wider text-muted">
                                you
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 truncate font-mono text-[11px] text-muted">
                            {u.username ?? "—"}
                            {u.email ? ` · ${u.email}` : ""}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-2">
                      {isRowEditable(actorRole, address, u) ? (
                        <select
                          value={u.role}
                          onChange={(e) => {
                            const next = e.target.value as Role;
                            if (next !== u.role) setPending({ user: u, newRole: next });
                          }}
                          className="cursor-pointer border px-2 py-1 font-mono text-[10px] uppercase tracking-wider focus:border-fg focus:outline-none"
                          style={{
                            color: ROLE_COLOR[u.role],
                            borderColor: `color-mix(in srgb, ${ROLE_COLOR[u.role]} 45%, transparent)`,
                            background: `color-mix(in srgb, ${ROLE_COLOR[u.role]} 6%, transparent)`,
                          }}
                        >
                          {Array.from(new Set([u.role, ...selectableRoles(actorRole)])).map(
                            (r) => (
                              <option key={r} value={r} className="bg-bg text-fg">
                                {r}
                              </option>
                            ),
                          )}
                        </select>
                      ) : (
                        <RoleBadge role={u.role} />
                      )}
                    </td>
                    <td className="px-2">
                      {isOracleRole(u.role) ? (
                        <ChainPill
                          item={statusById.get(u.id)}
                          syncing={
                            syncMutation.isPending && syncMutation.variables === u.id
                          }
                          onRetry={() => syncMutation.mutate(u.id)}
                        />
                      ) : null}
                    </td>
                    <td className="px-2 text-right font-mono text-xs tabular-nums text-fg/80">
                      {fmtVtk(u.collateralAvailable)}
                    </td>
                    <td
                      className="px-2 text-right font-mono text-xs tabular-nums"
                      style={{ color: locked ? AMBER : "var(--color-muted)" }}
                    >
                      {fmtVtk(u.collateralLocked)}
                    </td>
                    <td className="pl-2 text-right font-mono text-xs tabular-nums text-muted">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {data && data.totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-muted">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="border border-line px-2.5 py-1 transition-colors disabled:cursor-default disabled:opacity-40 hover:enabled:border-fg hover:enabled:text-fg"
          >
            Prev
          </button>
          <span>
            Page {data.page} / {Math.max(1, data.totalPages)}
          </span>
          <button
            onClick={() => setPage((p) => (data.totalPages > p ? p + 1 : p))}
            disabled={page >= data.totalPages}
            className="border border-line px-2.5 py-1 transition-colors disabled:cursor-default disabled:opacity-40 hover:enabled:border-fg hover:enabled:text-fg"
          >
            Next
          </button>
        </div>
      )}

      {pending ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/70 p-4">
          <div className="w-full max-w-md border border-line bg-surface p-5">
            <h2 className="font-mono text-xs uppercase tracking-wider text-fg">
              Confirm role change
            </h2>
            <div className="mt-3 flex items-center gap-3">
              <Identicon
                seed={pending.user.walletAddress}
                color={ROLE_COLOR[pending.newRole]}
                className="h-9 w-9 p-1"
              />
              <span className="break-all font-mono text-xs text-fg">
                {pending.user.walletAddress}
              </span>
            </div>
            <p className="mt-3 font-mono text-[11px] leading-relaxed text-muted">
              <RoleBadge role={pending.user.role} />{" "}
              <span className="mx-1 text-fg">→</span>{" "}
              <RoleBadge role={pending.newRole} />
            </p>
            {mutation.isError ? (
              <p className="mt-3 font-mono text-[11px] text-no">
                {(mutation.error as Error).message}
              </p>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => {
                  mutation.reset();
                  setPending(null);
                }}
                disabled={mutation.isPending}
                className="border border-line px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:border-fg hover:text-fg disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={() => mutation.mutate(pending)}
                disabled={mutation.isPending}
                className={`border border-fg bg-fg px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-85 disabled:opacity-40 ${mutation.isPending ? "cta-busy relative overflow-hidden" : ""
                  }`}
              >
                {mutation.isPending ? "Saving…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </Frame>
  );
}
