export default function HomeLoading() {
  return (
    <div className="dot-grid min-h-screen">
      <div className="h-14 border-b border-line" />
      <div className="h-9 border-b border-line" />
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-8">
        <div className="h-10 w-full max-w-xl rounded bg-surface/70 animate-pulse mb-8" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-56 rounded-xl bg-surface/70 border border-line animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
