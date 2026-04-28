'use client'

import { useEffect, useMemo, useState } from 'react'
import { useT } from '@/lib/use-t'
import type { Translations } from '@/lib/translations'

type DashboardT = Translations['dashboard']

function formatImapRelative(iso: string, t: DashboardT): string {
  const d = new Date(iso).getTime()
  const mins = Math.floor((Date.now() - d) / 60000)
  if (mins < 1) return t.emailSyncCronJustNow
  if (mins < 60) return t.emailSyncCronMinutesAgo.replace('{n}', String(mins))
  const hrs = Math.floor(mins / 60)
  if (hrs < 72) return t.emailSyncCronHoursAgo.replace('{n}', String(hrs))
  try {
    return new Date(iso).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return t.emailSyncCronHoursAgo.replace('{n}', String(hrs))
  }
}

/**
 * Mostra stato sync email automatico (cron) e ultimo `last_imap_sync_at` sulla sede in scope.
 */
export default function EmailSyncToolbarStatus({
  lastImapSyncAt,
  lastImapSyncError,
  className,
}: {
  lastImapSyncAt?: string | null
  lastImapSyncError?: string | null
  className?: string
}) {
  const tFull = useT()
  const t = tFull.dashboard
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((x) => x + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  const relative = useMemo(() => {
    void tick
    const iso = lastImapSyncAt?.trim()
    if (!iso) return t.emailSyncCronNever
    return formatImapRelative(iso, t)
  }, [lastImapSyncAt, t, tick])

  const label = lastImapSyncError?.trim()
    ? t.emailSyncCronIssueLine.replace('{relative}', relative)
    : t.emailSyncCronLine.replace('{relative}', relative)

  return (
    <span className={`whitespace-normal break-words text-left text-[10px] font-semibold leading-snug text-app-fg-muted sm:text-[11px] ${className ?? ''}`} title={lastImapSyncError?.trim() || undefined}>
      {label}
    </span>
  )
}
