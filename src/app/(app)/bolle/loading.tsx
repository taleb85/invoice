import { APP_SHELL_SECTION_PAGE_STACK_CLASS } from '@/lib/app-shell-layout'

function TableRowSkeleton({ cols }: { cols: number[] }) {
  return (
    <div className="flex items-center gap-4 border-b border-app-line-10 px-5 py-3.5">
      {cols.map((w, i) => (
        <div
          key={i}
          className="h-3 animate-pulse rounded bg-app-line-15"
          style={{ width: `${w}%`, flexShrink: 0 }}
        />
      ))}
    </div>
  )
}

export default function BolleLoading() {
  return (
    <div className={APP_SHELL_SECTION_PAGE_STACK_CLASS}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="h-7 w-36 animate-pulse rounded-lg bg-app-line-15" />
        <div className="h-8 w-28 animate-pulse rounded-xl bg-cyan-500/20" />
      </div>

      {/* Filters bar */}
      <div className="flex gap-2">
        <div className="h-9 flex-1 animate-pulse rounded-lg border border-app-line-20 bg-app-line-10/50" />
        <div className="h-9 w-24 animate-pulse rounded-lg bg-app-line-10/50" />
        <div className="h-9 w-24 animate-pulse rounded-lg bg-app-line-10/50" />
      </div>

      {/* Mobile card skeletons */}
      <div className="flex flex-col gap-2 md:hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-app-line-15 bg-app-line-10/40 px-4 py-3.5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="h-3.5 w-24 animate-pulse rounded bg-app-line-20" />
              <div className="h-5 w-16 animate-pulse rounded-full bg-app-line-15" />
            </div>
            <div className="h-3 w-3/4 animate-pulse rounded bg-app-line-15" />
            <div className="mt-1.5 h-3 w-1/2 animate-pulse rounded bg-app-line-10" />
          </div>
        ))}
      </div>

      {/* Desktop table skeleton */}
      <div className="hidden md:block overflow-hidden rounded-xl border border-app-line-15 bg-app-line-10/30">
        <div className="h-1 w-full bg-gradient-to-r from-cyan-500/50 to-blue-500/30" />
        {/* Header row */}
        <div className="flex items-center gap-4 border-b border-app-line-18 px-5 py-3">
          {[18, 30, 15, 12, 10, 8].map((w, i) => (
            <div key={i} className="h-2.5 animate-pulse rounded bg-app-line-20" style={{ width: `${w}%` }} />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <TableRowSkeleton key={i} cols={[18, 30, 15, 12, 10, 8]} />
        ))}
      </div>
    </div>
  )
}
