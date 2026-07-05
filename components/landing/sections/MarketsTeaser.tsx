import { MonoLabel } from "../ui/MonoLabel";
import { PixelHeading } from "../ui/PixelHeading";

type TeaserMarket = {
  title: string;
  category: string;
  yesPct: number;
  volume: string;
  history: number[];
};

const MARKETS: TeaserMarket[] = [
  {
    title: "Bitcoin above $150K by December 31?",
    category: "Crypto",
    yesPct: 62,
    volume: "$2.4M",
    history: [38, 42, 45, 51, 49, 55, 58, 62],
  },
  {
    title: "SpaceX Starship reaches Mars orbit this cycle?",
    category: "Space",
    yesPct: 18,
    volume: "$890K",
    history: [30, 28, 25, 22, 24, 20, 19, 18],
  },
  {
    title: "AI model passes full bar exam unassisted?",
    category: "Science",
    yesPct: 87,
    volume: "$1.1M",
    history: [60, 66, 71, 75, 80, 78, 84, 87],
  },
];

function Sparkline({ data, up }: { data: number[]; up: boolean }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * 56},${24 - ((v - min) / span) * 22}`)
    .join(" ");
  return (
    <svg viewBox="0 0 56 26" className="w-14 h-6" aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        strokeWidth="1.5"
        className={up ? "stroke-yes" : "stroke-no"}
      />
    </svg>
  );
}

export function MarketsTeaser() {
  return (
    <section id="markets" className="relative py-48" aria-label="Live markets">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        {/* Left-shifted content; token hovers on the right */}
        <div className="lg:mr-[34%]">
          <MonoLabel className="block mb-4" data-reveal>feed // live markets</MonoLabel>
          <PixelHeading className="text-[clamp(2.2rem,4.5vw,3.8rem)] mb-14" data-reveal>
            Markets, settling on reality
          </PixelHeading>
          <div className="flex flex-col gap-4">
            {MARKETS.map((m) => {
              const up = m.history[m.history.length - 1] >= m.history[0];
              return (
                <article
                  key={m.title}
                  data-reveal
                  className="flex items-center gap-5 border border-line bg-surface/60 rounded-xl p-5 sm:p-6"
                >
                  <div className="flex-1 min-w-0">
                    <MonoLabel className="text-accent/70">{m.category}</MonoLabel>
                    <h3 className="mt-1 text-fg font-medium leading-snug">{m.title}</h3>
                    <p className="mt-1.5 font-mono text-xs text-muted">{m.volume} vol</p>
                  </div>
                  <Sparkline data={m.history} up={up} />
                  <div className="text-right shrink-0 w-20">
                    <p className={`font-mono text-3xl font-bold ${up ? "text-yes" : "text-no"}`}>
                      {m.yesPct}%
                    </p>
                    <MonoLabel>yes</MonoLabel>
                  </div>
                </article>
              );
            })}
          </div>
          <p className="mt-6" data-reveal>
            <a href="/home" className="font-mono text-sm text-accent hover:opacity-80 transition-opacity">
              view all markets →
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
