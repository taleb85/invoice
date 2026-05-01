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

/** Chip toolbar: solo numero + suffisso breve; dettaglio nel `title`. */
function formatImapRelativeCompact(iso: string, t: DashboardT): string {
  const d = new Date(iso).getTime()
  const mins = Math.floor((Date.now() - d) / 60000)
  if (mins < 1) return t.emailSyncCronJustNow
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 72) return `${hrs}h`
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
  } catch {
    return `${hrs}h`
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
  variant = 'default',
}: {
  lastImapSyncAt?: string | null
  lastImapSyncError?: string | null
  className?: string
  /** `compact`: marker + tempo breve; frase completa e errori nel `title`. */
  variant?: 'default' | 'compact'
}) {
  const tFull = useT()
  const t = tFull.dashboard
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((x) => x + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  const { label, title, markerTier, compactLabel } = useMemo(() => {
    void tick
    const iso = lastImapSyncAt?.trim()
    const rel = !iso ? t.emailSyncCronNever : formatImapRelative(iso, t)
    const relCompact = !iso ? t.emailSyncCronNever : formatImapRelativeCompact(iso, t)
    if (lastImapSyncError?.trim()) {
      const full = t.emailSyncCronIssueLine.replace('{relative}', rel)
      return {
        label: full,
        compactLabel: relCompact === t.emailSyncCronNever ? '—' : relCompact,
        title: `${full}\n${lastImapSyncError.trim()}`,
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
      compactLabel: relCompact,
      title: line,
      markerTier: markerTierForImap(tier),
    }
  }, [lastImapSyncAt, lastImapSyncError, t, tick])

  const displayLabel = variant === 'compact' ? compactLabel : label

  return (
    <span
      className={`inline-flex items-center gap-1 text-left text-[10px] font-semibold leading-none text-app-fg-muted sm:text-[11px] ${
        variant === 'compact' ? 'min-w-0 max-w-full whitespace-nowrap' : 'items-start gap-1.5 whitespace-normal break-words leading-snug'
      } ${className ?? ''}`}
      title={title}
    >
      <EmailSyncHealthMarker tier={markerTier} className={variant === 'compact' ? 'shrink-0' : 'mt-0.5'} />
      <span className={variant === 'compact' ? 'min-w-0 truncate tabular-nums' : ''}>{displayLabel}</span>
    </span>
  )
}
