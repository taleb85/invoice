'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
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
      <div className="mx-auto w-full max-w-2xl">
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
              <span className="mx-2 text-app-fg-muted/40">&rsaquo;</span>
              <span>{s.pageTitle}</span>
            </nav>
            <h1 className={APP_PAGE_HEADER_STRIP_H1_CLASS}>{s.pageTitle}</h1>
            <p className={`max-w-xl ${APP_PAGE_HEADER_STRIP_SUBTITLE_CLASS}`}>{s.pageSubtitle}</p>
          </AppPageHeaderTitleWithDashboardShortcut>
        </AppPageHeaderStrip>
        <div className="mt-6 space-y-8">
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
          <CentroOperazioniDashboard
            data={data}
            loadError={loadError}
            forceLoading={forceLoading}
            forceError={forceError}
            onForce={onForce}
          />
        </div>
      </div>
    </div>
  )
}
