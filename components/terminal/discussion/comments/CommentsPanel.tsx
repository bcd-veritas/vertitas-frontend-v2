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
import { EmptyState } from "../atoms";
import { Composer } from "./Composer";
import { CommentItem } from "./CommentItem";
import { upsertComment, removeComment } from "./comment-tree";
import { loadLiked, saveLiked } from "./liked-store";

export function CommentsPanel({ marketId }: { marketId: string }) {
  const { address, isConnected } = useAccount();
  const [comments, setComments] = useState<FeaturedComment[] | null>(null);
  // Lazy init from localStorage (empty during SSR — no comments are painted
  // until the client fetch lands, so there's no hydration mismatch).
  const [liked, setLiked] = useState<Set<string>>(() => loadLiked(marketId));
  // Comment ids with a like/unlike request in flight (guards double-fire).
  const likePending = useRef<Set<string>>(new Set());

  const owns = (c: FeaturedComment) =>
    !!address &&
    !!c.user &&
    c.user.walletAddress.toLowerCase() === address.toLowerCase();

  useEffect(() => {
    let alive = true;
    getMarketComments(marketId)
      .then((c) => alive && setComments(c))
      .catch(() => alive && setComments([]));
    return () => {
      alive = false;
    };
  }, [marketId]);

  // Live updates from other users (and echoes of our own actions — idempotent).
  useMarketCommentStream(marketId, {
    onNew: (c) => setComments((prev) => upsertComment(prev, c)),
    onUpdated: (c) => setComments((prev) => upsertComment(prev, c)),
    onDeleted: (id) => setComments((prev) => removeComment(prev, id)),
  });

  async function handlePost(text: string, parentId?: string) {
    if (!address) throw new Error("connect your wallet to comment");
    const created = await createComment(marketId, address, text, parentId ?? null);
    setComments((prev) => upsertComment(prev, created));
  }

  async function handleEdit(c: FeaturedComment, text: string) {
    if (!address) return;
    const updated = await editComment(c.id, address, text);
    setComments((prev) => upsertComment(prev, updated));
  }

  async function handleDelete(c: FeaturedComment) {
    if (!address) return;
    await deleteComment(c.id, address);
    setComments((prev) => removeComment(prev, c.id));
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
    setComments((prev) =>
      upsertComment(prev, {
        ...c,
        likesCount: Math.max(0, c.likesCount + (wasLiked ? -1 : 1)),
      }),
    );

    try {
      const updated = wasLiked
        ? await unlikeComment(c.id)
        : await likeComment(c.id);
      setComments((prev) => upsertComment(prev, updated));
    } catch {
      // Roll back BOTH the flag and the count to their pre-click snapshot.
      setFlag(c.id, wasLiked);
      setComments((prev) =>
        upsertComment(prev, { ...c, likesCount: c.likesCount }),
      );
    } finally {
      likePending.current.delete(c.id);
    }
  }

  const reply = (parentId: string, text: string) => handlePost(text, parentId);

  return (
    <div>
      {isConnected ? (
        <div className="border-b border-line/50">
          <Composer
            placeholder="add a comment…"
            onSubmit={(text) => handlePost(text)}
          />
        </div>
      ) : (
        <EmptyState text="connect wallet to comment" />
      )}

      {comments === null ? (
        <EmptyState text="loading…" />
      ) : comments.length === 0 ? (
        <EmptyState text="no comments yet — be the first" />
      ) : (
        <div className="divide-y divide-line/50">
          {comments.map((c) => (
            <div key={c.id}>
              <CommentItem
                c={c}
                connected={isConnected}
                isOwner={owns(c)}
                isLiked={liked.has(c.id)}
                onLike={handleLike}
                onReply={reply}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
              {c.replies.map((r) => (
                <CommentItem
                  key={r.id}
                  c={r}
                  reply
                  connected={isConnected}
                  isOwner={owns(r)}
                  isLiked={liked.has(r.id)}
                  onLike={handleLike}
                  onReply={reply}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
