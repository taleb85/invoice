'use client'

import { usePathname } from 'next/navigation'
import { useT } from '@/lib/use-t'
import { emailSyncProgressPhaseTitle } from '@/lib/email-sync-ui-phase-label'
import { useEmailSyncProgressOptional } from '@/components/EmailSyncProgressProvider'
import { normalizeAppPath } from '@/lib/mobile-hub-routes'
import { buildEmailSyncMailStatLines } from '@/lib/email-sync-stat-lines'


function AttemptProgressTrack(props: {
  current: number
  max: number
  variant: 'amber' | 'red'
}) {
  const max = Math.max(1, props.max)
  const current = Math.min(max, Math.max(0, props.current))
  const pct = (current / max) * 100
  const isRed = props.variant === 'red'
  return (
    <div className="space-y-2">
      <div
        className={`h-1.5 w-full overflow-hidden rounded-full ${
          isRed ? 'bg-red-950/70 ring-1 ring-red-500/25' : 'bg-amber-950/50 ring-1 ring-amber-500/20'
        }`}
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={`${current} / ${max}`}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-300 ease-out ${
            isRed
              ? 'bg-gradient-to-r from-red-500 to-rose-400 shadow-[0_0_12px_rgba(248,113,113,0.35)]'
              : 'bg-gradient-to-r from-amber-500 to-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.35)]'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex shrink-0 justify-end gap-1.5" aria-hidden>
        {Array.from({ length: max }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i < current
                ? isRed
                  ? 'w-7 bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.45)]'
                  : 'w-7 bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.45)]'
                : 'w-5 bg-slate-600/70'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

function mailLineClass(
  key: string,
  variant: 'live' | 'completionOk' | 'completionWarn',
): string {
  const base = 'text-pretty font-medium'
  if (variant === 'completionWarn') {
    if (key === 'imported') return `${base} text-amber-200/95`
    if (key === 'processed') return `${base} text-amber-100/95`
    if (key === 'already') return `${base} text-amber-200/90`
    if (key === 'ignored' || key === 'drafts') return `${base} text-amber-200/85`
    return `${base} text-amber-100/95`
  }
  if (variant === 'completionOk') {
    if (key === 'imported') return `${base} text-emerald-200/95`
    if (key === 'processed') return `${base} text-cyan-100/95`
    if (key === 'already') return `${base} text-slate-300`
    if (key === 'ignored' || key === 'drafts') return `${base} text-slate-300`
    return `${base} text-cyan-100/95`
  }
  // live cyan box
  if (key === 'imported') return `${base} text-emerald-200/90 [text-shadow:0_0_20px_rgba(52,211,153,0.1)]`
  if (key === 'processed') return `${base} text-cyan-50/95 [text-shadow:0_0_24px_rgba(34,211,238,0.12)]`
  if (key === 'already') return `${base} text-slate-400`
  if (key === 'ignored' || key === 'drafts') return `${base} text-slate-400`
  return `${base} text-cyan-100/95 [text-shadow:0_0_24px_rgba(34,211,238,0.12)]`
}

/**
 * Barra globale sotto l’header app: visibile durante la sincronizzazione email
 * (dashboard, scheda fornitore, ecc.).
 */
export default function EmailSyncProgressBar() {
  const ctx = useEmailSyncProgressOptional()
  const t = useT()
  const pathname = usePathname() ?? ''
  const onBolleNewMobile = normalizeAppPath(pathname) === '/bolle/new'
  if (!ctx) return null

  const { progress, cancelEmailSync, dismissEmailSyncCompletion } = ctx
  const visible =
    progress.active || progress.stalled || progress.toast !== null || !!progress.connectionWarning

  if (!visible) return null

  const connWarn = progress.connectionWarning
  const label =
    connWarn ??
    emailSyncProgressPhaseTitle(progress.phase, progress.connectStep, t.dashboard)
  const rawPct = progress.percent
  const pct = Math.min(
    100,
    Math.max(0, typeof rawPct === 'number' && Number.isFinite(rawPct) ? rawPct : 0),
  )
  const att = progress.attachmentsTotal
  const attDone = progress.attachmentsProcessed
  const mf = progress.mailsFound
  const mp = progress.mailsProcessed
  const ric = progress.ricevuti
  const ign = progress.ignorate
  const boz = progress.bozzeCreate
  const skipDup = progress.skippedAlreadyCompleted
  const supplierFilterLine =
    progress.mailboxContext?.supplierFilter?.trim() ?
      t.dashboard.emailSyncSupplierFilterLine.replace(
        /\{name\}/g,
        progress.mailboxContext.supplierFilter.trim(),
      )
    : null
  const showUnitStats = att > 0 || attDone > 0
  const unitStatsLine = showUnitStats
    ? t.dashboard.emailSyncStatUnitsLine.replace(/\{done\}/g, String(attDone)).replace(/\{total\}/g, String(att))
    : null

  const mailLines = buildEmailSyncMailStatLines(t.dashboard, mf, mp, ric, ign, boz, skipDup)
  const statsTitle = [...mailLines.map((l) => l.text), unitStatsLine].filter(Boolean).join(' · ')

  const barError = !!connWarn
  const stalledActive = progress.stalled && progress.active && !barError
  const imapRetry = progress.imapRetry

  const showCompletionSummary =
    !progress.active &&
    progress.phase === 'complete' &&
    progress.toast !== null &&
    progress.toast.type !== 'error'
  const completionWarn = showCompletionSummary && progress.toast?.type === 'warn'

  const showLiveStatsPanel =
    !!supplierFilterLine ||
    progress.active ||
    progress.stalled ||
    mf > 0 ||
    mp > 0 ||
    ric > 0 ||
    ign > 0 ||
    boz > 0 ||
    skipDup > 0 ||
    showUnitStats

  const completionUnitLine = t.dashboard.emailSyncStatUnitsLine
    .replace(/\{done\}/g, String(attDone))
    .replace(/\{total\}/g, String(att))

  return (
    <div
      className={`sticky top-14 z-[35] overflow-x-visible border-b px-4 py-3 backdrop-blur-md md:top-0 md:z-[25] md:px-8 ${
        onBolleNewMobile ? 'max-md:mt-14' : ''
      } ${
        barError
          ? 'border-red-500/40 bg-red-950/90 shadow-[0_4px_24px_-8px_rgba(239,68,68,0.35)]'
          : completionWarn
            ? 'border-amber-500/35 bg-slate-950/95 shadow-[0_4px_24px_-8px_rgba(245,158,11,0.28)]'
            : showCompletionSummary
              ? 'border-emerald-500/35 bg-slate-950/95 shadow-[0_4px_24px_-8px_rgba(16,185,129,0.3)]'
              : stalledActive
                ? 'border-amber-500/30 bg-slate-950/95 shadow-[0_4px_24px_-8px_rgba(245,158,11,0.2)]'
                : 'border-cyan-500/25 bg-slate-950/95 shadow-[0_4px_24px_-8px_rgba(6,182,212,0.35)]'
      }`}
      role="status"
      aria-live="polite"
      aria-busy={progress.active}
    >
      <div className="flex w-full min-w-0 flex-col gap-2.5 overflow-x-visible">
        <div className="flex min-w-0 items-start justify-between gap-3 text-sm sm:items-center sm:text-base">
          <span
            className={`min-w-0 flex-1 font-semibold leading-snug ${
              barError
                ? 'text-red-100'
                : completionWarn
                  ? 'text-amber-100/95'
                  : showCompletionSummary
                    ? 'text-emerald-100/95'
                    : stalledActive
                      ? 'text-cyan-100/90'
                      : 'text-cyan-100/95'
            }`}
          >
            {label}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            {showCompletionSummary ? (
              <button
                type="button"
                onClick={() => dismissEmailSyncCompletion()}
                className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors sm:text-sm ${
                  completionWarn
                    ? 'border-amber-400/50 text-amber-100 hover:bg-amber-500/15'
                    : 'border-emerald-400/50 text-emerald-100 hover:bg-emerald-500/15'
                }`}
                aria-label={t.dashboard.emailSyncDismissAria}
              >
                {t.dashboard.emailSyncDismiss}
              </button>
            ) : null}
            {progress.active ? (
              <button
                type="button"
                onClick={() => cancelEmailSync()}
                className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors sm:text-sm ${
                  barError
                    ? 'border-red-400/50 text-red-100 hover:bg-red-500/15'
                    : stalledActive
                      ? 'border-amber-400/45 text-amber-100 hover:bg-amber-500/15'
                      : 'border-cyan-400/45 text-cyan-100 hover:bg-cyan-500/15'
                }`}
                aria-label={t.dashboard.emailSyncStopAria}
              >
                {t.dashboard.emailSyncStop}
              </button>
            ) : null}
            <span
              className={`tabular-nums text-base font-semibold sm:text-lg ${
                barError
                  ? 'text-red-100 [text-shadow:0_0_12px_rgba(248,113,113,0.6),0_0_22px_rgba(239,68,68,0.28)]'
                  : completionWarn
                    ? 'text-amber-100 [text-shadow:0_0_12px_rgba(253,230,138,0.55),0_0_22px_rgba(245,158,11,0.32)]'
                    : showCompletionSummary
                      ? 'text-emerald-100 [text-shadow:0_0_12px_rgba(110,231,183,0.55),0_0_22px_rgba(16,185,129,0.32)]'
                      : stalledActive
                        ? 'text-amber-100 [text-shadow:0_0_12px_rgba(253,230,138,0.45),0_0_20px_rgba(245,158,11,0.22)]'
                        : 'text-cyan-50 [text-shadow:0_0_12px_rgba(103,232,249,0.7),0_0_24px_rgba(6,182,212,0.35)]'
              }`}
            >
              {Math.round(pct)}%
            </span>
          </div>
        </div>

        {barError && imapRetry ? (
          <div className="rounded-lg border border-red-500/35 bg-red-950/35 px-3 py-2.5 sm:px-4">
            <p className="text-xs font-semibold text-red-100/95 sm:text-sm">
              {t.dashboard.emailSyncImapRetryLine
                .replace(/\{current\}/g, String(imapRetry.attempt))
                .replace(/\{max\}/g, String(imapRetry.maxAttempts))}
            </p>
            <div className="mt-2">
              <AttemptProgressTrack
                current={imapRetry.attempt}
                max={imapRetry.maxAttempts}
                variant="red"
              />
            </div>
          </div>
        ) : null}

        {progress.stalled && progress.active && !barError ? (
          <div className="rounded-xl border border-amber-500/35 bg-gradient-to-br from-amber-950/50 via-slate-950/40 to-slate-950/60 px-3 py-3 shadow-inner shadow-amber-950/20 sm:px-4">
            <div className="flex gap-3 sm:gap-4">
              <div className="flex shrink-0 flex-col items-center pt-1" aria-hidden>
                <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/15 ring-1 ring-amber-400/30">
                  <svg className="h-4 w-4 animate-spin text-amber-300" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                </span>
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-pretty text-sm font-medium leading-relaxed text-amber-50 sm:text-[0.9375rem]">
                  {t.dashboard.emailSyncStalled}
                </p>
                <p className="text-pretty text-xs leading-snug text-amber-200/85 sm:text-sm">
                  {t.dashboard.emailSyncStalledHint}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div
          className={`h-3 w-full overflow-hidden rounded-full sm:h-3.5 ${
            barError
              ? 'bg-red-950/80'
              : showCompletionSummary
                ? completionWarn
                  ? 'bg-amber-950/50 ring-1 ring-amber-500/20'
                  : 'bg-emerald-950/40 ring-1 ring-emerald-500/20'
                : stalledActive
                  ? 'bg-slate-800/90 ring-1 ring-amber-500/25'
                  : 'bg-slate-800/90'
          }`}
        >
          <div
            className={`h-full rounded-full transition-[width] duration-500 ease-out ${
              barError
                ? 'bg-gradient-to-r from-red-600 to-rose-500'
                : completionWarn
                  ? 'bg-gradient-to-r from-amber-500 to-amber-400'
                  : showCompletionSummary
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-500'
                    : stalledActive
                      ? 'animate-pulse bg-gradient-to-r from-cyan-500 to-emerald-500'
                      : 'bg-gradient-to-r from-cyan-500 to-emerald-500'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {showCompletionSummary ? (
          <div
            className={`rounded-xl border px-3 py-3 shadow-inner sm:px-4 ${
              completionWarn
                ? 'border-amber-500/35 bg-gradient-to-br from-amber-950/40 via-slate-900/35 to-slate-950/50 shadow-amber-950/15'
                : 'border-emerald-500/35 bg-gradient-to-br from-emerald-950/40 via-slate-900/35 to-slate-950/50 shadow-emerald-950/20'
            }`}
          >
            <div className="flex gap-3 sm:gap-4">
              <div className="flex shrink-0 flex-col pt-0.5" aria-hidden>
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-full ${
                    completionWarn
                      ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/35'
                      : 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/35'
                  }`}
                >
                  {completionWarn ? (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </span>
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <p
                  className={`text-[11px] font-semibold uppercase tracking-wide ${
                    completionWarn ? 'text-amber-400/90' : 'text-emerald-400/90'
                  }`}
                >
                  {t.dashboard.emailSyncCountsHint}
                </p>
                {progress.toast?.text ? (
                  <p
                    className={`text-pretty text-sm font-medium leading-relaxed sm:text-base ${
                      completionWarn ? 'text-amber-50' : 'text-emerald-50'
                    }`}
                  >
                    {progress.toast.text}
                  </p>
                ) : null}
                {supplierFilterLine ? (
                  <p
                    className={`text-xs font-medium sm:text-sm ${
                      completionWarn ? 'text-amber-200/85' : 'text-emerald-200/85'
                    }`}
                  >
                    {supplierFilterLine}
                  </p>
                ) : null}
                <ul className="list-none space-y-2 border-t border-white/10 pt-2 text-xs leading-snug sm:text-sm">
                  {mailLines.map(({ key, text }) => (
                    <li
                      key={key}
                      className={mailLineClass(key, completionWarn ? 'completionWarn' : 'completionOk')}
                    >
                      {text}
                    </li>
                  ))}
                  {showUnitStats ? (
                    <li
                      className={`text-pretty font-medium ${
                        completionWarn ? 'text-amber-100/90' : 'text-emerald-100/95'
                      }`}
                    >
                      {completionUnitLine}
                    </li>
                  ) : null}
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <>
            {showLiveStatsPanel && (
              <div
                className="relative overflow-visible rounded-lg border border-cyan-500/25 bg-gradient-to-br from-cyan-950/35 via-slate-900/40 to-slate-950/50 shadow-inner shadow-cyan-950/20"
                title={statsTitle || t.dashboard.emailSyncCountsHint}
              >
                <div className="min-w-0 px-3 py-3 sm:px-4">
                  {supplierFilterLine ? (
                    <p className="text-xs font-medium text-cyan-200/90 sm:text-sm">{supplierFilterLine}</p>
                  ) : null}
                  <ul
                    className={`list-none space-y-2 text-xs leading-snug sm:text-sm ${
                      supplierFilterLine ? 'mt-2 border-t border-cyan-500/20 pt-2' : ''
                    }`}
                  >
                    {mailLines.map(({ key, text }) => (
                      <li key={key} className={mailLineClass(key, 'live')}>
                        {text}
                      </li>
                    ))}
                    {unitStatsLine ? (
                      <li className="text-pretty font-medium text-emerald-200/90 [text-shadow:0_0_20px_rgba(52,211,153,0.1)]">
                        {unitStatsLine}
                      </li>
                    ) : null}
                  </ul>
                </div>
              </div>
            )}
            {progress.toast && (
              <p
                className={`text-sm font-medium sm:text-base ${
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
          </>
        )}
      </div>
    </div>
  )
}
