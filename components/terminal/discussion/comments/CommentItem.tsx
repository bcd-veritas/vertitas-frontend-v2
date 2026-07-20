"use client";

import { useState, type ReactNode } from "react";

import type { FeaturedComment } from "@/lib/markets/types";
import { Avatar } from "../atoms";
import { Composer } from "./Composer";
import { timeAgo } from "./time";

/** A tiny monospace action link matching the terminal's micro-label style. */
function RowAction({
  onClick,
  children,
  active = false,
  tone = "muted",
  disabled = false,
}: {
  onClick: () => void;
  children: ReactNode;
  active?: boolean;
  tone?: "muted" | "no" | "accent";
  disabled?: boolean;
}) {
  const color =
    tone === "no"
      ? "text-muted hover:text-no"
      : active
        ? "text-accent"
        : "text-muted hover:text-fg/80";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`font-mono text-[10px] uppercase tracking-[0.1em] transition-colors disabled:opacity-40 ${color}`}
    >
      {children}
    </button>
  );
}

export function CommentItem({
  c,
  reply = false,
  connected,
  isOwner,
  isLiked,
  onLike,
  onReply,
  onEdit,
  onDelete,
}: {
  c: FeaturedComment;
  reply?: boolean;
  connected: boolean;
  isOwner: boolean;
  isLiked: boolean;
  onLike: (c: FeaturedComment) => void;
  onReply: (parentId: string, text: string) => Promise<void>;
  onEdit: (c: FeaturedComment, text: string) => Promise<void>;
  onDelete: (c: FeaturedComment) => Promise<void>;
}) {
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const name = c.user?.username ?? "anon";
  const wallet = c.user?.walletAddress;

  async function handleDelete() {
    setDeleting(true);
    try {
      await onDelete(c);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className={`flex gap-3 py-3 ${reply ? "ml-10" : ""}`}>
      <Avatar name={name} />
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[11px] text-muted">
          <span className="text-fg/85">{name}</span>
          {wallet && (
            <>
              <span className="mx-1.5">·</span>
              {`${wallet.slice(0, 6)}…${wallet.slice(-4)}`}
            </>
          )}
          <span className="mx-1.5">·</span>
          <span title={new Date(c.createdAt).toLocaleString()}>
            {timeAgo(c.createdAt)}
          </span>
        </p>

        {editing ? (
          <Composer
            initialValue={c.content}
            placeholder="edit your comment…"
            submitLabel="save"
            autoFocus
            onSubmit={async (text) => {
              await onEdit(c, text);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <p className="text-sm text-fg/90 mt-1 leading-relaxed whitespace-pre-wrap break-words">
            {c.content}
          </p>
        )}

        {!editing && (
          <div className="flex items-center gap-4 mt-1.5">
            <RowAction
              onClick={() => onLike(c)}
              active={isLiked}
              disabled={!connected}
              tone="accent"
            >
              {isLiked ? "♥" : "♡"} {c.likesCount}
            </RowAction>
            {!reply && connected && (
              <RowAction onClick={() => setReplying((v) => !v)}>reply</RowAction>
            )}
            {isOwner && (
              <>
                <RowAction onClick={() => setEditing(true)}>edit</RowAction>
                <RowAction onClick={handleDelete} tone="no" disabled={deleting}>
                  {deleting ? "…" : "delete"}
                </RowAction>
              </>
            )}
          </div>
        )}

        {replying && (
          <Composer
            placeholder="write a reply…"
            submitLabel="reply"
            autoFocus
            onSubmit={(text) => onReply(c.id, text)}
            onCancel={() => setReplying(false)}
          />
        )}
      </div>
    </div>
  );
}
