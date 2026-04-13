'use client'

import { useT } from '@/lib/use-t'
import { useAppActivitiesOptional } from '@/lib/app-activities-context'
import { useEmailSyncProgressOptional } from '@/components/EmailSyncProgressProvider'
import { useMe } from '@/lib/me-context'
import type { EmailScanMailboxContext, EmailScanPhase } from '@/lib/email-scan-stream'

function mailboxTitle(ctx: EmailScanMailboxContext | null, t: ReturnType<typeof useT>): string | null {
  if (!ctx) return null
  if (ctx.mailboxKind === 'global') return t.dashboard.emailSyncMailboxGlobal
  return t.dashboard.emailSyncMailboxSede.replace(/\{name\}/g, ctx.mailboxName)
}

function phaseLabel(phase: EmailScanPhase | null, t: ReturnType<typeof useT>): string {
  switch (phase) {
    case 'queued':
      return t.dashboard.emailSyncQueued
    case 'connect':
      return t.dashboard.emailSyncPhaseConnect
    case 'search':
      return t.dashboard.emailSyncPhaseSearch
    case 'process':
      return t.dashboard.emailSyncPhaseProcess
    case 'persist':
      return t.dashboard.emailSyncPhasePersist
    case 'complete':
      return t.dashboard.emailSyncPhaseDone
    default:
      return t.dashboard.syncing
  }
}

/**
 * Riepilogo compatto dei processi in corso (desktop header main).
 * Sessione utente, sync email, più attività da `setActivity` (AppActivitiesProvider).
 */
export default function AppShellActivityStrip() {
  const t = useT()
  const ctx = useEmailSyncProgressOptional()
  const reg = useAppActivitiesOptional()
  const { loading, me } = useMe()

  const p = ctx?.progress
  const showEmail = !!p?.active

  const showSession = loading && !me

  const registered = reg?.activities ?? []

  if (!showEmail && !showSession && registered.length === 0) return null

  const emailTitle =
    p && showEmail
      ? [mailboxTitle(p.mailboxContext, t), p.connectionWarning ?? phaseLabel(p.phase, t)].filter(Boolean).join(' — ')
      : ''

  return (
    <div
      className="flex min-w-0 flex-col gap-1 text-left"
      role="status"
      aria-live="polite"
      aria-busy={showEmail || showSession || registered.length > 0}
    >
      {showSession ? (
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-cyan-500/25 border-t-cyan-400"
            aria-hidden
          />
          <span className="truncate text-xs font-medium text-slate-400">{t.common.loading}</span>
        </div>
      ) : null}
      {showEmail && p ? (
        <div
          className={`flex min-w-0 items-center gap-2 ${
            p.connectionWarning ? 'text-red-300' : p.stalled ? 'text-amber-200/95' : 'text-cyan-200/90'
          }`}
          title={emailTitle}
        >
          <span
            className={`h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 ${
              p.connectionWarning
                ? 'border-red-500/30 border-t-red-400'
                : p.stalled
                  ? 'border-amber-500/30 border-t-amber-300'
                  : 'border-cyan-500/25 border-t-cyan-400'
            }`}
            aria-hidden
          />
          <span className="min-w-0 truncate text-xs font-medium leading-tight">
            <span className="text-slate-500">{t.dashboard.syncEmail}</span>
            <span className="mx-1.5 text-slate-600" aria-hidden>
              ·
            </span>
            <span>{p.connectionWarning ?? phaseLabel(p.phase, t)}</span>
            {!p.connectionWarning ? (
              <span className="ml-1.5 tabular-nums text-slate-500">
                {Math.round(Math.min(100, Math.max(0, p.percent)))}%
              </span>
            ) : null}
          </span>
        </div>
      ) : null}
      {registered.map((a) => (
        <div key={a.id} className="flex min-w-0 items-center gap-2 text-cyan-200/85">
          <span
            className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-cyan-500/25 border-t-cyan-400"
            aria-hidden
          />
          <span className="truncate text-xs font-medium leading-tight" title={a.label}>
            {a.label}
          </span>
        </div>
      ))}
    </div>
  )
}
