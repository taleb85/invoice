'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocale } from '@/lib/locale-context'
import { useMe } from '@/lib/me-context'
import { useActiveOperator } from '@/lib/active-operator-context'
import { effectiveIsAdminSedeUi, effectiveIsMasterAdminPlane } from '@/lib/effective-operator-ui'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import { AppPageHeaderTitleWithDashboardShortcut } from '@/components/AppPageHeaderDashboardShortcut'
import { BackButton } from '@/components/BackButton'
import {
  APP_SHELL_SECTION_PAGE_CLASS,
  APP_PAGE_HEADER_STRIP_H1_CLASS,
  APP_PAGE_HEADER_STRIP_SUBTITLE_CLASS,
  APP_SHELL_SECTION_PAGE_STACK_CLASS,
} from '@/lib/app-shell-layout'
import { useManualDeliverySede } from '@/lib/use-effective-sede-id'
import { useReprocessDaAssociare } from '@/lib/use-reprocess-da-associare'
import DuplicateManager from '@/components/duplicates/duplicate-manager'
import FixOcrDatesCard from '@/components/admin/fix-ocr-dates-card'

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

function formatAgo(iso: string | null): string {
  if (!iso) return '—'
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return '—'
  const m = Math.max(0, Math.floor((Date.now() - t) / 60000))
  if (m < 1) return 'meno di 1 minuto fa'
  if (m === 1) return '1 minuto fa'
  if (m < 60) return `${m} minuti fa`
  const h = Math.floor(m / 60)
  if (h === 1) return 'circa 1 ora fa'
  if (h < 48) return `circa ${h} ore fa`
  const d = Math.floor(h / 24)
  return `circa ${d} giorni fa`
}

