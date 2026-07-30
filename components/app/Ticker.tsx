const LINES: { text: string; delta: number }[] = [
  { text: "BTC $150K — YES 62%", delta: +3 },
  { text: "TECH LAYOFFS 2026 — YES 91%", delta: +1 },
  { text: "FED CUT NEXT FOMC — YES 44%", delta: -2 },
  { text: "ETH $8K PRE-SEPT — YES 23%", delta: -1 },
  { text: "AI SAFETY ACT — YES 31%", delta: +2 },
  { text: "STARSHIP MARS ORBIT — YES 18%", delta: -1 },
  { text: "BAR EXAM AI — YES 87%", delta: +4 },
  { text: "SOLANA ETF Q3 — YES 49%", delta: +1 },
];

function TickerItem({ text, delta }: { text: string; delta: number }) {
  const up = delta >= 0;
  return (
    <span className="inline-flex items-center gap-2 font-terminal text-[13px] font-light uppercase tracking-[0.14em] text-muted">
      {text}
      <span className={up ? "text-yes" : "text-no"}>
        {up ? "▲" : "▼"} {Math.abs(delta)}
      </span>
    </span>
  );
}

export function Ticker() {
  return (
    <div
      className="relative h-9 border-b border-line overflow-hidden bg-surface/40"
      aria-hidden="true"
    >
      <div className="ticker-track absolute top-0 flex h-full w-max items-center gap-10 pr-10">
        {[0, 1].map((copy) => (
          <div key={copy} className="flex items-center gap-10">
            {LINES.map((l, i) => (
              <TickerItem key={i} {...l} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
