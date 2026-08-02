import Link from "next/link";
import { MonoLabel } from "../ui/MonoLabel";
import { PixelHeading } from "../ui/PixelHeading";

export function PayoutAct() {
  return (
    <section id="act-payout" className="act h-[300vh]">
      <div className="act-sticky items-center text-center">
        <div className="act-copy px-6">
          <MonoLabel>04 · Settlement</MonoLabel>
          <PixelHeading as="h2" className="act-title mt-4">
            Get paid
            <br />
            for being right
          </PixelHeading>
          <Link
            href="/markets"
            className="mt-9 inline-block border border-[var(--yes)] px-10 py-4
                       font-mono text-[13px] uppercase tracking-[0.35em]
                       text-[var(--yes)] transition-colors duration-300
                       hover:bg-[var(--yes)] hover:text-[#06130b]"
          >
            Enter the market
          </Link>
        </div>
        <footer className="absolute bottom-6 left-1/2 -translate-x-1/2">
          <MonoLabel>Veritas · truth pays</MonoLabel>
        </footer>
      </div>
    </section>
  );
}
