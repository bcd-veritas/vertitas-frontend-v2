export default function MarketLoading() {
  return (
    <div className="dot-grid min-h-screen">
      <div className="h-14 border-b border-line" />
      <div className="mx-auto max-w-7xl px-3 sm:px-4 py-6">
        <div className="h-6 w-64 rounded bg-surface/70 animate-pulse mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-5">
          <div className="flex flex-col gap-5">
            <div className="h-[300px] rounded-xl bg-surface/70 border border-line animate-pulse" />
            <div className="h-72 rounded-xl bg-surface/70 border border-line animate-pulse" />
          </div>
          <div className="flex flex-col gap-5">
            <div className="h-96 rounded-xl bg-surface/70 border border-line animate-pulse" />
            <div className="h-52 rounded-xl bg-surface/70 border border-line animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
