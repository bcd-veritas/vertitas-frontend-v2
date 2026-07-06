export default function MarketLoading() {
  return (
    <div className="dot-grid min-h-screen">
      <div className="h-14 border-b border-line" />
      {/* Hero band */}
      <div className="border-b border-line min-h-[56vh] flex">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-10 flex flex-col">
          <div className="h-4 w-72 bg-surface/70 animate-pulse" />
          <div className="mt-auto pt-14 h-16 w-3/4 bg-surface/70 animate-pulse" />
          <div className="mt-6 flex items-end justify-between">
            <div className="h-4 w-52 bg-surface/70 animate-pulse" />
            <div className="h-24 w-56 bg-surface/70 animate-pulse" />
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-3 sm:px-4 pt-8 pb-10">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-x-6 gap-y-8">
          <div className="flex flex-col gap-8">
            <div className="h-75 bg-surface/70 border border-line animate-pulse" />
            <div className="h-72 bg-surface/70 border border-line animate-pulse" />
          </div>
          <div className="flex flex-col gap-8">
            <div className="h-96 bg-surface/70 border border-line animate-pulse" />
            <div className="h-52 bg-surface/70 border border-line animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
