"use client";

export default function HomeError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="dot-grid min-h-screen flex items-center justify-center px-5">
      <div className="border border-line rounded-xl p-10 text-center max-w-md">
        <p className="font-mono text-sm uppercase tracking-[0.18em] text-no mb-4">
          feed.offline // retry
        </p>
        <p className="text-muted text-sm mb-6">
          The market feed didn&apos;t respond. It&apos;s probably transient.
        </p>
        <button onClick={reset} className="pill pill-solid text-sm">
          Retry
        </button>
      </div>
    </div>
  );
}
