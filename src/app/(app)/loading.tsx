export default function AppLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 animate-pulse md:p-8">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-40 rounded-lg bg-slate-700/80" />
          <div className="hidden h-4 w-56 rounded-lg bg-slate-800/80 md:block" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-28 rounded-lg bg-slate-700/80" />
          <div className="h-10 w-10 rounded-lg bg-slate-800/80" />
        </div>
      </div>

      {/* Cards row skeleton */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-slate-800/60" />
        ))}
      </div>

      {/* Table/list skeleton */}
      <div className="app-card overflow-hidden">
        <div className="app-card-bar opacity-50" aria-hidden />
        <div className="h-12 border-b border-slate-700/60 bg-slate-950/40" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-slate-800/80 px-6 py-4 last:border-0"
          >
            <div className="h-9 w-9 shrink-0 rounded-full bg-slate-800/80" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-1/3 rounded bg-slate-700/80" />
              <div className="h-3 w-1/2 rounded bg-slate-800/80" />
            </div>
            <div className="h-6 w-20 rounded-full bg-slate-800/80" />
          </div>
        ))}
      </div>
    </div>
  )
}
