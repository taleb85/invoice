import { APP_SHELL_SECTION_PAGE_STACK_CLASS } from '@/lib/app-shell-layout'

/** Skeleton for the ordini (order confirmations) page — mirrors: header, summary card, grid/table. */
export default function OrdiniLoading() {
  return (
    <div className={APP_SHELL_SECTION_PAGE_STACK_CLASS}>
      {/* Page header */}
      <div className="flex items-center justify-between gap-3">
        <div className="h-7 w-40 animate-pulse rounded-lg bg-app-line-15" />
        <div className="h-8 w-32 animate-pulse rounded-xl bg-rose-500/20" />
      </div>

      {/* Summary card */}
      <div className="h-16 w-full animate-pulse rounded-xl border border-[rgba(34,211,238,0.15)] bg-rose-500/8" />

      {/* Filters bar */}
      <div className="flex flex-wrap gap-2">
        <div className="h-9 flex-1 animate-pulse rounded-lg border border-app-line-20 bg-app-line-10/50" />
        <div className="h-9 w-28 animate-pulse rounded-lg bg-app-line-10/50" />
      </div>

      {/* Mobile card list */}
      <div className="flex flex-col gap-2 md:hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-[rgba(34,211,238,0.15)] bg-app-line-10/40 px-4 py-3.5 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="h-3.5 w-32 animate-pulse rounded bg-app-line-20" />
              <div className="h-4 w-20 animate-pulse rounded-full bg-rose-500/20" />
            </div>
            <div className="h-3 w-3/4 animate-pulse rounded bg-app-line-15" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-app-line-10" />
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-hidden rounded-xl border border-[rgba(34,211,238,0.15)] bg-app-line-10/30">
        <div className="h-1 w-full bg-gradient-to-r from-rose-500/50 to-pink-500/30" />
        <div className="flex items-center gap-4 border-b border-app-line-18 px-5 py-3">
          {[22, 28, 14, 16, 12, 6].map((w, i) => (
            <div key={i} className="h-2.5 animate-pulse rounded bg-app-line-20" style={{ width: `${w}%` }} />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-app-line-10 px-5 py-3.5">
            {[22, 28, 14, 16, 12, 6].map((w, j) => (
              <div key={j} className="h-3 animate-pulse rounded bg-app-line-15" style={{ width: `${w}%` }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
