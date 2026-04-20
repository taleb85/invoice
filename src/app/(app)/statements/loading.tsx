import { APP_SHELL_SECTION_PAGE_STACK_CLASS } from '@/lib/app-shell-layout'

/** Skeleton for the statements page — mirrors: header, tab strip, month selector, table. */
export default function StatementsLoading() {
  return (
    <div className={APP_SHELL_SECTION_PAGE_STACK_CLASS}>
      {/* Page header */}
      <div className="flex items-center justify-between gap-3">
        <div className="h-7 w-56 animate-pulse rounded-lg bg-app-line-15" />
        <div className="h-8 w-32 animate-pulse rounded-xl bg-cyan-500/20" />
      </div>

      {/* Tab strip */}
      <div className="flex gap-1.5 rounded-xl border border-app-line-18 bg-app-line-10/40 p-1">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className={`h-8 flex-1 animate-pulse rounded-lg ${i === 0 ? 'bg-app-line-25' : 'bg-app-line-10'}`}
          />
        ))}
      </div>

      {/* Month / year selector */}
      <div className="flex items-center justify-between gap-3">
        <div className="h-8 w-28 animate-pulse rounded-lg bg-app-line-15" />
        <div className="flex gap-2">
          <div className="h-8 w-8 animate-pulse rounded-lg bg-app-line-10" />
          <div className="h-8 w-8 animate-pulse rounded-lg bg-app-line-10" />
        </div>
      </div>

      {/* Summary KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-app-line-15 bg-app-line-10/40 px-4 py-3 space-y-1.5">
            <div className="h-2.5 w-16 animate-pulse rounded bg-app-line-15" />
            <div className="h-6 w-20 animate-pulse rounded bg-app-line-20" />
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-hidden rounded-xl border border-cyan-500/20 bg-app-line-10/30">
        <div className="h-1 w-full bg-gradient-to-r from-cyan-500/50 to-teal-500/30" />
        <div className="flex items-center gap-4 border-b border-app-line-18 px-5 py-3">
          {[22, 16, 14, 14, 14, 12, 6].map((w, i) => (
            <div key={i} className="h-2.5 animate-pulse rounded bg-app-line-20" style={{ width: `${w}%` }} />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-app-line-10 px-5 py-3.5">
            {[22, 16, 14, 14, 14, 12, 6].map((w, j) => (
              <div key={j} className="h-3 animate-pulse rounded bg-app-line-15" style={{ width: `${w}%` }} />
            ))}
          </div>
        ))}
      </div>

      {/* Mobile card list */}
      <div className="flex flex-col gap-2 md:hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-app-line-15 bg-app-line-10/40 px-4 py-3.5 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="h-3.5 w-32 animate-pulse rounded bg-app-line-20" />
              <div className="h-4 w-16 animate-pulse rounded-full bg-cyan-500/20" />
            </div>
            <div className="h-3 w-3/5 animate-pulse rounded bg-app-line-15" />
            <div className="h-3 w-2/5 animate-pulse rounded bg-app-line-10" />
          </div>
        ))}
      </div>
    </div>
  )
}
