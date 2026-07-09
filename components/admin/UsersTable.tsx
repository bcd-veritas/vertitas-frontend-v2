"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

const ROLE_COLOR: Record<Role, string> = {
  USER: "#a89f9c",
  ADMIN: "#f6dcd4",
  SUPERADMIN: "#c97a6d",
  VOTER: "#7fae8b",
  ORACLE_PARTICIPANT: "#8bb5c9",
};

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function RoleBadge({ role }: { role: Role }) {
  const color = ROLE_COLOR[role];
  return (
    <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color }}>
      {role}
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
    return <span className="font-mono text-[10px] uppercase tracking-wider text-muted">syncing…</span>;
  }
  if (!item) {
    return <span className="font-mono text-[10px] text-muted">…</span>;
  }
  if (item.status === "unknown") {
    return (
      <button
        onClick={onRetry}
        className="cursor-pointer font-mono text-[10px] uppercase tracking-wider text-muted hover:text-fg"
      >
        unknown ↻
      </button>
    );
  }
  if (item.inSync) {
    return (
      <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "#7fae8b" }}>
        on-chain ✓
      </span>
    );
  }
  return (
    <button
      onClick={onRetry}
      className="cursor-pointer font-mono text-[10px] uppercase tracking-wider hover:opacity-80"
      style={{ color: "#c97a6d" }}
    >
      drift ⚠ retry ↻
    </button>
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

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", page, debounced],
    queryFn: () => getAdminUsers(page, 20, debounced),
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
      label="Users"
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
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search wallet, username, or email…"
          className="w-full max-w-xs border border-line bg-transparent px-3 py-1.5 font-mono text-xs text-fg placeholder:text-muted focus:border-fg focus:outline-none"
        />
      </div>

      {isLoading || !data ? (
        <p className="font-mono text-xs text-muted">Loading users…</p>
      ) : data.items.length === 0 ? (
        <p className="font-mono text-xs text-muted">No users found.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="font-mono text-[10px] uppercase tracking-wider text-muted">
                <tr>
                  <th className="pb-2 pr-3 font-normal">Wallet</th>
                  <th className="px-2 font-normal">Username</th>
                  <th className="px-2 font-normal">Role</th>
                  <th className="px-2 font-normal">Chain</th>
                  <th className="pl-2 text-right font-normal">Joined</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((u: UserRow) => (
                  <tr key={u.id} className="border-t border-line/60 hover:bg-fg/3">
                    <td className="py-2.5 pr-3 font-mono text-xs text-fg" title={u.walletAddress}>
                      {short(u.walletAddress)}
                    </td>
                    <td className="px-2 text-fg/80">{u.username ?? "—"}</td>
                    <td className="px-2">
                      {isRowEditable(actorRole, address, u) ? (
                        <select
                          value={u.role}
                          onChange={(e) => {
                            const next = e.target.value as Role;
                            if (next !== u.role) setPending({ user: u, newRole: next });
                          }}
                          className="cursor-pointer border border-line bg-transparent px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-fg focus:border-fg focus:outline-none"
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
                    <td className="pl-2 text-right font-mono text-xs tabular-nums text-muted">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-muted">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="cursor-pointer border border-line px-2 py-1 disabled:cursor-default disabled:opacity-40 hover:enabled:border-fg hover:enabled:text-fg"
            >
              Prev
            </button>
            <span>
              Page {data.page} / {Math.max(1, data.totalPages)}
            </span>
            <button
              onClick={() => setPage((p) => (data.totalPages > p ? p + 1 : p))}
              disabled={page >= data.totalPages}
              className="cursor-pointer border border-line px-2 py-1 disabled:cursor-default disabled:opacity-40 hover:enabled:border-fg hover:enabled:text-fg"
            >
              Next
            </button>
          </div>
        </>
      )}

      {pending ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/70 p-4">
          <div className="w-full max-w-sm border border-line bg-surface p-5">
            <h2 className="font-mono text-xs uppercase tracking-wider text-fg">
              Confirm role change
            </h2>
            <p className="mt-3 font-mono text-[11px] leading-relaxed text-muted">
              Change{" "}
              <span className="text-fg" title={pending.user.walletAddress}>
                {short(pending.user.walletAddress)}
              </span>{" "}
              from <RoleBadge role={pending.user.role} /> →{" "}
              <RoleBadge role={pending.newRole} />?
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
                className="cursor-pointer border border-line px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted hover:border-fg hover:text-fg disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={() => mutation.mutate(pending)}
                disabled={mutation.isPending}
                className="cursor-pointer border border-fg px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-fg hover:bg-fg hover:text-bg disabled:opacity-40"
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
