'use client'

import { useT } from '@/lib/use-t'
import type { EmailScanPhase } from '@/lib/email-scan-stream'
import { useEmailSyncProgressOptional } from '@/components/EmailSyncProgressProvider'

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
 * Barra globale sotto l’header app: visibile durante la sincronizzazione email
 * (dashboard, scheda fornitore, ecc.).
 */
export default function EmailSyncProgressBar() {
  const ctx = useEmailSyncProgressOptional()
  const t = useT()
  if (!ctx) return null

  const { progress } = ctx
  const visible =
    progress.active || progress.stalled || progress.toast !== null || !!progress.connectionWarning

  if (!visible) return null

  const connWarn = progress.connectionWarning
  const label = connWarn ?? phaseLabel(progress.phase, t)
  const pct = Math.min(100, Math.max(0, progress.percent))
  const att = progress.attachmentsTotal
  const attDone = progress.attachmentsProcessed
  const mailLine = progress.mailsFound > 0 ? `${progress.mailsProcessed}/${progress.mailsFound}` : null
  const attLine = att > 0 ? `${attDone}/${att}` : null
  const barError = !!connWarn

  return (
    <div
      className={`sticky top-14 z-[35] border-b px-3 py-2 backdrop-blur-md md:top-0 md:z-[25] ${
        barError
          ? 'border-red-500/40 bg-red-950/90 shadow-[0_4px_24px_-8px_rgba(239,68,68,0.35)]'
          : 'border-cyan-500/25 bg-slate-950/95 shadow-[0_4px_24px_-8px_rgba(6,182,212,0.35)]'
      }`}
      role="status"
      aria-live="polite"
      aria-busy={progress.active}
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <span
            className={`font-medium ${barError ? 'text-red-100' : 'text-cyan-100/95'}`}
          >
            {label}
          </span>
          {progress.stalled && progress.active ? (
            <span className="flex flex-col items-end gap-0.5 text-right">
              <span className="font-semibold text-amber-300">{t.dashboard.emailSyncStalled}</span>
              {progress.stalledWave > 0 ? (
                <span className="font-normal text-amber-200/85">
                  {t.dashboard.emailSyncStalledReconnect
                    .replace('{current}', String(progress.stalledWave))
                    .replace('{max}', '3')}
                </span>
              ) : null}
            </span>
          ) : null}
          <span className="tabular-nums text-slate-400">{Math.round(pct)}%</span>
        </div>
        <div className={`h-1.5 w-full overflow-hidden rounded-full ${barError ? 'bg-red-950/80' : 'bg-slate-800/90'}`}>
          <div
            className={`h-full rounded-full transition-[width] duration-500 ease-out ${
              barError
                ? 'bg-gradient-to-r from-red-600 to-rose-500'
                : 'bg-gradient-to-r from-cyan-500 to-emerald-500'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {(mailLine || attLine) && (
          <p className="text-[10px] text-slate-500" title={t.dashboard.emailSyncCountsHint}>
            {[mailLine, attLine].filter(Boolean).join(' · ')}
          </p>
        )}
        {progress.toast && (
          <p
            className={`text-[11px] font-medium ${
              progress.toast.type === 'ok'
                ? 'text-emerald-300'
                : progress.toast.type === 'warn'
                  ? 'text-amber-200'
                  : 'text-red-300'
            }`}
          >
            {progress.toast.text}
          </p>
        )}
      </div>
    </div>
  )
}
