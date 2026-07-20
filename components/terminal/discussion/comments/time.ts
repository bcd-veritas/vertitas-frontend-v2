/** Compact "time since": "just now", "2 mins", "1 hour", "3 days", "1 month".
 *  Client-only (comments render after the client fetch, so no SSR mismatch). */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));

  const step = (value: number, unit: string) =>
    `${value} ${unit}${value === 1 ? "" : "s"}`;

  if (secs < 45) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return step(mins, "min");
  const hours = Math.round(mins / 60);
  if (hours < 24) return step(hours, "hour");
  const days = Math.round(hours / 24);
  if (days < 7) return step(days, "day");
  if (days < 30) return step(Math.round(days / 7), "week");
  const months = Math.round(days / 30);
  if (months < 12) return step(months, "month");
  return step(Math.round(days / 365), "year");
}
