import { APP_SHELL_SECTION_PAGE_STACK_CLASS } from '@/lib/app-shell-layout'

/** Skeleton for the archivio page — mirrors: header, queue card, per-supplier cards. */
export default function ArchivioLoading() {
  return (
    <div className={APP_SHELL_SECTION_PAGE_STACK_CLASS}>
      {/* Page header + export button */}
      <div className="flex items-center justify-between gap-3">
        <div className="h-7 w-36 animate-pulse rounded-lg bg-app-line-15" />
        <div className="h-8 w-28 animate-pulse rounded-xl bg-amber-500/20" />
      </div>

      {/* Summary highlight card */}
      <div className="h-16 w-full animate-pulse rounded-xl border border-[rgba(34,211,238,0.15)] bg-amber-500/8" />

      {/* DocumentiQueue placeholder */}
      <div className="overflow-hidden rounded-xl border border-[rgba(34,211,238,0.15)] bg-app-line-10/30">
        <div className="h-1 w-full bg-gradient-to-r from-amber-500/50 to-orange-500/30" />
        <div className="flex items-center justify-between border-b border-app-line-18 px-4 py-3">
          <div className="space-y-1.5">
            <div className="h-3.5 w-36 animate-pulse rounded bg-app-line-20" />
            <div className="h-2.5 w-52 animate-pulse rounded bg-app-line-15" />
          </div>
          <div className="h-5 w-7 animate-pulse rounded-full bg-amber-500/30" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between border-b border-app-line-10 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 animate-pulse rounded-full bg-amber-400/50" />
              <div className="h-3 w-24 animate-pulse rounded bg-app-line-15" />
              <div className="h-4 w-16 animate-pulse rounded-full bg-amber-500/20" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-5 w-20 animate-pulse rounded bg-app-line-10" />
              <div className="h-5 w-16 animate-pulse rounded bg-amber-500/15" />
            </div>
          </div>
        ))}
      </div>

      {/* Per-supplier cards */}
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-app-line-15 bg-app-line-10/30">
            <div className="h-1 w-full bg-gradient-to-r from-app-line-20 to-app-line-10" />
            {/* Supplier header */}
            <div className="flex items-center gap-3 border-b border-app-line-15 px-4 py-3">
              <div className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-cyan-500/20" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="h-3.5 w-36 animate-pulse rounded bg-app-line-20" />
                <div className="flex gap-3">
                  <div className="h-2.5 w-16 animate-pulse rounded bg-app-line-15" />
                  <div className="h-2.5 w-16 animate-pulse rounded bg-app-line-15" />
                </div>
              </div>
              <div className="h-7 w-16 animate-pulse rounded-lg bg-app-line-10" />
            </div>
            {/* Bolle rows */}
            <div className="px-4 py-3 space-y-2">
              <div className="h-2.5 w-20 animate-pulse rounded bg-app-line-15" />
              {Array.from({ length: 2 }).map((_, j) => (
                <div key={j} className="flex items-center justify-between rounded-lg bg-app-line-10/40 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-amber-400/50" />
                    <div className="h-3 w-20 animate-pulse rounded bg-app-line-15" />
                    <div className="h-4 w-16 animate-pulse rounded-full bg-app-line-20" />
                  </div>
                  <div className="h-3 w-20 animate-pulse rounded bg-app-line-10" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
