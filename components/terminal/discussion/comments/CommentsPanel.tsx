"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";

import type { FeaturedComment } from "@/lib/markets/types";
import {
  createComment,
  deleteComment,
  editComment,
  getMarketComments,
  likeComment,
  unlikeComment,
} from "@/lib/markets/data";
import { useMarketCommentStream } from "@/lib/realtime/market-socket";
import type { HoldersMap } from "../../MarketComments";
import { EmptyState } from "../atoms";
import { Composer } from "./Composer";
import { CommentItem } from "./CommentItem";
import { upsertComment, removeComment } from "./comment-tree";
import { loadLiked, saveLiked } from "./liked-store";

export function CommentsPanel({
  marketId,
  comments: incoming,
  holdersMap,
  onCommentsChange,
}: {
  marketId: string;
  comments: FeaturedComment[] | null;
  holdersMap: HoldersMap;
  /** The parent (MarketComments) owns the count shown on the tab badge, so
   *  every local mutation — create/edit/delete/like and the socket handlers
   *  below — must also push here, or the badge and the in-panel count drift
   *  apart the moment anyone posts. */
  onCommentsChange: (c: FeaturedComment[]) => void;
}) {
  const { address, isConnected } = useAccount();
  const [comments, setComments] = useState<FeaturedComment[] | null>(incoming);
  const [sort, setSort] = useState<"newest" | "top">("newest");
  // Parent refetches (mount, marketId change) replace the local copy; the
  // socket stream then mutates it. setState in an effect body would trip
  // react-hooks/set-state-in-effect, so mirror the prop by comparing it.
  const [prevIncoming, setPrevIncoming] = useState(incoming);
  if (incoming !== prevIncoming) {
    setPrevIncoming(incoming);
    setComments(incoming);
  }
  // Latest local comments, kept live across renders (including ones that
  // happen mid-await inside the async handlers below) without going through
  // React's setState batching — same idiom as lib/realtime's useLatest.
  const commentsRef = useRef<FeaturedComment[] | null>(comments);
  useEffect(() => {
    commentsRef.current = comments;
  });
  // Lazy init from localStorage (empty during SSR — no comments are painted
  // until the client fetch lands, so there's no hydration mismatch).
  const [liked, setLiked] = useState<Set<string>>(() => loadLiked(marketId));
  // Comment ids with a like/unlike request in flight (guards double-fire).
  const likePending = useRef<Set<string>>(new Set());

  // Apply a computed next list to both the local copy and the parent.
  function commit(next: FeaturedComment[]) {
    setComments(next);
    onCommentsChange(next);
  }

  const owns = (c: FeaturedComment) =>
    !!address &&
    !!c.user &&
    c.user.walletAddress.toLowerCase() === address.toLowerCase();

  // Live updates from other users (and echoes of our own actions — idempotent).
  useMarketCommentStream(marketId, {
    onNew: (c) => commit(upsertComment(commentsRef.current, c)),
    onUpdated: (c) => commit(upsertComment(commentsRef.current, c)),
    onDeleted: (id) => commit(removeComment(commentsRef.current, id)),
    onCatchUp: () =>
      getMarketComments(marketId)
        .then(commit)
        .catch(() => { }),
  });

  async function handlePost(text: string, parentId?: string) {
    if (!address) throw new Error("connect your wallet to comment");
    const created = await createComment(marketId, address, text, parentId ?? null);
    commit(upsertComment(commentsRef.current, created));
  }

  async function handleEdit(c: FeaturedComment, text: string) {
    if (!address) return;
    const updated = await editComment(c.id, address, text);
    commit(upsertComment(commentsRef.current, updated));
  }

  async function handleDelete(c: FeaturedComment) {
    if (!address) return;
    await deleteComment(c.id, address);
    commit(removeComment(commentsRef.current, c.id));
  }

  async function handleLike(c: FeaturedComment) {
    if (!isConnected) return;
    // Ignore clicks while a like/unlike for this comment is still in flight —
    // the server has no per-user dedup, so a double-fire would over-count.
    if (likePending.current.has(c.id)) return;
    likePending.current.add(c.id);

    const wasLiked = liked.has(c.id);
    const setFlag = (id: string, on: boolean) =>
      setLiked((prev) => {
        const next = new Set(prev);
        if (on) next.add(id);
        else next.delete(id);
        saveLiked(marketId, next);
        return next;
      });

    // Optimistic: flip the local flag + nudge the counter.
    setFlag(c.id, !wasLiked);
    commit(
      upsertComment(commentsRef.current, {
        ...c,
        likesCount: Math.max(0, c.likesCount + (wasLiked ? -1 : 1)),
      }),
    );

    try {
      const updated = wasLiked
        ? await unlikeComment(c.id)
        : await likeComment(c.id);
      commit(upsertComment(commentsRef.current, updated));
    } catch {
      // Roll back BOTH the flag and the count to their pre-click snapshot.
      setFlag(c.id, wasLiked);
      commit(upsertComment(commentsRef.current, { ...c, likesCount: c.likesCount }));
    } finally {
      likePending.current.delete(c.id);
    }
  }

  const reply = (parentId: string, text: string) => handlePost(text, parentId);

  const roots = [...(comments ?? [])].sort((a, b) =>
    sort === "top"
      ? b.likesCount - a.likesCount
      : +new Date(b.createdAt) - +new Date(a.createdAt),
  );

  return (
    <div>
      {isConnected ? (
        <div className="border-b border-line/50">
          <Composer
            placeholder="add a comment…"
            onSubmit={(text) => handlePost(text)}
            variant="primary"
          />
        </div>
      ) : (
        <EmptyState text="connect wallet to comment" />
      )}

      <div className="flex items-center justify-between gap-4 pt-3 pb-1">
        <span className="font-mono text-[10px] tracking-[0.18em] text-muted/70 uppercase">
          {(comments?.length ?? 0).toLocaleString("en-US")} comments
        </span>
        <span className="flex gap-0.5">
          {(["newest", "top"] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={sort === s}
              onClick={() => setSort(s)}
              className={`rounded px-2 py-1 font-mono text-[10px] tracking-[0.14em] uppercase transition-colors ${
                sort === s ? "bg-white/[0.06] text-fg" : "text-muted hover:text-fg/80"
              }`}
            >
              {s}
            </button>
          ))}
        </span>
      </div>

      {comments === null ? (
        <EmptyState text="loading…" />
      ) : comments.length === 0 ? (
        <EmptyState text="no comments yet — be the first" />
      ) : (
        <div className="divide-y divide-line/50">
          {roots.map((c) => (
            <div key={c.id}>
              <CommentItem
                c={c}
                connected={isConnected}
                isOwner={owns(c)}
                isLiked={liked.has(c.id)}
                holdersMap={holdersMap}
                onLike={handleLike}
                onReply={reply}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
              {c.replies.length > 0 && (
                <div className="ml-1.5 border-l border-line/60 pl-4">
                  {c.replies.map((r) => (
                    <CommentItem
                      key={r.id}
                      c={r}
                      reply
                      connected={isConnected}
                      isOwner={owns(r)}
                      isLiked={liked.has(r.id)}
                      holdersMap={holdersMap}
                      onLike={handleLike}
                      onReply={reply}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
