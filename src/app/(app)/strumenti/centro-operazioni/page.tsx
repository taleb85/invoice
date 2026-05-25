'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocale } from '@/lib/locale-context'
import type { Translations } from '@/lib/translations'
import { useMe } from '@/lib/me-context'
import { useActiveOperator } from '@/lib/active-operator-context'
import { canAccessCentroOperazioniPage } from '@/lib/effective-operator-ui'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import { AppPageHeaderTitleWithDashboardShortcut } from '@/components/AppPageHeaderDashboardShortcut'
import { BackButton } from '@/components/BackButton'
import {
  APP_PAGE_HEADER_STRIP_H1_CLASS,
  APP_PAGE_HEADER_STRIP_SUBTITLE_CLASS,
  APP_SHELL_SECTION_PAGE_STACK_CLASS,
} from '@/lib/app-shell-layout'
import { useManualDeliverySede } from '@/lib/use-effective-sede-id'
import { useReprocessDaAssociare } from '@/lib/use-reprocess-da-associare'
import DuplicateManager from '@/components/duplicates/duplicate-manager'
function OpsSectionTitle({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h2 id={id} className="mb-3 border-b border-app-line-10 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-app-fg-muted">
      {children}
    </h2>
  )
}

type DashboardPayload = {
  lastCleanupAt: string | null
  lastCleanupProcessed: number | null
  lastCleanupScanned: number | null
  lastCycleErrors: string[]
  documentsAutoProcessedToday: number
  scopeSedeId: string | null
}

function formatAgo(iso: string | null, t: Translations): string {
  if (!iso) return '—'
  const ts = new Date(iso).getTime()
  if (Number.isNaN(ts)) return '—'
  const m = Math.max(0, Math.floor((Date.now() - ts) / 60000))
  const cd = t.centroOpDashboard
  if (m < 1) return cd.timeLessThanMinute
  if (m === 1) return cd.timeOneMinute
  if (m < 60) return cd.timeMinutes.replace('{n}', String(m))
  const h = Math.floor(m / 60)
  if (h === 1) return cd.timeAboutOneHour
  if (h < 48) return cd.timeAboutHours.replace('{n}', String(h))
  const d = Math.floor(h / 24)
  return cd.timeAboutDays.replace('{n}', String(d))
}

