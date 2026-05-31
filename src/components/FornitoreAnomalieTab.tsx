'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { SupplierAnomalieApiResponse, SupplierAnomalieApiRow } from '@/app/api/fornitori/[id]/anomalie/route'
import { useT } from '@/lib/use-t'
import { SUPPLIER_DETAIL_TAB_HIGHLIGHT } from '@/lib/supplier-detail-tab-theme'
import { APP_SECTION_DIVIDE_ROWS, APP_SECTION_MOBILE_LIST } from '@/lib/app-shell-layout'
import { AppSectionEmptyState } from '@/components/AppSectionEmptyState'
import { createClient } from '@/utils/supabase/client'
import { fornitoreBollaDeepLink, fornitoreFatturaDeepLink, fornitoreDocumentiQueueHref } from '@/lib/fornitore-supplier-url'
import type { ReadonlyURLSearchParams } from 'next/navigation'

type TabTarget = 'listino' | 'verifica' | 'fatture' | 'bolle' | 'documenti'

const KIND_TAB: Record<SupplierAnomalieApiRow['kind'], TabTarget> = {
  prezzo_listino: 'listino',
  fattura_duplicata: 'fatture',
  bolla_duplicata: 'bolle',
  estratto_conto: 'verifica',
  bolla_aperta: 'bolle',
  documento_coda: 'documenti',
}

function severityClass(s: SupplierAnomalieApiRow['severity']) {
  if (s === 'high') return 'border-rose-500/35 bg-rose-500/10 text-rose-100'
  if (s === 'medium') return 'border-amber-500/35 bg-amber-500/10 text-amber-100'
  return 'border-app-line-30 bg-app-line-10 text-app-fg-muted'
}

