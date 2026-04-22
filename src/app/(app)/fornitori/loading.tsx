import { APP_SHELL_SECTION_PAGE_STACK_CLASS } from '@/lib/app-shell-layout'

function SupplierCardSkeleton() {
  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-[rgba(34,211,238,0.15)] bg-app-line-10/40 sm:rounded-3xl">
      <div className="h-1 w-full animate-pulse rounded-t-2xl bg-gradient-to-r from-sky-500/40 to-cyan-500/25 sm:h-1 sm:rounded-t-3xl" />
      <div className="flex gap-3 p-3 sm:gap-4 sm:p-4">
        {/* Avatar */}
        <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-sky-500/20 sm:h-12 sm:w-12 sm:rounded-2xl" />
        {/* Name + email */}
        <div className="min-w-0 flex-1 space-y-2 pt-0.5">
          <div className="h-4 w-3/5 animate-pulse rounded bg-app-line-20" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-app-line-15" />
          <div className="h-3 w-2/5 animate-pulse rounded bg-app-line-10" />
        </div>
      </div>
      {/* Footer */}
      <div className="mt-auto h-10 w-full animate-pulse rounded-b-2xl border-t border-[rgba(34,211,238,0.15)] bg-app-line-10/60 sm:rounded-b-3xl" />
    </div>
  )
}

export default function FornitoriLoading() {
  return (
    <div className={APP_SHELL_SECTION_PAGE_STACK_CLASS}>
      {/* Page header */}
      <div className="mb-1 flex items-center justify-between gap-3">
        <div className="h-7 w-40 animate-pulse rounded-lg bg-app-line-15" />
        <div className="h-7 w-32 animate-pulse rounded-lg bg-app-line-10" />
      </div>

      {/* KPI summary card */}
      <div className="h-16 w-full animate-pulse rounded-xl border border-[rgba(34,211,238,0.15)] bg-sky-500/8" />

      {/* Search bar */}
      <div className="h-10 w-full animate-pulse rounded-lg border border-[rgba(34,211,238,0.15)] bg-app-line-10/50" />

      {/* Grid skeleton — mirrors responsive grid: 1 → 2 → 3 → 4 cols */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-5 lg:grid-cols-3 lg:gap-4 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <SupplierCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}
