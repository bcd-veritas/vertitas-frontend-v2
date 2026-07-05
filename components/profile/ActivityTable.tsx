import type { ActivityRow } from "@/lib/profile/mock";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** Fixed UTC stamp ("JUL 4 14:03") — no relative times, hydration-safe. */
function utcStamp(t: number): string {
  const d = new Date(t);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()} ${hh}:${mm}`;
}

export function ActivityTable({ rows }: { rows: ActivityRow[] }) {
  return (
    <section className="relative" aria-label="Activity">
      {/* Reference's SYSTEM LOGS heading: big display type + right eyebrow. */}
      <div className="flex flex-wrap items-end justify-between gap-2 px-3 sm:px-4 pt-10 pb-6">
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-fg uppercase">
          Activity
        </h2>
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
          sim.data feed
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="py-10 text-center font-mono text-[11px] uppercase tracking-[0.24em] text-muted/70">
          no activity yet
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-t border-line/50">
            <thead>
              <tr className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted/60">
                <th className="font-normal px-5 py-2">time</th>
                <th className="font-normal px-3 py-2">action</th>
                <th className="font-normal px-3 py-2">market</th>
                <th className="font-normal px-3 py-2">outcome</th>
                <th className="font-normal px-3 py-2 text-right">shares</th>
                <th className="font-normal px-3 py-2 text-right">price</th>
                <th className="font-normal px-5 py-2 text-right">total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/50 border-t border-line/50">
              {rows.map((r) => (
                <tr key={r.id} className="text-sm">
                  <td className="px-5 py-2.5 font-mono text-[11px] text-muted whitespace-nowrap tabular-nums">
                    {utcStamp(r.t)}
                  </td>
                  <td
                    className={`px-3 py-2.5 font-mono text-[11px] tracking-[0.1em] ${
                      r.action === "BOUGHT" ? "text-yes" : "text-no"
                    }`}
                  >
                    {r.action}
                  </td>
                  <td className="px-3 py-2.5 text-fg/90 max-w-[240px] truncate">{r.market}</td>
                  <td className="px-3 py-2.5 text-fg/70 whitespace-nowrap">{r.outcome}</td>
                  <td className="px-3 py-2.5 font-mono text-[11px] tabular-nums text-right text-fg/75">
                    {r.shares.toLocaleString("en-US")}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[11px] tabular-nums text-right text-fg/75">
                    {r.priceCents}¢
                  </td>
                  <td className="px-5 py-2.5 font-mono text-[11px] tabular-nums text-right text-fg/90 whitespace-nowrap">
                    ${((r.shares * r.priceCents) / 100).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
