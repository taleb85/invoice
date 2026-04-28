function LogRowSkeleton() {
  return (
    <div className="flex items-start gap-3 border-b border-app-line-10 px-4 py-3.5">
      {/* Sender avatar */}
      <div className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-app-line-15" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="h-3 w-32 animate-pulse rounded bg-app-line-20" />
          <div className="h-4 w-14 animate-pulse rounded-full bg-cyan-500/20" />
        </div>
        <div className="h-2.5 w-4/5 animate-pulse rounded bg-app-line-15" />
        <div className="h-2.5 w-2/5 animate-pulse rounded bg-app-line-10" />
      </div>
      <div className="shrink-0 space-y-1.5 text-right">
        <div className="h-3 w-16 animate-pulse rounded bg-app-line-15" />
        <div className="h-3 w-20 animate-pulse rounded bg-app-line-10" />
      </div>
    </div>
  )
}

/** Skeleton for the email sync log page — mirrors: header, KPI card, mobile list, desktop table. */
export default function LogLoading() {
  return (
    <div className="app-shell-page-padding space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1.5">
          <div className="h-7 w-44 animate-pulse rounded-lg bg-app-line-15" />
          <div className="h-2.5 w-64 animate-pulse rounded bg-app-line-10" />
        </div>
      </div>

      {/* Summary highlight */}
      <div className="h-16 w-full animate-pulse rounded-xl border border-cyan-500/20 bg-cyan-500/8" />

      {/* Mobile log cards */}
      <div className="flex flex-col md:hidden overflow-hidden rounded-xl border border-app-line-15 bg-app-line-10/30">
        <div className="h-1 w-full bg-gradient-to-r from-cyan-500/50 to-blue-500/30" />
        {Array.from({ length: 6 }).map((_, i) => (
          <LogRowSkeleton key={i} />
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-hidden rounded-xl border border-cyan-500/20 bg-app-line-10/30">
        <div className="h-1 w-full bg-gradient-to-r from-cyan-500/50 to-blue-500/30" />
        {/* Table header */}
        <div className="flex items-center gap-4 border-b border-app-line-18 px-5 py-3">
          {[20, 32, 12, 10, 8, 6].map((w, i) => (
            <div key={i} className="h-2.5 animate-pulse rounded bg-app-line-20" style={{ width: `${w}%` }} />
          ))}
        </div>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-app-line-10 px-5 py-3.5">
            {[20, 32, 12, 10, 8, 6].map((w, j) => (
              <div key={j} className="h-3 animate-pulse rounded bg-app-line-15" style={{ width: `${w}%` }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
