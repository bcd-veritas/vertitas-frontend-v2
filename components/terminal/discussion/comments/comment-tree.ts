import type { FeaturedComment } from "@/lib/markets/types";

// Pure, idempotent-by-id merge helpers for the one-level comment tree. Both the
// REST responses and the realtime echoes flow through these, so an action
// applied twice (optimistic + socket) converges to the same state.

export function sortRepliesOldestFirst(
  replies: FeaturedComment[],
): FeaturedComment[] {
  return [...replies].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Replace-or-keep: `edit`/`like` payloads omit replies, so preserve the ones
 *  we already hold unless the incoming copy actually carries some. */
export function mergeComment(
  existing: FeaturedComment,
  incoming: FeaturedComment,
): FeaturedComment {
  return {
    ...existing,
    ...incoming,
    replies:
      incoming.replies && incoming.replies.length > 0
        ? incoming.replies
        : existing.replies,
  };
}

export function upsertComment(
  list: FeaturedComment[] | null,
  incoming: FeaturedComment,
): FeaturedComment[] {
  const current = list ?? [];

  if (incoming.parentId) {
    // A reply: attach under its parent (replace if already present).
    return current.map((top) => {
      if (top.id !== incoming.parentId) return top;
      const has = top.replies.some((r) => r.id === incoming.id);
      const replies = has
        ? top.replies.map((r) =>
            r.id === incoming.id ? mergeComment(r, incoming) : r,
          )
        : sortRepliesOldestFirst([...top.replies, incoming]);
      return { ...top, replies };
    });
  }

  const idx = current.findIndex((t) => t.id === incoming.id);
  if (idx === -1) return [incoming, ...current]; // newest-first
  return current.map((t) =>
    t.id === incoming.id ? mergeComment(t, incoming) : t,
  );
}

export function removeComment(
  list: FeaturedComment[] | null,
  id: string,
): FeaturedComment[] {
  return (list ?? [])
    .filter((t) => t.id !== id)
    .map((t) => ({ ...t, replies: t.replies.filter((r) => r.id !== id) }));
}
