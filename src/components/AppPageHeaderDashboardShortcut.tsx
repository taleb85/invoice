import Link from 'next/link'
import type { ReactNode } from 'react'
import { DASHBOARD_HEADER_SHORTCUT_CLASS } from '@/lib/dashboard-shortcut-class'

const homeIcon = (
  <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
    />
  </svg>
)

/** Icona home/dashboard come nella toolbar header desktop (`href="/"`). */
export function AppPageHeaderDashboardShortcut({ dashboardLabel }: { dashboardLabel: string }) {
  return (
    <Link
      href="/"
      className={`${DASHBOARD_HEADER_SHORTCUT_CLASS} shrink-0`}
      title={dashboardLabel}
      aria-label={dashboardLabel}
    >
      {homeIcon}
    </Link>
  )
}

/**
 * Colonna titolo standard nelle `AppPageHeaderStrip`: scorciatoia dashboard + contenuto (h1, sottotitoli, ecc.).
 */
export function AppPageHeaderTitleWithDashboardShortcut({
  dashboardLabel,
  children,
  className = 'min-w-0 items-start gap-3 sm:flex-1 sm:flex-initial',
  showDashboardShortcut = true,
}: {
  dashboardLabel: string
  children: ReactNode
  /** Classi del contenitore flex esterno (allineamento / flex nelle strip). */
  className?: string
  /** Su `/` la scorciatoia verso la dashboard è ridondante. */
  showDashboardShortcut?: boolean
}) {
  return (
    <div className={`flex ${className}`}>
      {showDashboardShortcut ? (
        <AppPageHeaderDashboardShortcut dashboardLabel={dashboardLabel} />
      ) : null}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