export default function FornitoreAnomalieTab({
  fornitoreId,
  dateFrom,
  dateToExclusive,
  pathname,
  searchParams,
  onNavigateTab,
  epoch = 0,
}: {
  fornitoreId: string
  dateFrom: string
  dateToExclusive: string
  pathname: string
  searchParams: ReadonlyURLSearchParams
  onNavigateTab: (tab: TabTarget) => void
  epoch?: number
}) {
  const t = useT()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<SupplierAnomalieApiResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [resolvingId, setResolvingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const q = new URLSearchParams({
        fornitore_id: fornitoreId,
        from: dateFrom,
        to: dateToExclusive,
      })
      const res = await fetch(`/api/fornitori/${encodeURIComponent(fornitoreId)}/anomalie?${q}`, {
        cache: 'no-store',
        credentials: 'include',
      })
      const j = (await res.json().catch(() => ({}))) as SupplierAnomalieApiResponse & { error?: string }
      if (!res.ok) {
        setError(j.error ?? `HTTP ${res.status}`)
        setData(null)
        return
      }
      setData(j)
    } catch {
      setError(t.ui.networkError)
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateToExclusive, fornitoreId, t.ui.networkError])

  useEffect(() => {
    void load()
  }, [load, epoch])

  const grouped = useMemo(() => {
    if (!data?.rows.length) return []
    const order: SupplierAnomalieApiRow['kind'][] = [
      'prezzo_listino',
      'fattura_duplicata',
      'bolla_duplicata',
      'estratto_conto',
      'documento_coda',
      'bolla_aperta',
    ]
    const map = new Map<SupplierAnomalieApiRow['kind'], SupplierAnomalieApiRow[]>()
    for (const row of data.rows) {
      const arr = map.get(row.kind) ?? []
      arr.push(row)
      map.set(row.kind, arr)
    }
    return order
      .filter((k) => (map.get(k)?.length ?? 0) > 0)
      .map((k) => ({ kind: k, rows: map.get(k)! }))
  }, [data])

  const resolvePriceAnomaly = async (anomalyId: string) => {
    const rawId = anomalyId.replace(/^pl-/, '')
    setResolvingId(anomalyId)
    const supabase = createClient()
    await supabase
      .from('price_anomalies')
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq('id', rawId)
    setResolvingId(null)
    void load()
  }

  const sectionTitle = (kind: SupplierAnomalieApiRow['kind']) => {
    switch (kind) {
      case 'prezzo_listino':
        return t.fornitori.anomalieSectionPrezzo
      case 'fattura_duplicata':
        return t.fornitori.anomalieSectionFattureDup
      case 'bolla_duplicata':
        return t.fornitori.anomalieSectionBolleDup
      case 'estratto_conto':
        return t.fornitori.anomalieSectionEstratti
      case 'bolla_aperta':
        return t.fornitori.anomalieSectionBolleAperte
      case 'documento_coda':
        return t.fornitori.anomalieSectionDocumenti
    }
  }

  const openRow = (row: SupplierAnomalieApiRow) => {
    if (row.meta?.fatturaId) {
      router.push(fornitoreFatturaDeepLink(pathname, searchParams, row.meta.fatturaId), { scroll: false })
      return
    }
    if (row.meta?.bollaId) {
      router.push(fornitoreBollaDeepLink(pathname, searchParams, row.meta.bollaId), { scroll: false })
      return
    }
    onNavigateTab(KIND_TAB[row.kind])
  }

  const hi = SUPPLIER_DETAIL_TAB_HIGHLIGHT.anomalie

  if (loading) {
    return (
      <div className="supplier-detail-tab-shell overflow-hidden">
        <div className={`app-card-bar-accent ${hi.bar}`} aria-hidden />
        <div className={APP_SECTION_DIVIDE_ROWS}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex animate-pulse gap-4 px-5 py-3.5">
              <div className="h-4 w-40 rounded app-workspace-inset-bg" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="supplier-detail-tab-shell overflow-hidden">
        <div className={`app-card-bar-accent ${hi.bar}`} aria-hidden />
        <AppSectionEmptyState message={error} />
      </div>
    )
  }

  if (!data || data.summary.total === 0) {
    return (
      <div className="supplier-detail-tab-shell overflow-hidden">
        <div className={`app-card-bar-accent ${hi.bar}`} aria-hidden />
        <AppSectionEmptyState
          message={t.fornitori.anomalieTabEmpty}
          subtitle={t.fornitori.anomalieTabEmptyHint}
        />
      </div>
    )
  }

  const summaryChips = [
    { label: t.fornitori.anomalieChipPrezzo, n: data.summary.prezzoListino + (data.summary.rekki > 0 ? 1 : 0) },
    { label: t.fornitori.anomalieChipFatture, n: data.summary.fattureDuplicati },
    { label: t.fornitori.anomalieChipBolle, n: data.summary.bolleDuplicati },
    { label: t.fornitori.anomalieChipEstratti, n: data.summary.estrattiConto },
    { label: t.fornitori.anomalieChipCoda, n: data.summary.documentiInCoda },
  ].filter((c) => c.n > 0)

  return (
    <div className="supplier-detail-tab-shell flex flex-col overflow-hidden">
      <div className={`app-card-bar-accent ${hi.bar}`} aria-hidden />
      <div className="border-b border-app-line-22/80 px-4 py-3 md:px-5">
        <p className="text-sm font-semibold text-app-fg">{t.fornitori.anomalieTabTitle}</p>
        <p className="mt-0.5 text-xs text-app-fg-muted">{t.fornitori.anomalieTabSubtitle}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {summaryChips.map((c) => (
            <span
              key={c.label}
              className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-amber-100"
            >
              {c.n} {c.label}
            </span>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {grouped.map(({ kind, rows }) => {
          return (
            <section key={kind} className="border-b border-app-line-22/60 last:border-b-0">
              <div className="flex items-center justify-between gap-2 bg-white/[0.03] px-4 py-2 md:px-5">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-app-fg-muted">
                  {sectionTitle(kind)}
                </h3>
                <button
                  type="button"
                  onClick={() => onNavigateTab(KIND_TAB[kind])}
                  className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-200"
                >
                  {t.fornitori.anomalieVaiAlTab} →
                </button>
              </div>
              <div className={APP_SECTION_MOBILE_LIST}>
                {rows.map((row) => (
                  <div
                    key={row.id}
                    className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <button
                      type="button"
                      onClick={() => openRow(row)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${severityClass(row.severity)}`}
                        >
                          {row.severity}
                        </span>
                        <span className="text-sm font-medium text-app-fg">{row.title}</span>
                      </div>
                      {row.subtitle ? (
                        <p className="mt-0.5 text-xs text-app-fg-muted">{row.subtitle}</p>
                      ) : null}
                    </button>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {row.kind === 'prezzo_listino' &&
                      row.id.startsWith('pl-') &&
                      row.id !== 'rekki-summary' ? (
                        <button
                          type="button"
                          disabled={resolvingId === row.id}
                          onClick={() => void resolvePriceAnomaly(row.id)}
                          className="rounded-lg border border-app-line-30 px-2.5 py-1 text-[11px] font-semibold text-app-fg-muted hover:bg-app-line-15"
                        >
                          {resolvingId === row.id ? '…' : t.fornitori.anomalieRisolvi}
                        </button>
                      ) : null}
                      {row.kind === 'documento_coda' && row.meta?.documentoId ? (
                        <Link
                          href={fornitoreDocumentiQueueHref(pathname, searchParams)}
                          className="rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-200"
                        >
                          {t.fornitori.anomalieApriCoda}
                        </Link>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
