'use client'

import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useLocale } from '@/lib/locale-context'
import { useMe } from '@/lib/me-context'
import { useActiveOperator } from '@/lib/active-operator-context'
import { canAccessCentroOperazioniPage } from '@/lib/effective-operator-ui'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import { AppPageHeaderTitleWithDashboardShortcut } from '@/components/AppPageHeaderDashboardShortcut'
import { BackButton } from '@/components/BackButton'
import { OpenDocumentInAppButton } from '@/components/OpenDocumentInAppButton'
import { formatDate, formatDateTime } from '@/lib/locale'
import type { Translations } from '@/lib/translations'
import {
  APP_PAGE_HEADER_STRIP_H1_CLASS,
  APP_PAGE_HEADER_STRIP_SUBTITLE_CLASS,
  APP_SHELL_SECTION_PAGE_STACK_CLASS,
} from '@/lib/app-shell-layout'

function buildStatoConfig(t: Translations): Record<string, { label: string; color: string; desc: string }> {
  const v = t.strumentiVerificaDocumenti
  return {
    da_processare: { label: v.statoDaProcessare, color: 'text-amber-300', desc: v.statoDaProcessareDesc },
    da_associare: { label: v.statoDaAssociare, color: 'text-orange-300', desc: v.statoDaAssociareDesc },
    bozza_creata: { label: v.statoBozzaCreata, color: 'text-cyan-300', desc: v.statoBozzaCreataDesc },
    associato: { label: v.statoAssociato, color: 'text-emerald-300', desc: v.statoAssociatoDesc },
    scartato: { label: v.statoScartato, color: 'text-gray-400', desc: v.statoScartatoDesc },
    da_revisionare: { label: v.statoDaRevisionare, color: 'text-rose-300', desc: v.statoDaRevisionareDesc },
  }
}

type AuditData = {
  riepilogo: {
    totale: number
    per_stato: { stato: string; count: number }[]
  }
  documenti_bloccati: {
    id: string
    stato: string
    created_at: string | null
    giorni_in_stato: number
    mittente: string | null
    file_name: string | null
    file_url: string | null
    pending_kind: string | null
  }[]
  documenti_da_revisionare: {
    id: string
    stato: string
    created_at: string | null
    giorni_in_stato: number
    mittente: string | null
    file_name: string | null
    file_url: string | null
    pending_kind: string | null
  }[]
  statement_con_problemi: {
    id: string
    fornitore_id: string | null
    fornitore_nome: string | null
    file_url: string | null
    missing_rows: number | null
    created_at: string | null
  }[]
  errori_sincronizzazione_recenti: {
    id: string
    data: string | null
    stato: string
    sede_id: string | null
    message?: string | null
  }[]
  statistiche: {
    tasso_completamento: number
    totale_bloccati: number
    totale_da_revisionare: number
    totale_statement_issues: number
    totale_errori_sincro: number
  }
}

function StatCard({ label, value, color, note }: { label: string; value: string | number; color: string; note?: string }) {
  return (
    <div className="app-card overflow-hidden p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${color}`}>{value}</p>
      {note ? <p className="mt-0.5 text-xs text-app-fg-muted">{note}</p> : null}
    </div>
  )
}

