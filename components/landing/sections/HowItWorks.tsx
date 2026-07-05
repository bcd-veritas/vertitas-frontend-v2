import { MonoLabel } from "../ui/MonoLabel";
import { PixelHeading } from "../ui/PixelHeading";

const STEPS = [
  {
    n: "01",
    title: "Pick a market",
    body: "Real-world questions with a definite outcome. Crypto, politics, science, culture — each market asks one thing and settles one way.",
  },
  {
    n: "02",
    title: "Buy Yes or No",
    body: "Shares trade between 1¢ and 99¢. The price IS the probability: a 62¢ Yes share means the market thinks it's 62% likely.",
  },
  {
    n: "03",
    title: "Correct shares pay $1",
    body: "When the market resolves, winning shares redeem for a full dollar. Buy conviction cheap, sell doubt dear.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="relative py-48" aria-label="How it works">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        {/* Right-shifted content; token parks on the left */}
        <div className="lg:ml-[38%]">
          <MonoLabel className="block mb-4" data-reveal>protocol // 01–03</MonoLabel>
          <PixelHeading className="text-[clamp(2.2rem,4.5vw,3.8rem)] mb-14" data-reveal>
            How it works
          </PixelHeading>
          <ol className="flex flex-col gap-5">
            {STEPS.map((s) => (
              <li
                key={s.n}
                data-reveal
                className="relative border border-line bg-surface/60 rounded-xl p-6 sm:p-8"
              >
                <div className="flex items-baseline gap-4">
                  <span className="font-pixel text-accent text-2xl">{s.n}</span>
                  <div>
                    <h3 className="text-fg font-semibold text-lg">{s.title}</h3>
                    <p className="mt-2 text-muted leading-relaxed max-w-xl">{s.body}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
