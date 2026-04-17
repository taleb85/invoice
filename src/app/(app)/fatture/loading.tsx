import { APP_SHELL_SECTION_PAGE_STACK_CLASS } from '@/lib/app-shell-layout'

export default function FattureLoading() {
  return (
    <div className={APP_SHELL_SECTION_PAGE_STACK_CLASS}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="h-7 w-32 animate-pulse rounded-lg bg-app-line-15" />
        <div className="h-8 w-36 animate-pulse rounded-xl bg-violet-500/20" />
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-app-line-15 bg-app-line-10/40 p-4">
            <div className="mb-2 h-2.5 w-16 animate-pulse rounded bg-app-line-15" />
            <div className="h-6 w-20 animate-pulse rounded bg-app-line-20" />
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="h-9 flex-1 animate-pulse rounded-lg border border-app-line-20 bg-app-line-10/50" />
        <div className="h-9 w-28 animate-pulse rounded-lg bg-app-line-10/50" />
      </div>

      {/* Mobile card list */}
      <div className="flex flex-col gap-2 md:hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-violet-500/20 bg-app-line-10/40 px-4 py-3.5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="h-3.5 w-32 animate-pulse rounded bg-app-line-20" />
              <div className="h-5 w-20 animate-pulse rounded bg-app-line-15 font-mono" />
            </div>
            <div className="h-3 w-3/5 animate-pulse rounded bg-app-line-15" />
            <div className="mt-1.5 h-3 w-2/5 animate-pulse rounded bg-app-line-10" />
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-hidden rounded-xl border border-violet-500/20 bg-app-line-10/30">
        <div className="h-1 w-full bg-gradient-to-r from-violet-500/55 to-purple-500/30" />
        <div className="flex items-center gap-4 border-b border-app-line-18 px-5 py-3">
          {[14, 24, 15, 16, 12, 10, 6].map((w, i) => (
            <div key={i} className="h-2.5 animate-pulse rounded bg-app-line-20" style={{ width: `${w}%` }} />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-app-line-10 px-5 py-3.5">
            {[14, 24, 15, 16, 12, 10, 6].map((w, j) => (
              <div key={j} className="h-3 animate-pulse rounded bg-app-line-15" style={{ width: `${w}%` }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
