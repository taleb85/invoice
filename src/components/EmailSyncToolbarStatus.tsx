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

type HealthTier = 'imap_issue' | 'stopped' | 'late' | 'ok'

function imapHealthTier(lastImapSyncAt?: string | null): HealthTier {
  const iso = lastImapSyncAt?.trim()
  if (!iso) return 'stopped'
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return 'stopped'
  const mins = Math.floor((Date.now() - t) / 60000)
  if (mins > 60) return 'stopped'
  if (mins > 30) return 'late'
  return 'ok'
}

/**
 * Stato sync email automatica + `last_imap_sync_at` sulla sede (soglie &gt;30 / &gt;60 min).
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

  const { label, title } = useMemo(() => {
    void tick
    const iso = lastImapSyncAt?.trim()
    const rel = !iso ? t.emailSyncCronNever : formatImapRelative(iso, t)
    if (lastImapSyncError?.trim()) {
      return {
        label: t.emailSyncCronIssueLine.replace('{relative}', rel),
        title: lastImapSyncError.trim(),
      }
    }
    const tier = imapHealthTier(lastImapSyncAt ?? null)
    const line =
      tier === 'late'
        ? t.emailSyncCronLateLine.replace('{relative}', rel)
        : tier === 'stopped'
          ? t.emailSyncCronStoppedLine.replace('{relative}', rel)
          : t.emailSyncCronLine.replace('{relative}', rel)
    return { label: line, title: undefined as string | undefined }
  }, [lastImapSyncAt, lastImapSyncError, t, tick])

  return (
    <span className={`whitespace-normal break-words text-left text-[10px] font-semibold leading-snug text-app-fg-muted sm:text-[11px] ${className ?? ''}`} title={title}>
      {label}
    </span>
  )
}
