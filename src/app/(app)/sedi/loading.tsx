import { APP_SHELL_SECTION_PAGE_STACK_CLASS } from '@/lib/app-shell-layout'

function SedeCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border-t-2 border-t-[#22d3ee] border-x-0 border-b-0 bg-app-line-10/30">
      <div className="h-1 w-full bg-gradient-to-r from-cyan-500/40 to-blue-500/25" />
      {/* Sede header */}
      <div className="flex items-center gap-3 border-b border-app-line-15 px-4 py-3.5">
        <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-cyan-500/20" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="h-4 w-36 animate-pulse rounded bg-app-line-20" />
          <div className="h-3 w-24 animate-pulse rounded bg-app-line-15" />
        </div>
        <div className="flex shrink-0 gap-2">
          <div className="h-7 w-16 animate-pulse rounded-lg bg-app-line-10" />
          <div className="h-7 w-7 animate-pulse rounded-lg bg-app-line-10" />
        </div>
      </div>
      {/* IMAP row */}
      <div className="flex items-center gap-3 border-b border-app-line-10 px-4 py-3">
        <div className="h-3 w-3 animate-pulse rounded-full bg-app-line-20" />
        <div className="h-3 w-48 animate-pulse rounded bg-app-line-15" />
        <div className="ml-auto h-4 w-20 animate-pulse rounded-full bg-app-line-10" />
      </div>
      {/* Operators */}
      <div className="px-4 py-3 space-y-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-7 w-7 shrink-0 animate-pulse rounded-lg bg-app-line-15" />
            <div className="h-3 w-28 animate-pulse rounded bg-app-line-15" />
            <div className="ml-auto h-4 w-16 animate-pulse rounded-full bg-app-line-10" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Skeleton for the sedi page — mirrors: header, "new sede" button, sede cards with IMAP + operators. */
export default function SediLoading() {
  return (
    <div className={`${APP_SHELL_SECTION_PAGE_STACK_CLASS} w-full min-w-0`}>
      {/* Page header */}
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1.5">
          <div className="h-7 w-44 animate-pulse rounded-lg bg-app-line-15" />
          <div className="h-2.5 w-64 animate-pulse rounded bg-app-line-10" />
        </div>
        <div className="h-9 w-28 animate-pulse rounded-xl bg-cyan-500/20" />
      </div>

      {/* Sede cards */}
      <div className="space-y-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <SedeCardSkeleton key={i} />
        ))}
      </div>

      {/* Unassigned users section */}
      <div className="overflow-hidden rounded-xl border border-app-line-15 bg-app-line-10/20 px-4 py-4 space-y-3">
        <div className="h-3 w-32 animate-pulse rounded bg-app-line-15" />
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-7 w-7 animate-pulse rounded-lg bg-app-line-15" />
            <div className="h-3 w-36 animate-pulse rounded bg-app-line-15" />
            <div className="ml-auto h-4 w-20 animate-pulse rounded-full bg-app-line-10" />
          </div>
        ))}
      </div>
    </div>
  )
}