function CentroOperazioniDashboard(props: {
  forceLoading: boolean
  onForce: () => void
  data: DashboardPayload | null
  loadError: string | null
  forceError: string | null
  centroControlloLabel: string
  t: Translations
}) {
  const { data, loadError, forceLoading, onForce, forceError, centroControlloLabel, t } = props
  const cd = t.centroOpDashboard
  return (
    <div className="space-y-4">
      <div className="app-card overflow-hidden p-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">{cd.cardAutoMonitoringTitle}</p>
        <p className="mt-1 text-sm text-app-fg-muted">
          {cd.cardAutoMonitoringDesc}
        </p>
        {loadError ? (
          <p className="mt-3 text-sm text-rose-300">{loadError}</p>
        ) : data ? (
          <ul className="mt-4 space-y-2 text-sm text-app-fg">
            <li>
              <span className="text-app-fg-muted">{cd.lastCleanupQueue}</span>
              <span className="font-semibold">{formatAgo(data.lastCleanupAt, t)}</span>
              {data.lastCleanupAt ? (
                <span className="text-app-fg-muted"> ({new Date(data.lastCleanupAt).toLocaleString()})</span>
              ) : null}
            </li>
            <li>
              <span className="text-app-fg-muted">{cd.lastCycleLog}</span>
              {cd.processedWord}{' '}
              <span className="font-semibold">{data.lastCleanupProcessed ?? '—'}</span>, {cd.scannedWord}{' '}
              <span className="font-semibold">{data.lastCleanupScanned ?? '—'}</span>
            </li>
            <li>
              <span className="text-app-fg-muted">{cd.autoUnlockedToday}</span>
              <span className="font-semibold">{data.documentsAutoProcessedToday}</span>
            </li>
            <li className="text-app-fg-muted text-xs">
              {cd.sedeScopeLabel}{data.scopeSedeId ? <span className="text-app-fg font-mono">{data.scopeSedeId}</span> : cd.sedeScopeAllAdmin}
            </li>
          </ul>
        ) : (
          <p className="mt-3 text-sm text-app-fg-muted">{cd.loading}</p>
        )}
      </div>

      <div className="app-card overflow-hidden p-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">{cd.cardLastCleanupErrorsTitle}</p>
        {data?.lastCycleErrors?.length ? (
          <ul className="mt-3 max-h-40 list-disc space-y-1 overflow-auto pl-5 text-xs text-rose-200/95">
            {data.lastCycleErrors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-emerald-200/90">{cd.cardLastCleanupErrorsEmpty}</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={forceLoading}
          onClick={onForce}
          className="inline-flex touch-manipulation items-center justify-center gap-2 rounded-lg border border-cyan-500/45 bg-cyan-500/12 px-4 py-2.5 text-xs font-bold text-cyan-100 transition-colors hover:bg-cyan-500/18 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {forceLoading ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-cyan-100 border-t-transparent" />
              {cd.forceCleanupRunning}
            </>
          ) : (
            cd.forceCleanup
          )}
        </button>
        {forceError ? <span className="text-xs text-rose-300">{forceError}</span> : null}
      </div>

      <p className="rounded-xl border border-app-line-25 bg-white/[0.03] px-4 py-3 text-xs leading-relaxed text-app-fg-muted">
        {cd.footerNoteUseCC}{' '}
        <Link href="/strumenti/centro-controllo" className="font-semibold text-cyan-300 underline decoration-cyan-500/35 underline-offset-4 hover:text-cyan-200">
          {centroControlloLabel}
        </Link>
        . {cd.footerNoteUseEmailSync} <strong className="text-app-fg">{cd.footerAnalisiCompleta}</strong>.
      </p>
    </div>
  )
}

export default function CentroOperazioniPage() {
  const { t } = useLocale()
  const s = t.strumentiCentroOperazioni
  const d = t.dashboard
  const { me, loading: meLoading } = useMe()
  const { activeOperator } = useActiveOperator()
  const { effectiveSedeId } = useManualDeliverySede()

  const canView = canAccessCentroOperazioniPage(me, activeOperator)

  const [data, setData] = useState<DashboardPayload | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [forceLoading, setForceLoading] = useState(false)
  const [forceError, setForceError] = useState<string | null>(null)
  const [historicSyncLoading, setHistoricSyncLoading] = useState(false)
  const [historicSyncError, setHistoricSyncError] = useState<string | null>(null)
  const [historicSyncResult, setHistoricSyncResult] = useState<string | null>(null)
  const [historicProgressLine, setHistoricProgressLine] = useState<string | null>(null)
  const [dupOpen, setDupOpen] = useState(false)

  const reprocessStrings = useMemo(
    () => ({
      resultTemplate: s.reprocessDaAssociareResult,
      moreHint: s.reprocessDaAssociareMoreHint,
      runningStatus: s.reprocessDaAssociareRunning,
    }),
    [s.reprocessDaAssociareMoreHint, s.reprocessDaAssociareResult, s.reprocessDaAssociareRunning],
  )

  const {
    loading: reprocessLoading,
    error: reprocessError,
    result: reprocessResult,
    run: onReprocessDaAssociare,
    runningStatus: reprocessRunningStatus,
  } = useReprocessDaAssociare({
    effectiveSedeId,
    strings: reprocessStrings,
  })

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      const res = await fetch('/api/centro-operazioni/dashboard', { cache: 'no-store' })
      const j = (await res.json().catch(() => ({}))) as DashboardPayload & { error?: string }
      if (!res.ok) {
        setLoadError(j.error ?? `HTTP ${res.status}`)
        return
      }
      setData({
        lastCleanupAt: j.lastCleanupAt,
        lastCleanupProcessed: j.lastCleanupProcessed,
        lastCleanupScanned: j.lastCleanupScanned,
        lastCycleErrors: j.lastCycleErrors ?? [],
        documentsAutoProcessedToday: j.documentsAutoProcessedToday ?? 0,
        scopeSedeId: j.scopeSedeId ?? null,
      })
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : t.common.networkError)
    }
  }, [t])

  useEffect(() => {
    if (canView) void load()
  }, [canView, load])

  const onForce = useCallback(async () => {
    setForceLoading(true)
    setForceError(null)
    try {
      const res = await fetch('/api/centro-operazioni/force-cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setForceError(j.error ?? `HTTP ${res.status}`)
        return
      }
      await load()
    } catch (e) {
      setForceError(e instanceof Error ? e.message : t.common.networkError)
    } finally {
      setForceLoading(false)
    }
  }, [load, t])

  const onHistoricEmailSync = useCallback(async () => {
    setHistoricSyncLoading(true)
    setHistoricSyncError(null)
    setHistoricSyncResult(null)
    setHistoricProgressLine(null)
    let cumulativeRicevuti = 0
    try {
      for (;;) {
        const res = await fetch('/api/scan-emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'historical',
            client_locale:
              typeof navigator !== 'undefined' && typeof navigator.language === 'string'
                ? navigator.language
                : undefined,
            ...(effectiveSedeId ? { user_sede_id: effectiveSedeId } : {}),
          }),
        })
        const j = (await res.json().catch(() => ({}))) as {
          error?: string
          done?: boolean
          ricevuti?: number
          progressLabel?: string
        }
        if (!res.ok) {
          setHistoricSyncError(j.error ?? `HTTP ${res.status}`)
          return
        }
        if (typeof j.done !== 'boolean') {
          setHistoricSyncError(s.historicSyncInvalidResponse)
          return
        }
        const r = typeof j.ricevuti === 'number' && Number.isFinite(j.ricevuti) ? j.ricevuti : 0
        cumulativeRicevuti += r
        const label = typeof j.progressLabel === 'string' ? j.progressLabel : ''
        if (!j.done && label) {
          setHistoricProgressLine(s.historicSyncProgress.replace('{label}', label))
        } else {
          setHistoricProgressLine(null)
        }
        if (j.done === true) break
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }
      setHistoricProgressLine(null)
      setHistoricSyncResult(
        `${s.historicSyncCompleted}\n${s.historicSyncResult.replace('{n}', String(cumulativeRicevuti))}`,
      )
    } catch (e) {
      setHistoricSyncError(e instanceof Error ? e.message : t.common.networkError)
    } finally {
      setHistoricSyncLoading(false)
    }
  }, [effectiveSedeId, s.historicSyncCompleted, s.historicSyncInvalidResponse, s.historicSyncProgress, s.historicSyncResult, t])

  if (meLoading) {
    return (
      <div className={`${APP_SHELL_SECTION_PAGE_STACK_CLASS} flex min-h-[40vh] items-center justify-center pb-10`}>
        <p className="text-sm text-app-fg-muted">{t.common.loading}</p>
      </div>
    )
  }

  if (!canView) {
    return (
      <div className={`${APP_SHELL_SECTION_PAGE_STACK_CLASS} pb-10`}>
        <AppPageHeaderStrip
          accent="teal"
          leadingAccessory={<BackButton href="/" label={t.nav.dashboard} iconOnly className="mb-0 shrink-0" />}
        >
          <AppPageHeaderTitleWithDashboardShortcut>
            <h1 className={APP_PAGE_HEADER_STRIP_H1_CLASS}>{s.pageTitle}</h1>
            <p className={`${APP_PAGE_HEADER_STRIP_SUBTITLE_CLASS} !max-w-none`}>{s.accessDeniedSubtitle}</p>
          </AppPageHeaderTitleWithDashboardShortcut>
        </AppPageHeaderStrip>
        <div className="app-card overflow-hidden p-6">
          <p className="m-0 text-sm leading-relaxed text-app-fg-muted">{s.accessDeniedBody}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/strumenti/sedi"
              className="inline-flex items-center justify-center rounded-lg border border-cyan-500/45 bg-cyan-500/12 px-4 py-2.5 text-xs font-bold text-cyan-100 transition-colors hover:bg-cyan-500/18"
            >
              {s.accessDeniedCtaSedi}
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-lg border border-app-line-25 bg-white/[0.04] px-4 py-2.5 text-xs font-bold text-app-fg transition-colors hover:bg-white/[0.07]"
            >
              {s.accessDeniedCtaDashboard}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`${APP_SHELL_SECTION_PAGE_STACK_CLASS} pb-10`}>
      <AppPageHeaderStrip
        accent="teal"
        leadingAccessory={<BackButton href="/" label={t.nav.dashboard} iconOnly className="mb-0 shrink-0" />}
      >
        <AppPageHeaderTitleWithDashboardShortcut>
          <h1 className={APP_PAGE_HEADER_STRIP_H1_CLASS}>{s.pageTitle}</h1>
          <p className={`${APP_PAGE_HEADER_STRIP_SUBTITLE_CLASS} !max-w-none`}>{s.pageSubtitle}</p>
        </AppPageHeaderTitleWithDashboardShortcut>
      </AppPageHeaderStrip>
      <div className="grid w-full grid-cols-1 items-start gap-10 lg:grid-cols-2 lg:gap-x-8 xl:gap-x-10">
        <section className="flex w-full min-w-0 flex-col gap-6" aria-labelledby="ops-section-sync">
          <OpsSectionTitle id="ops-section-sync">{s.sectionSyncEmail}</OpsSectionTitle>
          <div className="flex w-full min-w-0 flex-col gap-4">
            <div className="app-card overflow-hidden p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">{s.historicSyncSectionLabel}</p>
              <p className="mt-2 text-base font-semibold text-app-fg">{s.historicSyncTitle}</p>
              <p className="mt-2 text-sm text-app-fg-muted">{s.historicSyncDesc}</p>
              <p className="mt-3 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/95">
                {s.historicSyncWarning}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={historicSyncLoading}
                  onClick={onHistoricEmailSync}
                  className="inline-flex touch-manipulation items-center justify-center gap-2 rounded-lg border border-violet-500/45 bg-violet-500/12 px-4 py-2.5 text-xs font-bold text-violet-100 transition-colors hover:bg-violet-500/18 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {historicSyncLoading ? (
                    <>
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-violet-100 border-t-transparent" />
                      {t.common.loading}
                    </>
                  ) : (
                    s.historicSyncCta
                  )}
                </button>
                {historicSyncError ? <span className="text-xs text-rose-300">{historicSyncError}</span> : null}
              </div>
              {historicProgressLine ? (
                <p className="mt-3 text-xs text-app-fg-muted">{historicProgressLine}</p>
              ) : null}
              {historicSyncResult ? (
                <p className="mt-3 whitespace-pre-line text-sm text-emerald-200/95">{historicSyncResult}</p>
              ) : null}
            </div>
          </div>
        </section>

        <section className="flex w-full min-w-0 flex-col gap-6" aria-labelledby="ops-section-documenti">
          <OpsSectionTitle id="ops-section-documenti">{s.sectionDocumenti}</OpsSectionTitle>
          <div className="flex w-full min-w-0 flex-col gap-4">
            <div className="app-card overflow-hidden p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">
                {s.reprocessDaAssociareTitle}
              </p>
              <p className="mt-2 text-sm text-app-fg-muted">{s.reprocessDaAssociareDesc}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  aria-busy={reprocessLoading}
                  disabled={reprocessLoading}
                  onClick={() => void onReprocessDaAssociare()}
                  className="inline-flex touch-manipulation items-center justify-center gap-2 rounded-lg border border-emerald-500/45 bg-emerald-500/12 px-4 py-2.5 text-xs font-bold text-emerald-100 transition-colors hover:bg-emerald-500/18 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {reprocessLoading ? (
                    <>
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-100 border-t-transparent" />
                      {t.common.loading}
                    </>
                  ) : (
                    s.reprocessDaAssociareCta
                  )}
                </button>
                {reprocessError ? <span className="text-xs text-rose-300">{reprocessError}</span> : null}
              </div>
              {reprocessLoading ? (
                <div
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                  className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-400/35 bg-emerald-500/[0.07] px-3 py-2.5 text-left"
                >
                  <span
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-emerald-600/70 border-t-transparent dark:border-emerald-100 dark:border-t-transparent"
                    aria-hidden
                  />
                  <span className="text-xs font-semibold leading-snug text-app-fg">
                    {reprocessRunningStatus}
                  </span>
                </div>
              ) : null}
              {reprocessResult ? (
                <p className="mt-3 text-sm text-emerald-200/95">{reprocessResult}</p>
              ) : null}
            </div>
          </div>
        </section>

        <section className="flex w-full min-w-0 flex-col gap-6" aria-labelledby="ops-section-manutenzione">
          <OpsSectionTitle id="ops-section-manutenzione">{s.sectionManutenzione}</OpsSectionTitle>
          <div className="flex w-full min-w-0 flex-col gap-4">
            <div className="app-card overflow-hidden p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">{s.cardDupScanTitle}</p>
              <p className="mt-2 text-sm text-app-fg-muted">{s.cardDupScanDesc}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setDupOpen(true)}
                  className="inline-flex touch-manipulation items-center justify-center gap-2 rounded-lg border border-amber-500/45 bg-amber-500/12 px-4 py-2.5 text-xs font-bold text-amber-100 transition-colors hover:bg-amber-500/18"
                >
                  {d.duplicateFattureScanButton}
                </button>
              </div>
            </div>

            <div className="app-card overflow-hidden p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">{s.cardAuditTitle}</p>
              <p className="mt-2 text-sm text-app-fg-muted">{s.cardAuditDesc}</p>
              <Link
                href="/inbox-ai?tab=audit"
                className="mt-4 inline-flex text-sm font-semibold text-cyan-300 underline decoration-cyan-500/35 underline-offset-4 hover:text-cyan-200"
              >
                {s.cardOpenAudit} →
              </Link>
            </div>

            <CentroOperazioniDashboard
              data={data}
              loadError={loadError}
              forceLoading={forceLoading}
              forceError={forceError}
              onForce={onForce}
              centroControlloLabel={t.strumentiCentroControllo.pageTitle}
              t={t}
            />
          </div>
        </section>
      </div>

      <DuplicateManager open={dupOpen} onOpenChange={setDupOpen} />
    </div>
  )
}
