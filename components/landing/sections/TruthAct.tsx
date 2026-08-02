import { MonoLabel } from "../ui/MonoLabel";
import { PixelHeading } from "../ui/PixelHeading";

export function TruthAct() {
  return (
    <section id="act-truth" className="act h-[300vh]">
      <div className="act-sticky items-center text-center">
        {/* Copy sits at the bottom — the scanline + giant YES own the frame.
            Inline style: the scoped .act-copy CSS outranks utility classes,
            and the pipeline proved willing to drop a dedicated variant rule. */}
        <div
          className="act-copy px-6"
          style={{
            position: "absolute",
            bottom: "8vh",
            left: "50%",
            transform: "translateX(-50%)",
            maxWidth: "90vw",
            width: "max-content",
          }}
        >
          <MonoLabel>03 · Resolution</MonoLabel>
          <PixelHeading as="h2" className="act-title mt-3 text-[clamp(2rem,4.5vw,4rem)]!">
            Then the world <span className="text-yes">answers</span>
          </PixelHeading>
          <p className="act-sub mx-auto text-center">
            Markets settle on-chain against what actually happened.
            <br />
            <span className="text-yes">Yes</span> pays a dollar.{" "}
            <span className="text-no">No</span> pays nothing.
          </p>
        </div>
      </div>
    </section>
  );
}
