import { APP_SHELL_SECTION_PAGE_CLASS } from '@/lib/app-shell-layout'

export default function ListinoLoading() {
  return (
    <div className={APP_SHELL_SECTION_PAGE_CLASS}>
      {/* Header skeleton */}
      <div className="mb-4 flex items-center justify-between">
        <div className="h-7 w-32 animate-pulse rounded-lg bg-app-line-15" />
        <div className="h-6 w-20 animate-pulse rounded-md bg-app-line-10" />
      </div>

      {/* Card skeleton mobile */}
      <div className="flex flex-col gap-3 md:hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-fuchsia-500/20 bg-app-line-10/40 px-4 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-2.5 w-20 animate-pulse rounded bg-app-line-15" />
                <div className="h-4 w-3/4 animate-pulse rounded bg-app-line-20" />
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <div className="h-5 w-16 animate-pulse rounded bg-app-line-20" />
                <div className="h-4 w-14 animate-pulse rounded bg-app-line-15" />
              </div>
            </div>
            <div className="mt-2 h-2.5 w-24 animate-pulse rounded bg-app-line-10" />
          </div>
        ))}
      </div>

      {/* Table skeleton desktop */}
      <div className="hidden md:block rounded-xl border border-fuchsia-500/20 bg-app-line-10/40 overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-fuchsia-500/60 to-purple-500/40" />
        <div className="divide-y divide-app-line-10">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-6 px-6 py-4">
              <div className="h-3.5 w-32 animate-pulse rounded bg-app-line-20" />
              <div className="h-3.5 flex-1 animate-pulse rounded bg-app-line-15" />
              <div className="h-3.5 w-20 animate-pulse rounded bg-app-line-20" />
              <div className="h-3.5 w-24 animate-pulse rounded bg-app-line-15" />
              <div className="h-3.5 w-28 animate-pulse rounded bg-app-line-10" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