function CollapsibleSection({
  title,
  count,
  countColor,
  defaultOpen,
  action,
  children,
}: {
  title: string
  count: number
  countColor: string
  defaultOpen?: boolean
  action?: ReactNode
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  return (
    <div className="app-card overflow-hidden">
      <div className="flex items-center justify-between gap-2 p-4">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center gap-3 text-left transition-colors hover:opacity-80"
        >
          <div className="flex items-center gap-3">
            <span className={`text-sm font-semibold ${countColor}`}>{title}</span>
            <span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-bold ${countColor} bg-white/[0.06]`}>
              {count}
            </span>
          </div>
          <span className={`text-app-fg-muted transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
        </button>
        {action}
      </div>
      {open ? <div className="border-t border-app-line-10 p-4">{children}</div> : null}
    </div>
  )
}

function StatoBadge({ stato, statoConfig }: { stato: string; statoConfig: Record<string, { label: string; color: string; desc: string }> }) {
  const cfg = statoConfig[stato] ?? { label: stato, color: 'text-gray-400', desc: '' }
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${cfg.color} bg-white/[0.06]`}>
      {cfg.label}
    </span>
  )
}

export default function VerificaDocumentiPage() {
  const { t, locale } = useLocale()
  const v = t.strumentiVerificaDocumenti
  const STATO_CONFIG = useMemo(() => buildStatoConfig(t), [t])
  const { me, loading: meLoading } = useMe()
  const { activeOperator } = useActiveOperator()
  const canView = canAccessCentroOperazioniPage(me, activeOperator)

  const [data, setData] = useState<AuditData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const [logActionLoading, setLogActionLoading] = useState<Set<string>>(new Set())
  const [bulkLogLoading, setBulkLogLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/document-processing-audit', { cache: 'no-store' })
      const j = (await res.json().catch(() => ({}))) as AuditData & { error?: string }
      if (!res.ok) {
        setError(j.error ?? `HTTP ${res.status}`)
        return
      }
      setData(j)
    } catch (e) {
      setError(e instanceof Error ? e.message : t.common.networkError)
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    if (canView) void load()
  }, [canView, load])

  const handleScarta = useCallback(async (id: string) => {
    setActionLoading(prev => new Set(prev).add(id))
    try {
      const res = await fetch('/api/documenti-da-processare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, azione: 'scarta' }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? `HTTP ${res.status}`)
      }
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : t.common.error)
    } finally {
      setActionLoading(prev => { const next = new Set(prev); next.delete(id); return next })
    }
  }, [load, t])

  const handleRiprocessa = useCallback(async (id: string) => {
    setActionLoading(prev => new Set(prev).add(id))
    try {
      const res = await fetch('/api/admin/reprocess-log-documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doc_ids: [id] }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? `HTTP ${res.status}`)
      }
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : t.common.error)
    } finally {
      setActionLoading(prev => { const next = new Set(prev); next.delete(id); return next })
    }
  }, [load, t])

  const handleRiprocessaTutti = useCallback(async () => {
    if (!data?.documenti_bloccati.length) return
    setBulkLoading(true)
    try {
      const ids = data.documenti_bloccati.map(d => d.id)
      const res = await fetch('/api/admin/reprocess-log-documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doc_ids: ids }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? `HTTP ${res.status}`)
      }
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : t.common.error)
    } finally {
      setBulkLoading(false)
    }
  }, [load, data?.documenti_bloccati, t])

  const handleRetryLog = useCallback(async (id: string) => {
    setLogActionLoading(prev => new Set(prev).add(id))
    try {
      const res = await fetch(`/api/retry-log/${id}`, { method: 'POST' })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? `HTTP ${res.status}`)
      }
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : t.common.error)
    } finally {
      setLogActionLoading(prev => { const next = new Set(prev); next.delete(id); return next })
    }
  }, [load, t])

  const handleRiprocessaTuttiLog = useCallback(async () => {
    if (!data?.errori_sincronizzazione_recenti.length) return
    setBulkLogLoading(true)
    try {
      const results = await Promise.allSettled(
        data.errori_sincronizzazione_recenti.map(err =>
          fetch(`/api/retry-log/${err.id}`, { method: 'POST' })
        )
      )
      const failed = results.filter(r => r.status === 'rejected').length
      if (failed > 0) alert(v.bulkRetryFailed.replace('{n}', String(failed)))
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : t.common.error)
    } finally {
      setBulkLogLoading(false)
    }
  }, [load, data?.errori_sincronizzazione_recenti, t, v])

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
        <div className="app-shell-page-padding mx-auto min-w-0 w-full max-w-[var(--app-layout-max-width)]">
          <AppPageHeaderStrip
            accent="teal"
            leadingAccessory={<BackButton href="/" label={t.nav.dashboard} iconOnly className="mb-0 shrink-0" />}
          >
            <AppPageHeaderTitleWithDashboardShortcut>
              <h1 className={APP_PAGE_HEADER_STRIP_H1_CLASS}>{v.pageTitle}</h1>
              <p className={`${APP_PAGE_HEADER_STRIP_SUBTITLE_CLASS} !max-w-none`}>{v.accessDeniedTitle}</p>
            </AppPageHeaderTitleWithDashboardShortcut>
          </AppPageHeaderStrip>
          <div className="mt-6 app-card overflow-hidden p-6">
            <p className="m-0 text-sm leading-relaxed text-app-fg-muted">
              {v.accessDenied}
            </p>
          </div>
        </div>
      </div>
    )
  }

  const s = data?.statistiche
  const r = data?.riepilogo

  return (
    <div className={`${APP_SHELL_SECTION_PAGE_STACK_CLASS} pb-10`}>
      <div className="app-shell-page-padding mx-auto min-w-0 w-full max-w-[var(--app-layout-max-width)]">
        <AppPageHeaderStrip
          accent="teal"
          leadingAccessory={<BackButton href="/" label={t.nav.dashboard} iconOnly className="mb-0 shrink-0" />}
        >
          <AppPageHeaderTitleWithDashboardShortcut>
            <h1 className={APP_PAGE_HEADER_STRIP_H1_CLASS}>{v.pageTitle}</h1>
            <p className={`${APP_PAGE_HEADER_STRIP_SUBTITLE_CLASS} !max-w-none`}>
              {v.subtitle}
            </p>
          </AppPageHeaderTitleWithDashboardShortcut>
        </AppPageHeaderStrip>

        <div className="mt-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-app-fg-muted">{t.common.loading}</p>
            </div>
          ) : error ? (
            <div className="app-card overflow-hidden p-6">
              <p className="text-sm text-rose-300">{error}</p>
              <button
                type="button"
                onClick={load}
                className="mt-4 inline-flex items-center justify-center rounded-lg border border-cyan-500/45 bg-cyan-500/12 px-4 py-2 text-xs font-bold text-cyan-100 transition-colors hover:bg-cyan-500/18"
              >
                {v.retry}
              </button>
            </div>
          ) : data ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <StatCard label={v.statTotalDocs} value={r?.totale ?? 0} color="text-white" />
                <StatCard
                  label={v.statCompleted}
                  value={`${s?.tasso_completamento ?? 0}%`}
                  color={s && s.tasso_completamento >= 80 ? 'text-emerald-300' : 'text-amber-300'}
                  note={v.statCompletedNote
                    .replace('{associated}', String(r?.per_stato.find((x) => x.stato === 'associato')?.count ?? 0))
                    .replace('{discarded}', String(r?.per_stato.find((x) => x.stato === 'scartato')?.count ?? 0))}
                />
                <StatCard
                  label={v.statBlocked}
                  value={s?.totale_bloccati ?? 0}
                  color={s && s.totale_bloccati > 0 ? 'text-rose-300' : 'text-emerald-300'}
                  note={v.statBlockedNote}
                />
                <StatCard
                  label={v.statToReview}
                  value={s?.totale_da_revisionare ?? 0}
                  color={s && s.totale_da_revisionare > 0 ? 'text-rose-300' : 'text-emerald-300'}
                />
                <StatCard
                  label={v.statStatementIssues}
                  value={s?.totale_statement_issues ?? 0}
                  color={s && s.totale_statement_issues > 0 ? 'text-amber-300' : 'text-emerald-300'}
                  note={v.statStatementIssuesNote}
                />
                <StatCard
                  label={v.statSyncErrors}
                  value={s?.totale_errori_sincro ?? 0}
                  color={s && s.totale_errori_sincro > 0 ? 'text-rose-300' : 'text-emerald-300'}
                />
              </div>

              <div className="app-card overflow-hidden">
                <div className="border-b border-app-line-10 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">
                    {v.sectionStatusTitle}
                  </p>
                </div>
                <div className="divide-y divide-app-line-10">
                  {r?.per_stato.map((item) => {
                    const cfg = STATO_CONFIG[item.stato] ?? { label: item.stato, color: 'text-gray-400', desc: '' }
                    const pct = r.totale > 0 ? ((item.count / r.totale) * 100).toFixed(1) : '0.0'
                    return (
                      <div key={item.stato} className="flex items-center gap-4 px-4 py-3">
                        <StatoBadge stato={item.stato} statoConfig={STATO_CONFIG} />
                        <div className="flex-1">
                          <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                            <div
                              className={`h-full rounded-full transition-all ${cfg.color.replace('text-', 'bg-')}`}
                              style={{
                                width: `${pct}%`,
                                opacity: 0.6,
                              }}
                            />
                          </div>
                        </div>
                        <span className="w-16 text-right text-sm font-semibold tabular-nums text-app-fg">
                          {item.count}
                        </span>
                        <span className="w-12 text-right text-xs text-app-fg-muted">{pct}%</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              <CollapsibleSection
                title={v.sectionBlockedTitle}
                count={s?.totale_bloccati ?? 0}
                countColor={s && s.totale_bloccati > 0 ? 'text-rose-300' : 'text-emerald-300'}
                action={data.documenti_bloccati.length > 0 ? (
                  <button
                    type="button"
                    disabled={bulkLoading}
                    onClick={handleRiprocessaTutti}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-bold text-cyan-200 transition-colors hover:bg-cyan-500/18 disabled:opacity-40"
                  >
                    {bulkLoading ? (
                      <span className="inline-block h-3 w-3 animate-spin rounded-full border border-cyan-300 border-t-transparent" />
                    ) : (
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    )}
                    {v.bulkRetry}
                  </button>
                ) : undefined}
              >
                {data.documenti_bloccati.length === 0 ? (
                  <p className="text-sm text-emerald-200/90">{v.noBlockedHint}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-app-fg-muted">
                          <th className="pb-2 pr-3 font-semibold">{v.colStato}</th>
                          <th className="pb-2 pr-3 font-semibold">{v.colMittente}</th>
                          <th className="pb-2 pr-3 font-semibold">{v.colFile}</th>
                          <th className="pb-2 pr-3 font-semibold">{v.colPendingKind}</th>
                          <th className="pb-2 pr-3 font-semibold">{v.colDays}</th>
                          <th className="pb-2 pr-3 font-semibold">{v.colCreatedAt}</th>
                          <th className="pb-2 pr-3 font-semibold">{v.colActions}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-app-line-10">
                        {data.documenti_bloccati.map((doc) => (
                          <tr key={doc.id} className="text-app-fg hover:bg-white/[0.02]">
                            <td className="py-2 pr-3"><StatoBadge stato={doc.stato} statoConfig={STATO_CONFIG} /></td>
                            <td className="py-2 pr-3">{doc.mittente ?? '—'}</td>
                            <td className="py-2 pr-3 max-w-[200px] truncate" title={doc.file_name ?? ''}>
                              {doc.file_name ? (
                                doc.file_url ? (
                                  <OpenDocumentInAppButton
                                    documentoId={doc.id}
                                    fileUrl={doc.file_url}
                                    title={doc.file_name ?? undefined}
                                    className="text-cyan-300 underline decoration-cyan-500/35 underline-offset-2 hover:text-cyan-200"
                                  >
                                    {doc.file_name}
                                  </OpenDocumentInAppButton>
                                ) : (
                                  doc.file_name
                                )
                              ) : '—'}
                            </td>
                            <td className="py-2 pr-3">
                              <span className="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px]">
                                {doc.pending_kind ?? '—'}
                              </span>
                            </td>
                            <td className="py-2 pr-3 font-semibold tabular-nums text-rose-200">{doc.giorni_in_stato}{v.daysSuffix}</td>
                            <td className="py-2 pr-3 text-app-fg-muted">
                              {doc.created_at ? formatDate(doc.created_at, locale) : '—'}
                            </td>
                            <td className="py-2 pr-3">
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={actionLoading.has(doc.id)}
                                  onClick={() => handleRiprocessa(doc.id)}
                                  className="inline-flex items-center gap-1 rounded-md border border-cyan-500/30 bg-cyan-500/8 px-2 py-1 text-[10px] font-bold text-cyan-200 transition-colors hover:bg-cyan-500/15 disabled:opacity-40"
                                >
                                  {actionLoading.has(doc.id) ? (
                                    <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border border-cyan-300 border-t-transparent" />
                                  ) : (
                                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                  )}
                                  {v.actionRetry}
                                </button>
                                <button
                                  type="button"
                                  disabled={actionLoading.has(doc.id)}
                                  onClick={() => handleScarta(doc.id)}
                                  className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/8 px-2 py-1 text-[10px] font-bold text-rose-200 transition-colors hover:bg-rose-500/15 disabled:opacity-40"
                                >
                                  {v.actionDiscard}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CollapsibleSection>

              <CollapsibleSection
                title={v.sectionToReviewTitle}
                count={s?.totale_da_revisionare ?? 0}
                countColor={s && s.totale_da_revisionare > 0 ? 'text-rose-300' : 'text-emerald-300'}
              >
                {data.documenti_da_revisionare.length === 0 ? (
                  <p className="text-sm text-emerald-200/90">{v.noToReviewHint}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-app-fg-muted">
                          <th className="pb-2 pr-3 font-semibold">{v.colMittente}</th>
                          <th className="pb-2 pr-3 font-semibold">{v.colFile}</th>
                          <th className="pb-2 pr-3 font-semibold">{v.colPendingKind}</th>
                          <th className="pb-2 pr-3 font-semibold">{v.colDaysInState}</th>
                          <th className="pb-2 pr-3 font-semibold">{v.colCreatedAt}</th>
                          <th className="pb-2 pr-3 font-semibold">{v.colAction}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-app-line-10">
                        {data.documenti_da_revisionare.map((doc) => (
                          <tr key={doc.id} className="text-app-fg hover:bg-white/[0.02]">
                            <td className="py-2 pr-3">{doc.mittente ?? '—'}</td>
                            <td className="py-2 pr-3 max-w-[200px] truncate" title={doc.file_name ?? ''}>
                              {doc.file_name ? (
                                doc.file_url ? (
                                  <OpenDocumentInAppButton
                                    documentoId={doc.id}
                                    fileUrl={doc.file_url}
                                    title={doc.file_name ?? undefined}
                                    className="text-cyan-300 underline decoration-cyan-500/35 underline-offset-2 hover:text-cyan-200"
                                  >
                                    {doc.file_name}
                                  </OpenDocumentInAppButton>
                                ) : (
                                  doc.file_name
                                )
                              ) : '—'}
                            </td>
                            <td className="py-2 pr-3">
                              <span className="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px]">
                                {doc.pending_kind ?? '—'}
                              </span>
                            </td>
                            <td className="py-2 pr-3 font-semibold tabular-nums text-rose-200">{doc.giorni_in_stato}{v.daysSuffix}</td>
                            <td className="py-2 pr-3 text-app-fg-muted">
                              {doc.created_at ? formatDate(doc.created_at, locale) : '—'}
                            </td>
                            <td className="py-2 pr-3">
                              <Link
                                href="/inbox-ai"
                                className="inline-flex items-center gap-1 rounded-md border border-indigo-500/30 bg-indigo-500/8 px-2 py-1 text-[10px] font-bold text-indigo-200 transition-colors hover:bg-indigo-500/15"
                              >
                                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                </svg>
                                {v.actionReview}
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CollapsibleSection>

              <CollapsibleSection
                title={v.sectionStatementsTitle}
                count={s?.totale_statement_issues ?? 0}
                countColor={s && s.totale_statement_issues > 0 ? 'text-amber-300' : 'text-emerald-300'}
              >
                {data.statement_con_problemi.length === 0 ? (
                  <p className="text-sm text-emerald-200/90">{v.noStatementHint}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-app-fg-muted">
                          <th className="pb-2 pr-3 font-semibold">{v.colSupplier}</th>
                          <th className="pb-2 pr-3 font-semibold">{v.colFile}</th>
                          <th className="pb-2 pr-3 font-semibold">{v.colMissingRows}</th>
                          <th className="pb-2 pr-3 font-semibold">{v.colCreatedAt}</th>
                          <th className="pb-2 pr-3 font-semibold">{v.colActions}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-app-line-10">
                        {data.statement_con_problemi.map((stmt) => (
                          <tr key={stmt.id} className="text-app-fg hover:bg-white/[0.02]">
                            <td className="py-2 pr-3 font-medium text-app-fg">{stmt.fornitore_nome ?? stmt.fornitore_id ?? '—'}</td>
                            <td className="py-2 pr-3 max-w-[200px] truncate" title={stmt.file_url ?? ''}>
                              {stmt.file_url ? (
                                <OpenDocumentInAppButton
                                  statementId={stmt.id}
                                  fileUrl={stmt.file_url}
                                  className="text-cyan-300 underline decoration-cyan-500/35 underline-offset-2 hover:text-cyan-200"
                                >
                                  {stmt.file_url.split('/').pop() ?? stmt.file_url}
                                </OpenDocumentInAppButton>
                              ) : '—'}
                            </td>
                            <td className="py-2 pr-3 font-semibold tabular-nums text-amber-200">{stmt.missing_rows}</td>
                            <td className="py-2 pr-3 text-app-fg-muted">
                              {stmt.created_at ? formatDate(stmt.created_at, locale) : '—'}
                            </td>
                            <td className="py-2 pr-3">
                              <button
                                type="button"
                                disabled={actionLoading.has(stmt.id)}
                                onClick={() => handleRiprocessa(stmt.id)}
                                className="inline-flex items-center gap-1 rounded-md border border-cyan-500/30 bg-cyan-500/8 px-2 py-1 text-[10px] font-bold text-cyan-200 transition-colors hover:bg-cyan-500/15 disabled:opacity-40"
                              >
                                {actionLoading.has(stmt.id) ? (
                                  <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border border-cyan-300 border-t-transparent" />
                                ) : (
                                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                )}
                                {v.actionRetry}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CollapsibleSection>

              <CollapsibleSection
                title={v.sectionSyncErrorsTitle}
                count={s?.totale_errori_sincro ?? 0}
                countColor={s && s.totale_errori_sincro > 0 ? 'text-rose-300' : 'text-emerald-300'}
                action={data.errori_sincronizzazione_recenti.length > 0 ? (
                  <button
                    type="button"
                    disabled={bulkLogLoading}
                    onClick={handleRiprocessaTuttiLog}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-bold text-cyan-200 transition-colors hover:bg-cyan-500/18 disabled:opacity-40"
                  >
                    {bulkLogLoading ? (
                      <span className="inline-block h-3 w-3 animate-spin rounded-full border border-cyan-300 border-t-transparent" />
                    ) : (
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    )}
                    {v.bulkRetry}
                  </button>
                ) : undefined}
              >
                {data.errori_sincronizzazione_recenti.length === 0 ? (
                  <p className="text-sm text-emerald-200/90">{v.noSyncErrorsHint}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-app-fg-muted">
                          <th className="pb-2 pr-3 font-semibold">{v.colStato}</th>
                          <th className="pb-2 pr-3 font-semibold">{v.colSede}</th>
                          <th className="pb-2 pr-3 font-semibold">{v.colMessage}</th>
                          <th className="pb-2 pr-3 font-semibold">{v.colDate}</th>
                          <th className="pb-2 pr-3 font-semibold">{v.colActions}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-app-line-10">
                        {data.errori_sincronizzazione_recenti.map((err) => (
                          <tr key={err.id} className="text-app-fg hover:bg-white/[0.02]">
                            <td className="py-2 pr-3">
                              <span className="rounded bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                                {err.stato}
                              </span>
                            </td>
                            <td className="py-2 pr-3 font-mono text-[10px] text-app-fg-muted">{err.sede_id ?? '—'}</td>
                            <td className="py-2 pr-3 max-w-[300px] truncate text-app-fg-muted" title={err.message ?? ''}>
                              {err.message ?? '—'}
                            </td>
                            <td className="py-2 pr-3 text-app-fg-muted">
                              {err.data ? formatDateTime(err.data, locale) : '—'}
                            </td>
                            <td className="py-2 pr-3">
                              <button
                                type="button"
                                disabled={logActionLoading.has(err.id)}
                                onClick={() => handleRetryLog(err.id)}
                                className="inline-flex items-center gap-1 rounded-md border border-cyan-500/30 bg-cyan-500/8 px-2 py-1 text-[10px] font-bold text-cyan-200 transition-colors hover:bg-cyan-500/15 disabled:opacity-40"
                              >
                                {logActionLoading.has(err.id) ? (
                                  <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border border-cyan-300 border-t-transparent" />
                                ) : (
                                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                )}
                                {v.actionRetry}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CollapsibleSection>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
