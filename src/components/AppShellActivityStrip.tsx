'use client'

import { useMe } from '@/lib/me-context'
import { useT } from '@/lib/use-t'
import { useAppActivitiesOptional } from '@/lib/app-activities-context'
import { useEmailSyncProgressOptional } from '@/components/EmailSyncProgressProvider'
import type { EmailScanMailboxContext } from '@/lib/email-scan-stream'
import { emailSyncProgressPhaseTitle } from '@/lib/email-sync-ui-phase-label'

function mailboxTitle(ctx: EmailScanMailboxContext | null, t: ReturnType<typeof useT>): string | null {
  if (!ctx) return null
  if (ctx.mailboxKind === 'global') return t.dashboard.emailSyncMailboxGlobal
  return t.dashboard.emailSyncMailboxSede.replace(/\{name\}/g, ctx.mailboxName)
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
      ? [
          mailboxTitle(p.mailboxContext, t),
          p.connectionWarning ??
            emailSyncProgressPhaseTitle(p.phase, p.connectStep, t.dashboard),
        ]
          .filter(Boolean)
          .join(' — ')
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
            className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-cyan-500/25 border-t-cyan-400 shadow-[0_0_10px_rgba(103,232,249,0.55),0_0_20px_rgba(6,182,212,0.32)]"
            aria-hidden
          />
          <span className="truncate text-xs font-medium text-slate-200">{t.common.loading}</span>
        </div>
      ) : null}
      {showEmail && p ? (
        <div className="min-w-0">
          <div
            className={`flex min-w-0 items-center gap-2 ${
              p.connectionWarning ? 'text-red-300' : p.stalled ? 'text-amber-200/95' : 'text-cyan-200/90'
            }`}
            title={emailTitle}
          >
            <span
              className={`h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 ${
                p.connectionWarning
                  ? 'border-red-500/30 border-t-red-400 shadow-[0_0_10px_rgba(248,113,113,0.55),0_0_20px_rgba(239,68,68,0.28)]'
                  : p.stalled
                    ? 'border-amber-500/30 border-t-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.5),0_0_20px_rgba(245,158,11,0.3)]'
                    : 'border-cyan-500/25 border-t-cyan-400 shadow-[0_0_10px_rgba(103,232,249,0.55),0_0_20px_rgba(6,182,212,0.32)]'
              }`}
              aria-hidden
            />
            <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden text-xs font-medium leading-tight">
              <span
                className={`shrink-0 ${
                  p.connectionWarning
                    ? 'font-semibold text-red-100'
                    : p.stalled
                      ? 'font-semibold text-amber-50'
                      : 'font-semibold text-cyan-50 [text-shadow:0_0_12px_rgba(103,232,249,0.45)]'
                }`}
              >
                {t.dashboard.syncEmail}
              </span>
              <span
                className={`min-w-0 flex-1 truncate ${
                  p.connectionWarning ? 'text-red-100/95' : p.stalled ? 'text-amber-100/90' : 'text-cyan-100/90'
                }`}
              >
                {p.connectionWarning ??
                  emailSyncProgressPhaseTitle(p.phase, p.connectStep, t.dashboard)}
              </span>
              {!p.connectionWarning ? (
                <span className="shrink-0 tabular-nums text-slate-200">
                  {Math.round(Math.min(100, Math.max(0, p.percent)))}%
                </span>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      {registered.map((a) => (
        <div key={a.id} className="flex min-w-0 items-center gap-2 text-cyan-200/85">
          <span
            className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-cyan-500/25 border-t-cyan-400 shadow-[0_0_10px_rgba(103,232,249,0.55),0_0_20px_rgba(6,182,212,0.32)]"
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
