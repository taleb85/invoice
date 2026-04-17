import { APP_SHELL_SECTION_PAGE_STACK_CLASS } from '@/lib/app-shell-layout'

/** Skeleton per la dashboard principale — mostrato durante i Server Component data fetch. */
export default function DashboardLoading() {
  return (
    <div className={APP_SHELL_SECTION_PAGE_STACK_CLASS}>
      {/* Page title */}
      <div className="flex items-center justify-between gap-3">
        <div className="h-7 w-48 animate-pulse rounded-lg bg-app-line-15" />
        <div className="h-6 w-24 animate-pulse rounded-md bg-app-line-10" />
      </div>

      {/* KPI grid — mirrors SUPPLIER_DESKTOP_KPI_GRID_LAYOUT_CLASS breakpoints */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3 xl:grid-cols-6 xl:gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-2 overflow-hidden rounded-xl border border-app-line-15 bg-app-line-10/40 p-3 md:p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="h-2.5 w-16 animate-pulse rounded bg-app-line-15" />
              <div className="h-5 w-5 animate-pulse rounded-lg bg-app-line-10" />
            </div>
            <div className="h-7 w-20 animate-pulse rounded bg-app-line-20" />
            <div className="h-2 w-24 animate-pulse rounded bg-app-line-10" />
          </div>
        ))}
      </div>

      {/* Sync widget placeholder */}
      <div className="h-24 w-full animate-pulse rounded-xl border border-cyan-500/20 bg-cyan-500/5" />

      {/* Two-column section */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-3 overflow-hidden rounded-xl border border-app-line-15 bg-app-line-10/30 p-4">
          <div className="h-4 w-28 animate-pulse rounded bg-app-line-15" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-app-line-15" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-4/5 animate-pulse rounded bg-app-line-20" />
                <div className="h-2.5 w-3/5 animate-pulse rounded bg-app-line-10" />
              </div>
              <div className="h-5 w-14 animate-pulse rounded bg-app-line-15" />
            </div>
          ))}
        </div>
        <div className="space-y-3 overflow-hidden rounded-xl border border-app-line-15 bg-app-line-10/30 p-4">
          <div className="h-4 w-24 animate-pulse rounded bg-app-line-15" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-3">
              <div className="h-3 w-3/5 animate-pulse rounded bg-app-line-15" />
              <div className="h-5 w-16 animate-pulse rounded bg-app-line-20 font-mono" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