function CentroOperazioniDashboard(props: {
  forceLoading: boolean
  onForce: () => void
  data: DashboardPayload | null
  loadError: string | null
  forceError: string | null
}) {
  const { data, loadError, forceLoading, onForce, forceError } = props
  return (
    <div className="space-y-4">
      <div className="app-card overflow-hidden p-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">Monitoraggio automatico</p>
        <p className="mt-1 text-sm text-app-fg-muted">
          Le operazioni su documenti e coda email sono eseguite in background; qui vedi solo lo stato.
        </p>
        {loadError ? (
          <p className="mt-3 text-sm text-rose-300">{loadError}</p>
        ) : data ? (
          <ul className="mt-4 space-y-2 text-sm text-app-fg">
            <li>
              <span className="text-app-fg-muted">Ultimo cleanup coda revisione: </span>
              <span className="font-semibold">{formatAgo(data.lastCleanupAt)}</span>
              {data.lastCleanupAt ? (
                <span className="text-app-fg-muted"> ({new Date(data.lastCleanupAt).toLocaleString()})</span>
              ) : null}
            </li>
            <li>
              <span className="text-app-fg-muted">Ultimo ciclo (record log): </span>
              processati{' '}
              <span className="font-semibold">{data.lastCleanupProcessed ?? '—'}</span>, esaminati{' '}
              <span className="font-semibold">{data.lastCleanupScanned ?? '—'}</span>
            </li>
            <li>
              <span className="text-app-fg-muted">Documenti sbloccati automaticamente oggi (cleanup): </span>
              <span className="font-semibold">{data.documentsAutoProcessedToday}</span>
            </li>
            <li className="text-app-fg-muted text-xs">
              Ambito sede: {data.scopeSedeId ? <span className="text-app-fg font-mono">{data.scopeSedeId}</span> : 'tutte (admin master)'}
            </li>
          </ul>
        ) : (
          <p className="mt-3 text-sm text-app-fg-muted">Caricamento…</p>
        )}
      </div>

      <div className="app-card overflow-hidden p-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">Errori ultimo cleanup</p>
        {data?.lastCycleErrors?.length ? (
          <ul className="mt-3 max-h-40 list-disc space-y-1 overflow-auto pl-5 text-xs text-rose-200/95">
            {data.lastCycleErrors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-emerald-200/90">Nessun errore registrato nell’ultimo ciclo registrato.</p>
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
              Esecuzione…
            </>
          ) : (
            'Forza riesecuzione cleanup ora'
          )}
        </button>
        {forceError ? <span className="text-xs text-rose-300">{forceError}</span> : null}
      </div>

      <p className="rounded-xl border border-app-line-25 bg-white/[0.03] px-4 py-3 text-xs leading-relaxed text-app-fg-muted">
        Per la posta in arrivo e la coda «Documenti da elaborare» usa la sincronizzazione email dalle sedi o dalla scheda
        fornitore. Per un controllo completo su un fornitore usa <strong className="text-app-fg">Analisi completa</strong>{' '}
        nella scheda fornitore.
      </p>
    </div>
  )
}

export default function CentroOperazioniPage() {
  const { t } = useLocale()
  const s = t.strumentiCentroOperazioni
  const d = t.dashboard
  const { me } = useMe()
  const { activeOperator } = useActiveOperator()
  const { effectiveSedeId } = useManualDeliverySede()

  const masterPlane = effectiveIsMasterAdminPlane(me, activeOperator)
  const isAdminSede = effectiveIsAdminSedeUi(me, activeOperator)
  const canView = !!(masterPlane || isAdminSede)

  const [data, setData] = useState<DashboardPayload | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [forceLoading, setForceLoading] = useState(false)
  const [forceError, setForceError] = useState<string | null>(null)
  const [emailSyncLoading, setEmailSyncLoading] = useState(false)
  const [emailSyncError, setEmailSyncError] = useState<string | null>(null)
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
      setLoadError(e instanceof Error ? e.message : 'Errore di rete')
    }
  }, [])

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
      setForceError(e instanceof Error ? e.message : 'Errore di rete')
    } finally {
      setForceLoading(false)
    }
  }, [load])

  const onForceEmailSync = useCallback(async () => {
    setEmailSyncLoading(true)
    setEmailSyncError(null)
    try {
      const res = await fetch('/api/scan-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'manual',
          ...(effectiveSedeId ? { user_sede_id: effectiveSedeId } : {}),
        }),
      })
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setEmailSyncError(j.error ?? `HTTP ${res.status}`)
        return
      }
    } catch (e) {
      setEmailSyncError(e instanceof Error ? e.message : 'Errore di rete')
    } finally {
      setEmailSyncLoading(false)
    }
  }, [effectiveSedeId])

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
          setHistoricSyncError('Risposta sync storica non valida')
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
      setHistoricSyncError(e instanceof Error ? e.message : 'Errore di rete')
    } finally {
      setHistoricSyncLoading(false)
    }
  }, [effectiveSedeId, s.historicSyncCompleted, s.historicSyncProgress, s.historicSyncResult])

  if (!canView) {
    return (
      <div className={`${APP_SHELL_SECTION_PAGE_CLASS} px-6 py-10`}>
        <p className="text-sm text-app-fg-muted">Accesso riservato agli amministratori.</p>
        <Link href="/" className="mt-4 inline-block text-sm text-cyan-300 underline">
          Torna al dashboard
        </Link>
      </div>
    )
  }

  return (
    <div className={`${APP_SHELL_SECTION_PAGE_STACK_CLASS} pb-10`}>
      <div className="mx-auto min-w-0 w-full max-w-[var(--app-layout-max-width)]">
        <AppPageHeaderStrip
          accent="teal"
          leadingAccessory={<BackButton href="/" label={t.nav.dashboard} iconOnly className="mb-0 shrink-0" />}
        >
          <AppPageHeaderTitleWithDashboardShortcut>
            <nav className="text-[10px] leading-tight text-app-fg-muted" aria-label="Breadcrumb">
              <Link
                href="/strumenti"
                className="text-app-fg-muted underline-offset-4 hover:text-cyan-200 hover:underline"
              >
                {s.breadcrumbTools}
              </Link>
              <span className="mx-2 text-app-fg-subtle">&rsaquo;</span>
              <span>{s.pageTitle}</span>
            </nav>
            <h1 className={APP_PAGE_HEADER_STRIP_H1_CLASS}>{s.pageTitle}</h1>
            <p className={`max-w-3xl ${APP_PAGE_HEADER_STRIP_SUBTITLE_CLASS}`}>{s.pageSubtitle}</p>
          </AppPageHeaderTitleWithDashboardShortcut>
        </AppPageHeaderStrip>
        <div className="mt-6 space-y-10">
          <div className="grid min-w-0 w-full grid-cols-1 gap-y-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-x-8 lg:gap-y-10 xl:gap-x-10">
            <div className="flex min-h-0 min-w-0 flex-col gap-y-10">
              <section className="flex min-h-0 min-w-0 flex-col gap-6" aria-labelledby="ops-section-sync">
                <OpsSectionTitle id="ops-section-sync">{s.sectionSyncEmail}</OpsSectionTitle>
                <div className="flex min-h-0 min-w-0 flex-col gap-4">
                  <div className="app-card overflow-hidden p-5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">{s.manualImapSyncTitle}</p>
                    <p className="mt-2 text-sm text-app-fg-muted">{s.manualImapSyncDesc}</p>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        disabled={emailSyncLoading}
                        onClick={onForceEmailSync}
                        className="inline-flex touch-manipulation items-center justify-center gap-2 rounded-lg border border-cyan-500/45 bg-cyan-500/12 px-4 py-2.5 text-xs font-bold text-cyan-100 transition-colors hover:bg-cyan-500/18 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {emailSyncLoading ? (
                          <>
                            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-cyan-100 border-t-transparent" />
                            {t.common.loading}
                          </>
                        ) : (
                          d.emailSyncForceSync
                        )}
                      </button>
                      {emailSyncError ? <span className="text-xs text-rose-300">{emailSyncError}</span> : null}
                    </div>
                  </div>

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

              <section className="flex min-h-0 min-w-0 flex-col gap-6" aria-labelledby="ops-section-documenti">
                <OpsSectionTitle id="ops-section-documenti">{s.sectionDocumenti}</OpsSectionTitle>
                <div className="flex min-h-0 min-w-0 flex-col gap-4">
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

                  <article className="app-card min-h-0 min-w-0 overflow-hidden p-5">
                    <p className="text-sm leading-relaxed text-app-fg-muted">{s.documentiAnalyCardDesc}</p>
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-4">
                      <Link
                        href="/inbox-ai"
                        className="text-sm font-semibold text-cyan-300 underline decoration-cyan-500/35 underline-offset-4 hover:text-cyan-200"
                      >
                        {s.documentiAnalyInboxLink} →
                      </Link>
                      <Link
                        href="/fornitori"
                        className="text-sm font-semibold text-cyan-300 underline decoration-cyan-500/35 underline-offset-4 hover:text-cyan-200"
                      >
                        {s.documentiAnalyFornitoreLink} →
                      </Link>
                    </div>
                  </article>
                </div>
              </section>
            </div>

            <div className="flex min-h-0 min-w-0 flex-col gap-y-10">
              <section className="flex min-h-0 min-w-0 flex-col gap-6" aria-labelledby="ops-section-ocr">
                <OpsSectionTitle id="ops-section-ocr">{s.sectionOcrQualita}</OpsSectionTitle>

                <div className="flex min-h-0 min-w-0 flex-col gap-4">
                  <FixOcrDatesCard anchorId="ops-fix-ocr-dates" />

                  <article className="app-card min-h-0 min-w-0 overflow-hidden p-5">
                    <p className="text-sm text-app-fg-muted">{s.ocrAbbinamentiCardDesc}</p>
                    <Link
                      href="/inbox-ai?tab=audit"
                      className="mt-4 inline-flex text-sm font-semibold text-cyan-300 underline decoration-cyan-500/35 underline-offset-4 hover:text-cyan-200"
                    >
                      {s.ocrAbbinamentiCta} →
                    </Link>
                  </article>
                </div>

                <aside
                  role="note"
                  className="min-w-0 rounded-xl border border-app-line-25 bg-white/[0.03] px-4 py-3"
                >
                  <p className="m-0 text-xs leading-relaxed text-pretty text-app-fg-muted">
                    {s.hintContextualShortcuts}
                  </p>
                </aside>
              </section>

              <section className="flex min-h-0 min-w-0 flex-col gap-6" aria-labelledby="ops-section-manutenzione">
                <OpsSectionTitle id="ops-section-manutenzione">{s.sectionManutenzione}</OpsSectionTitle>
                <div className="flex min-h-0 min-w-0 flex-col gap-4">
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
                  />
                </div>
              </section>

            </div>

          </div>

          <DuplicateManager open={dupOpen} onOpenChange={setDupOpen} />
        </div>
      </div>
    </div>
  )
}
