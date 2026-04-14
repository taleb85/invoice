'use client'

import Link from 'next/link'
import { useMe } from '@/lib/me-context'
import { useLocale } from '@/lib/locale-context'
import NotificationBell from '@/components/NotificationBell'

const dashboardShortcutClass =
  'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-500/45 bg-slate-600/35 text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors hover:border-slate-400/50 hover:bg-slate-600/55 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/45 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-700'

/**
 * Scorciatoia dashboard + campana notifiche (striscia header desktop).
 */
export default function DesktopHeaderToolbar({ workspaceAlert }: { workspaceAlert: boolean }) {
  const { me } = useMe()
  const { t } = useLocale()
  const isAdmin = Boolean(me?.is_admin)

  return (
    <div className="flex shrink-0 items-center gap-2">
      <Link
        href="/"
        className={dashboardShortcutClass}
        title={t.nav.dashboard}
        aria-label={t.nav.dashboard}
      >
        <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
        {workspaceAlert ? (
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full border border-slate-700 bg-cyan-400 shadow-[0_0_3px_rgba(34,211,238,0.5)]" />
        ) : null}
      </Link>
      <NotificationBell
        variant="header"
        isAdmin={isAdmin}
        initialAdminErrors={0}
        initialOperatorPending={0}
        initialOperatorLogErrors={0}
      />
    </div>
  )
}
