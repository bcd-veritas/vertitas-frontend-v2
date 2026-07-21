// Client-tracked "liked" set, persisted per market. The API's likesCount has no
// per-user dedup, so the client remembers which comments this browser liked.

function likedKey(marketId: string): string {
  return `veritas:liked-comments:${marketId}`;
}

export function loadLiked(marketId: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(likedKey(marketId));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function saveLiked(marketId: string, set: Set<string>): void {
  try {
    window.localStorage.setItem(likedKey(marketId), JSON.stringify([...set]));
  } catch {
    // best-effort; a full/blocked storage just means likes aren't remembered
  }
}
