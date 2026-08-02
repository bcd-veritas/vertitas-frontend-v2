import { MonoLabel } from "../ui/MonoLabel";
import { PixelHeading } from "../ui/PixelHeading";

export function SplitAct() {
  return (
    <section id="act-split" className="act h-[300vh]">
      <div className="act-sticky items-start pl-[8vw]">
        <div className="act-copy">
          <MonoLabel>01 · The Split</MonoLabel>
          <PixelHeading as="h2" className="act-title mt-4 max-w-[12ch]">
            Every question splits the world
          </PixelHeading>
          <p className="act-sub">
            Two sides. <span className="text-yes">Yes</span> or{" "}
            <span className="text-no">no</span>. Stake what you believe —
            conviction flows into two opposing pools.
          </p>
        </div>
      </div>
    </section>
  );
}
