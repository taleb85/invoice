'use client'

import { useEffect, useMemo, useState } from 'react'
import { EmailSyncHealthMarker } from '@/components/ui/glyph-icons'
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

type HealthTier = 'stopped' | 'late' | 'ok'

function markerTierForImap(health: HealthTier): 'ok' | 'late' | 'stopped' {
  if (health === 'late') return 'late'
  if (health === 'stopped') return 'stopped'
  return 'ok'
}

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

  const { label, title, markerTier } = useMemo(() => {
    void tick
    const iso = lastImapSyncAt?.trim()
    const rel = !iso ? t.emailSyncCronNever : formatImapRelative(iso, t)
    if (lastImapSyncError?.trim()) {
      return {
        label: t.emailSyncCronIssueLine.replace('{relative}', rel),
        title: lastImapSyncError.trim(),
        markerTier: 'issue' as const,
      }
    }
    const tier = imapHealthTier(lastImapSyncAt ?? null)
    const line =
      tier === 'late'
        ? t.emailSyncCronLateLine.replace('{relative}', rel)
        : tier === 'stopped'
          ? t.emailSyncCronStoppedLine.replace('{relative}', rel)
          : t.emailSyncCronLine.replace('{relative}', rel)
    return {
      label: line,
      title: undefined as string | undefined,
      markerTier: markerTierForImap(tier),
    }
  }, [lastImapSyncAt, lastImapSyncError, t, tick])

  return (
    <span
      className={`inline-flex items-start gap-1.5 whitespace-normal break-words text-left text-[10px] font-semibold leading-snug text-app-fg-muted sm:text-[11px] ${className ?? ''}`}
      title={title}
    >
      <EmailSyncHealthMarker tier={markerTier} className="mt-0.5" />
      <span>{label}</span>
    </span>
  )
}
