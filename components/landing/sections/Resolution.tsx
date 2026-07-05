import { MonoLabel } from "../ui/MonoLabel";
import { PixelHeading } from "../ui/PixelHeading";

const STAGES = [
  {
    name: "created",
    body: "An admin publishes the question, the rules, and the oracle configuration. Trading opens.",
  },
  {
    name: "trading closes",
    body: "At the deadline, positions lock. The final prices are the market's last word on the odds.",
  },
  {
    name: "resolution",
    body: "A resolver submits the outcome, backed by a bond. Wrong answers forfeit it.",
  },
  {
    name: "dispute window",
    body: "Anyone can challenge the outcome by posting a counter-bond before the window closes.",
  },
  {
    name: "community vote",
    body: "Disputed outcomes go to whitelisted holders. The majority decides; voters earn rewards.",
  },
  {
    name: "finalized",
    body: "Winning shares redeem $1 each. Bonds settle. The truth pays.",
  },
];

/**
 * Pinned horizontal carousel: the scroll timeline (built in
 * useTokenScrollTimeline) pins #resolution and translates #lifecycle-track
 * left as the user scrolls, while the 3D token hovers at screen center and
 * stamps each stage dot passing beneath it.
 */
export function Resolution() {
  return (
    <section id="resolution" className="relative" aria-label="Resolution and trust">
      {/* overflow-x only for reduced-motion users (no pin choreography for
          them) — a scrollable full-screen container would swallow wheel
          input during the pinned phase otherwise */}
      <div
        id="resolution-pin"
        className="flex h-screen flex-col justify-center overflow-hidden motion-reduce:overflow-x-auto"
      >
        <header className="w-full max-w-7xl mx-auto px-5 sm:px-8 pb-20">
          <MonoLabel className="block mb-4" data-reveal>oracle // dispute // vote</MonoLabel>
          <PixelHeading className="text-[clamp(2.2rem,4.5vw,3.8rem)] mb-4" data-reveal>
            Truth, enforced
          </PixelHeading>
          <p className="max-w-2xl text-muted text-lg leading-relaxed" data-reveal>
            Markets settle against oracle data — and every market walks the
            same lifecycle. Bad answers cost money; the truth pays.
          </p>
        </header>

        {/* Horizontal lifecycle track. pl-[50vw] puts the first dot at screen
            center (under the token); the timeline tweens x so each dot passes
            beneath it in turn. */}
        <ol
          id="lifecycle-track"
          className="mt-44 md:mt-56 flex w-max items-start pl-[50vw]"
        >
          {STAGES.map((stage, i) => (
            <li
              key={stage.name}
              className="lifecycle-stage relative w-[78vw] md:w-[38vw] shrink-0 pr-10 md:pr-16"
            >
              {/* Shared line + this stage's dot */}
              <div className="relative h-3" aria-hidden="true">
                <span className="absolute top-1.25 left-0 right-0 h-px bg-line" />
                <span
                  className={`lifecycle-dot absolute -left-1 top-0 w-2.5 h-2.5 rounded-full border ${i === STAGES.length - 1
                    ? "bg-accent border-accent"
                    : "bg-surface border-accent/50"
                    }`}
                />
              </div>
              <div className="mt-10">
                <MonoLabel className="text-accent/70">
                  {String(i + 1).padStart(2, "0")} / {String(STAGES.length).padStart(2, "0")}
                </MonoLabel>
                <h3
                  className={`font-pixel uppercase text-2xl sm:text-3xl mt-3 ${i === STAGES.length - 1 ? "text-accent" : "text-fg"
                    }`}
                >
                  {stage.name}
                </h3>
                <p className="mt-4 max-w-sm text-muted leading-relaxed">{stage.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
