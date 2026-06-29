'use client'

import { Fragment, useCallback, useEffect, useId, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { ChevronDown, ExternalLink, Loader2, RefreshCw, Search, X } from 'lucide-react'
import { useToast } from '@/lib/toast-context'
import { useT } from '@/lib/use-t'
import { useLocale } from '@/lib/locale-context'
import { formatCurrency } from '@/lib/locale-shared'
import type { Locale } from '@/lib/translations/types'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import { BackButton } from '@/components/BackButton'
import {
  APP_PAGE_HEADER_STRIP_H1_CLASS,
  APP_SHELL_SECTION_PAGE_STACK_CLASS,
} from '@/lib/app-shell-layout'
import type {
  PriceAnomalia,
  PriceIntelligenceReport,
  PriceTrend,
  ProductListinoDetail,
  ProductPriceComparison,
  ProductSupplierPriceRow,
  Raccomandazione,
  SupplierPriceHealth,
} from '@/lib/price-intelligence'
import { interpolateTemplate } from '@/lib/interpolate-template'
import {
  compareDisplayPrice,
  formatCompareWeightLabel,
  mergeTrendsByNormalizedName,
  normalizeCompareDisplayRows,
  stripDisplayProductWeight,
} from '@/lib/listino-compare-normalize'

type DashboardData = {
  suppliers: SupplierPriceHealth[]
  totali: number
  critici: number
  attenzione: number
  ok: number
}

type HealthFilter = 'all' | 'ok' | 'attenzione' | 'critici'

function supplierHealthCategory(score: number): Exclude<HealthFilter, 'all'> {
  if (score >= 70) return 'ok'
  if (score >= 50) return 'attenzione'
  return 'critici'
}

function matchesHealthFilter(score: number, filter: HealthFilter): boolean {
  if (filter === 'all') return true
  return supplierHealthCategory(score) === filter
}

function HealthBar({ score }: { score: number }) {
  const color = score >= 70 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-full max-w-[80px] overflow-hidden rounded-full bg-white/10">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-xs font-bold tabular-nums ${
        score >= 70 ? 'text-emerald-400' : score >= 50 ? 'text-amber-400' : 'text-red-400'
      }`}>
        {score}%
      </span>
    </div>
  )
}

function StatusIcon({ score }: { score: number }) {
  if (score >= 70) return <span className="text-emerald-400 text-lg">🟢</span>
  if (score >= 50) return <span className="text-amber-400 text-lg">🟡</span>
  return <span className="text-red-400 text-lg">🔴</span>
}

type DetailCacheEntry =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; report: PriceIntelligenceReport }

function productInsightText(
  prodotto: string,
  anomalie: PriceAnomalia[],
  raccomandazioni: Raccomandazione[],
): string | null {
  const anomalyLines = anomalie
    .filter((a) => stripDisplayProductWeight(a.prodotto) === prodotto)
    .map((a) => a.descrizione.trim())
    .filter(Boolean)
  if (anomalyLines.length > 0) return anomalyLines.join(' · ')

  const recLines = raccomandazioni
    .filter((r) => stripDisplayProductWeight(r.prodotto) === prodotto)
    .map((r) => r.descrizione.trim())
    .filter(Boolean)
  if (recLines.length > 0) return recLines.join(' · ')

  return null
}

function sortTrendsForDisplay(trends: PriceTrend[], anomalie: PriceAnomalia[]): PriceTrend[] {
  const anomalyCount = new Map<string, number>()
  for (const a of anomalie) {
    anomalyCount.set(a.prodotto, (anomalyCount.get(a.prodotto) ?? 0) + 1)
  }
  return [...trends].sort((a, b) => {
    const ac = anomalyCount.get(a.prodotto) ?? 0
    const bc = anomalyCount.get(b.prodotto) ?? 0
    if (bc !== ac) return bc - ac
    return Math.abs(b.variazione_percent ?? 0) - Math.abs(a.variazione_percent ?? 0)
  })
}

function SupplierProductsDetail({
  fornitoreId,
  entry,
  ap,
  locale,
}: {
  fornitoreId: string
  entry: DetailCacheEntry | undefined
  ap: ReturnType<typeof useT>['strumentiAnalisiPrezzi']
  locale: Locale
}) {
  if (!entry || entry.status === 'loading') {
    return (
      <div className="flex items-center gap-2 px-3 py-4 text-xs text-white/50">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" aria-hidden />
        {ap.detailLoading}
      </div>
    )
  }

  if (entry.status === 'error') {
    return <p className="px-3 py-4 text-xs text-rose-300/90">{ap.detailLoadError}</p>
  }

  const { report } = entry
  const trends = mergeTrendsByNormalizedName(sortTrendsForDisplay(report.trends, report.anomalie))
  const anomalyCount = new Map<string, number>()
  for (const a of report.anomalie) {
    const key = stripDisplayProductWeight(a.prodotto)
    anomalyCount.set(key, (anomalyCount.get(key) ?? 0) + 1)
  }

  if (trends.length === 0) {
    return <p className="px-3 py-4 text-xs text-white/40">{ap.detailEmpty}</p>
  }

  return (
    <div className="space-y-2 px-1 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2 px-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
          {interpolateTemplate(
            ap.detailSummary,
            {
              up: report.riepilogo.in_aumento,
              down: report.riepilogo.in_calo,
              stable: report.riepilogo.stabili,
            },
            `${report.riepilogo.in_aumento} up · ${report.riepilogo.in_calo} down`,
          )}
        </p>
        <Link
          href={`/fornitori/${fornitoreId}?tab=listino`}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-300/90 transition-colors hover:text-cyan-200"
        >
          {ap.openListino}
          <ExternalLink className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
        </Link>
      </div>
      <div className="overflow-x-auto rounded-lg border border-white/[0.06] bg-black/20">
        <table className="w-full min-w-[44rem] text-xs">
          <thead>
            <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-white/35">
              <th className="px-2 py-1.5 text-left font-semibold">{ap.detailColProdotto ?? 'Prodotto'}</th>
              <th className="min-w-[10rem] px-2 py-1.5 text-left font-semibold">{ap.detailColDescrizione ?? 'Descrizione'}</th>
              <th className="px-2 py-1.5 text-right font-semibold">{ap.detailColPrezzo ?? 'Prezzo'}</th>
              <th className="px-2 py-1.5 text-right font-semibold">{ap.tableColTrend ?? 'Trend'}</th>
              <th className="px-2 py-1.5 text-right font-semibold">{ap.tableColVolatilita ?? 'Volatilità'}</th>
              <th className="px-2 py-1.5 text-right font-semibold">{ap.detailColRilevazioni ?? 'Rilevazioni'}</th>
              <th className="px-2 py-1.5 text-right font-semibold">{ap.tableColAnomalie ?? 'Anomalie'}</th>
            </tr>
          </thead>
          <tbody>
            {trends.map((trend) => {
              const anomalies = anomalyCount.get(trend.prodotto) ?? 0
              const insight = productInsightText(trend.prodotto, report.anomalie, report.raccomandazioni)
              const varPct = trend.variazione_percent
              return (
                <tr key={trend.prodotto} className="border-b border-white/[0.04] last:border-0">
                  <td className="max-w-[12rem] px-2 py-2 font-medium text-white/85">
                    <span className="line-clamp-2" title={trend.prodotto}>{trend.prodotto}</span>
                  </td>
                  <td className="max-w-[18rem] px-2 py-2 text-left text-[11px] leading-snug text-white/55">
                    {insight ? (
                      <span className="line-clamp-3" title={insight}>{insight}</span>
                    ) : (
                      <span className="text-white/30">{ap.detailNoInsight ?? '—'}</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-white/70">
                    {formatCurrency(trend.prezzo_attuale, 'GBP', locale)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                    <span className={`font-semibold ${
                      varPct != null && varPct > 0
                        ? 'text-red-400'
                        : varPct != null && varPct < 0
                          ? 'text-emerald-400'
                          : 'text-white/40'
                    }`}>
                      {varPct != null
                        ? `${varPct > 0 ? '+' : ''}${varPct}%`
                        : '—'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-white/60">
                    {trend.volatilita > 0 ? `${(trend.volatilita * 100).toFixed(0)}%` : '—'}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-white/50">
                    {trend.num_rilevazioni}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                    <span className={anomalies > 0 ? 'font-semibold text-red-400' : 'text-white/35'}>
                      {anomalies}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

type CompareDisplayRow = ProductSupplierPriceRow & {
  prezzo_confezione: number
  prezzo_kg: number | null
  peso_kg: number | null
  prezzo_unita: number
}

function compareFormatoLabel(
  row: CompareDisplayRow,
  ap: ReturnType<typeof useT>['strumentiAnalisiPrezzi'],
): string {
  const weightLabel = formatCompareWeightLabel(row.peso_kg)
  if (weightLabel) return weightLabel
  if (row.formato === 'confezione' && row.pack_size) {
    return ap.compareFormatoConfezione.replace('{n}', String(row.pack_size))
  }
  if (row.formato === 'cassa' && row.pack_size) {
    return ap.compareFormatoCassa.replace('{n}', String(row.pack_size))
  }
  if (row.unita) return row.unita
  return ap.compareFormatoSingolo
}

function ProductCompareDetailModal({
  row,
  ap,
  locale,
  onClose,
}: {
  row: CompareDisplayRow
  ap: ReturnType<typeof useT>['strumentiAnalisiPrezzi']
  locale: Locale
  onClose: () => void
}) {
  const titleId = useId()
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [detail, setDetail] = useState<ProductListinoDetail | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    setDetail(null)
    void (async () => {
      try {
        const res = await fetch(
          `/api/listino/price-intelligence?fornitore_id=${encodeURIComponent(row.fornitore_id)}&prodotto_nome=${encodeURIComponent(row.prodotto)}`,
          { cache: 'no-store' },
        )
        if (!res.ok) {
          if (!cancelled) setError(true)
          return
        }
        const json = (await res.json()) as ProductListinoDetail
        if (!cancelled) setDetail(json)
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [row.fornitore_id, row.prodotto])

  if (!mounted) return null

  const colConfezione = ap.compareColPrezzoConfezione || 'Prezzo confezione'
  const colCompare = row.prezzo_kg != null
    ? (ap.compareColPrezzoKg || 'Prezzo / kg')
    : (ap.compareColPrezzoUnita || 'Prezzo unità')

  return createPortal(
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="relative mx-auto flex max-h-[min(90dvh,calc(100dvh-2rem))] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0d1528] shadow-2xl shadow-black/55 ring-1 ring-cyan-400/20"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="min-w-0 flex-1">
            <p id={titleId} className="text-sm font-semibold leading-snug text-white">
              {row.prodotto}
            </p>
            <p className="mt-1 text-xs text-white/50">{row.fornitore_nome}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
            aria-label={ap.compareModalClose}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 border-b border-white/[0.06] px-5 py-3 text-xs sm:grid-cols-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-white/35">{ap.compareColFormato}</p>
            <p className="mt-0.5 font-medium text-white/80">{compareFormatoLabel(row, ap)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-white/35">{colConfezione}</p>
            <p className="mt-0.5 font-medium tabular-nums text-white/80">
              {formatCurrency(row.prezzo_confezione, 'GBP', locale)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-white/35">{colCompare}</p>
            <p className="mt-0.5 font-semibold tabular-nums text-white">
              {row.prezzo_kg != null
                ? formatCurrency(row.prezzo_kg, 'GBP', locale)
                : formatCurrency(row.prezzo_unita, 'GBP', locale)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-white/35">{ap.compareColData}</p>
            <p className="mt-0.5 font-medium tabular-nums text-white/80">{row.data_prezzo}</p>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
              {ap.compareModalHistory}
            </h3>
            <Link
              href={`/fornitori/${row.fornitore_id}?tab=listino`}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-300/90 transition-colors hover:text-cyan-200"
            >
              {ap.openListino}
              <ExternalLink className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
            </Link>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 py-6 text-xs text-white/50">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" aria-hidden />
              {ap.compareModalLoading}
            </div>
          ) : null}

          {!loading && error ? (
            <p className="py-4 text-xs text-rose-300/90">{ap.compareModalLoadError}</p>
          ) : null}

          {!loading && !error && detail && detail.history.length === 0 ? (
            <p className="py-4 text-xs text-white/40">{ap.compareModalEmptyHistory}</p>
          ) : null}

          {!loading && !error && detail && detail.history.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-white/[0.06] bg-black/20">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-white/35">
                    <th className="px-1.5 py-1.5 text-left font-semibold">{ap.compareColData}</th>
                    <th className="px-1.5 py-1.5 text-right font-semibold">{ap.detailColPrezzo}</th>
                    <th className="px-1.5 py-1.5 text-left font-semibold">{ap.compareModalNote}</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.history.map((entry, index) => (
                    <tr
                      key={`${entry.data_prezzo}|${entry.prezzo}|${index}`}
                      className="border-b border-white/[0.04] last:border-0"
                    >
                      <td className="whitespace-nowrap px-1.5 py-1.5 tabular-nums text-white/70">
                        {entry.data_prezzo}
                      </td>
                      <td className="whitespace-nowrap px-1.5 py-1.5 text-right font-semibold tabular-nums text-white">
                        {formatCurrency(entry.prezzo, 'GBP', locale)}
                      </td>
                      <td className="max-w-[14rem] px-1.5 py-1.5 text-[11px] text-white/45">
                        <span className="line-clamp-2" title={entry.note ?? undefined}>
                          {entry.note?.replace(/\|listino_src_[^|]+\|/g, '').trim() || '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>

        <div className="border-t border-white/10 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] py-2 text-xs font-semibold text-white/80 transition-colors hover:bg-white/[0.08]"
          >
            {ap.compareModalClose}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function ProductPriceCompareSection({
  ap,
  locale,
}: {
  ap: ReturnType<typeof useT>['strumentiAnalisiPrezzi']
  locale: Locale
}) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [comparison, setComparison] = useState<ProductPriceComparison | null>(null)
  const [selectedRow, setSelectedRow] = useState<CompareDisplayRow | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setComparison(null)
      setSearchLoading(false)
      return
    }

    let cancelled = false
    setSearchLoading(true)
    void (async () => {
      try {
        const res = await fetch(
          `/api/listino/price-intelligence?prodotto=${encodeURIComponent(debouncedQuery)}`,
          { cache: 'no-store' },
        )
        if (!res.ok) return
        const json = (await res.json()) as ProductPriceComparison
        if (!cancelled) setComparison(json)
      } catch {
        if (!cancelled) setComparison(null)
      } finally {
        if (!cancelled) setSearchLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [debouncedQuery])

  const displayMatches = useMemo(() => {
    if (!comparison?.matches.length) return []
    const rows = normalizeCompareDisplayRows(comparison.matches) as CompareDisplayRow[]
    // Unifica righe dello stesso fornitore con stesso nome prodotto normalizzato
    const dedup = new Map<string, CompareDisplayRow>()
    for (const row of rows) {
      const normalizedName = stripDisplayProductWeight(row.prodotto)
      const key = `${row.fornitore_id}|${normalizedName.toLowerCase()}`
      const existing = dedup.get(key)
      if (!existing || row.data_prezzo > existing.data_prezzo) {
        dedup.set(key, { ...row, prodotto: normalizedName })
      }
    }
    return [...dedup.values()].sort((a, b) => b.data_prezzo.localeCompare(a.data_prezzo))
  }, [comparison])

  const hasWeightCompare = useMemo(
    () => displayMatches.some((row) => row.prezzo_kg != null),
    [displayMatches],
  )

  const minPrice = useMemo(() => {
    if (displayMatches.length === 0) return comparison?.prezzo_minimo ?? null
    return displayMatches.reduce(
      (min, row) => {
        const value = compareDisplayPrice(row)
        return value < min ? value : min
      },
      compareDisplayPrice(displayMatches[0]!),
    )
  }, [comparison?.prezzo_minimo, displayMatches])

  const colConfezione = ap.compareColPrezzoConfezione || 'Prezzo confezione'
  const colCompare = hasWeightCompare
    ? (ap.compareColPrezzoKg || 'Prezzo / kg')
    : (ap.compareColPrezzoUnita || 'Prezzo unità')

  return (
    <>
    <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-white">{ap.productSearchTitle}</h2>
        <p className="mt-0.5 text-[11px] text-white/40">{ap.productSearchHint}</p>
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={ap.productSearchPlaceholder}
          className="w-full rounded-lg border border-white/10 bg-black/20 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-white/35 focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
          aria-label={ap.productSearchPlaceholder}
        />
      </div>

      {query.trim().length > 0 && query.trim().length < 2 ? (
        <p className="mt-2 text-xs text-white/40">{ap.productSearchMinChars}</p>
      ) : null}

      {searchLoading ? (
        <div className="mt-4 flex items-center gap-2 text-xs text-white/50">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" aria-hidden />
          {ap.productSearchLoading}
        </div>
      ) : null}

      {!searchLoading && debouncedQuery.length >= 2 && comparison && comparison.matches.length === 0 ? (
        <p className="mt-4 text-xs text-white/40">{ap.productSearchEmpty}</p>
      ) : null}

      {!searchLoading && displayMatches.length > 0 ? (
        <div className="mt-4 overflow-x-auto rounded-lg border border-white/[0.06] bg-black/10">
          <table className="w-full min-w-[36rem] text-xs">
            <thead>
              <tr className="border-b border-white/[0.08] text-[10px] uppercase tracking-wider text-white/35">
                <th className="px-2 py-1.5 text-left font-semibold">{ap.tableColFornitore}</th>
                <th className="px-2 py-1.5 text-left font-semibold">{ap.compareColProdottoMatch}</th>
                <th className="px-2 py-1.5 text-left font-semibold">{ap.compareColFormato}</th>
                <th className="px-2 py-1.5 text-right font-semibold">{colConfezione}</th>
                <th className="px-2 py-1.5 text-right font-semibold">{colCompare}</th>
                <th className="px-2 py-1.5 text-right font-semibold">{ap.compareColData}</th>
                <th className="px-2 py-1.5 text-right font-semibold">{ap.tableColTrend}</th>
                <th className="px-2 py-1.5 text-right font-semibold">{ap.compareColVsCheapest}</th>
              </tr>
            </thead>
            <tbody>
              {displayMatches.map((row) => {
                const comparePrice = compareDisplayPrice(row)
                const isCheapest =
                  minPrice != null && Math.abs(comparePrice - minPrice) < 0.01
                const deltaPct =
                  minPrice != null && minPrice > 0 && !isCheapest
                    ? Math.round(((comparePrice - minPrice) / minPrice) * 10000) / 100
                    : null
                return (
                  <tr
                    key={`${row.fornitore_id}|${row.prodotto}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedRow(row)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setSelectedRow(row)
                      }
                    }}
                    className={`cursor-pointer border-b border-white/[0.04] transition-colors last:border-0 hover:bg-white/[0.04] ${isCheapest ? 'bg-emerald-500/[0.06]' : ''}`}
                  >
                    <td className="px-2 py-2">
                      <span className="font-semibold text-white">{row.fornitore_nome}</span>
                      {isCheapest ? (
                        <span className="ml-1.5 inline-flex rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-300">
                          {ap.compareCheapestBadge}
                        </span>
                      ) : null}
                    </td>
                    <td className="max-w-[14rem] px-2 py-2 text-white/70">
                      <span className="line-clamp-2 underline decoration-white/15 decoration-dotted underline-offset-2" title={row.prodotto}>
                        {row.prodotto}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-white/55">
                      {compareFormatoLabel(row, ap)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-white/70">
                      {formatCurrency(row.prezzo_confezione, 'GBP', locale)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right font-semibold tabular-nums text-white">
                      {row.prezzo_kg != null
                        ? formatCurrency(row.prezzo_kg, 'GBP', locale)
                        : formatCurrency(row.prezzo_unita, 'GBP', locale)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-white/50">
                      {row.data_prezzo}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                      <span className={`font-semibold ${
                        row.variazione_percent != null && row.variazione_percent > 0
                          ? 'text-red-400'
                          : row.variazione_percent != null && row.variazione_percent < 0
                            ? 'text-emerald-400'
                            : 'text-white/35'
                      }`}>
                        {row.variazione_percent != null
                          ? `${row.variazione_percent > 0 ? '+' : ''}${row.variazione_percent}%`
                          : '—'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-white/50">
                      {isCheapest ? '—' : deltaPct != null ? `+${deltaPct}%` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
    {selectedRow ? (
      <ProductCompareDetailModal
        row={selectedRow}
        ap={ap}
        locale={locale}
        onClose={() => setSelectedRow(null)}
      />
    ) : null}
    </>
  )
}

export default function AnalisiPrezziPage() {
  const t = useT()
  const { locale } = useLocale()
  const { showToast } = useToast()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncStatusText, setSyncStatusText] = useState<string | null>(null)
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number; name: string } | null>(null)
  const [syncRigheInserite, setSyncRigheInserite] = useState(0)
  const [healthFilter, setHealthFilter] = useState<HealthFilter>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [detailCache, setDetailCache] = useState<Record<string, DetailCacheEntry>>({})

  const ap = t.strumentiAnalisiPrezzi

  const toggleHealthFilter = useCallback((next: HealthFilter) => {
    setHealthFilter((prev) => (prev === next ? 'all' : next))
  }, [])

  const filteredSuppliers =
    data?.suppliers.filter((s) => matchesHealthFilter(s.punteggio_salute, healthFilter)) ?? []

  const loadSupplierDetail = useCallback(async (fornitoreId: string) => {
    setDetailCache((prev) => ({ ...prev, [fornitoreId]: { status: 'loading' } }))
    try {
      const res = await fetch(`/api/listino/price-intelligence?fornitore_id=${encodeURIComponent(fornitoreId)}`)
      if (!res.ok) {
        throw new Error(
          interpolateTemplate(t.common.httpError, { code: res.status }, `Error ${res.status}`),
        )
      }
      const report = (await res.json()) as PriceIntelligenceReport
      setDetailCache((prev) => ({ ...prev, [fornitoreId]: { status: 'ready', report } }))
    } catch {
      setDetailCache((prev) => ({ ...prev, [fornitoreId]: { status: 'error' } }))
    }
  }, [t.common.httpError])

  const toggleSupplierExpanded = useCallback((fornitoreId: string) => {
    setExpandedId((prev) => (prev === fornitoreId ? null : fornitoreId))
  }, [])

  useEffect(() => {
    if (!expandedId) return
    const current = detailCache[expandedId]
    if (current?.status === 'loading' || current?.status === 'ready') return
    void loadSupplierDetail(expandedId)
  }, [detailCache, expandedId, loadSupplierDetail])

  const loadData = useCallback(async () => {
    setLoading(true)
    setExpandedId(null)
    setDetailCache({})
    try {
      const res = await fetch('/api/listino/price-intelligence')
      if (!res.ok) {
        throw new Error(
          interpolateTemplate(t.common.httpError, { code: res.status }, `Error ${res.status}`),
        )
      }
      const json = await res.json()
      setData(json)
    } catch (e) {
      showToast(e instanceof Error ? e.message : ap.loadError ?? 'Errore caricamento', 'error')
    } finally {
      setLoading(false)
    }
  }, [ap.loadError, showToast, t])

  useEffect(() => { loadData() }, [loadData])

  const handleSyncListino = useCallback(async () => {
    if (syncing) return
    setSyncing(true)
    setSyncStatusText(
      ap.syncDiscovering ?? 'Ricerca fatture da importare…',
    )
    try {
      const discRes = await fetch('/api/listino/sync-from-fatture', { cache: 'no-store' })
      if (!discRes.ok) {
        throw new Error(
          interpolateTemplate(t.common.httpError, { code: discRes.status }, `Error ${discRes.status}`),
        )
      }
      const disc = (await discRes.json()) as {
        fornitori?: Array<{ id: string; nome: string; pending_fatture: number }>
        total_pending_fatture?: number
      }
      const fornitori = disc.fornitori ?? []
      if (fornitori.length === 0 || (disc.total_pending_fatture ?? 0) === 0) {
        showToast(ap.syncNothingPending ?? 'Nessuna fattura da importare.', 'info')
        await loadData()
        return
      }

      let righeInserite = 0
      let fattureScanned = 0
      for (let i = 0; i < fornitori.length; i++) {
        const f = fornitori[i]
        const label = interpolateTemplate(
          ap.syncProgress,
          { current: i + 1, total: fornitori.length, name: f.nome ?? '—' },
          `Fornitore ${i + 1}/${fornitori.length}`,
        )
        setSyncStatusText(label)
        setSyncProgress({ current: i + 1, total: fornitori.length, name: f.nome ?? '—' })
        const res = await fetch('/api/listino/sync-from-fatture', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fornitore_id: f.id }),
        })
        const json = (await res.json().catch(() => ({}))) as {
          error?: string
          righe_inserite?: number
          fatture_scanned?: number
        }
        if (!res.ok) {
          throw new Error(
            typeof json.error === 'string'
              ? json.error
              : (ap.syncError ?? 'Aggiornamento listino non riuscito'),
          )
        }
        righeInserite += json.righe_inserite ?? 0
        fattureScanned += json.fatture_scanned ?? 0
        setSyncRigheInserite(righeInserite)
      }

      showToast(
        interpolateTemplate(
          ap.syncDone,
          { righe: righeInserite, fatture: fattureScanned },
          `Listino aggiornato: ${righeInserite} righe da ${fattureScanned} fatture.`,
        ),
        'success',
      )
      await loadData()
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : (ap.syncError ?? 'Aggiornamento listino non riuscito'),
        'error',
      )
    } finally {
      setSyncing(false)
      setSyncStatusText(null)
      setSyncProgress(null)
      setSyncRigheInserite(0)
    }
  }, [ap, loadData, showToast, syncing, t.common.httpError])

  return (
    <div className={APP_SHELL_SECTION_PAGE_STACK_CLASS}>
      <AppPageHeaderStrip
        accent="cyan"
        leadingAccessory={<BackButton href="/strumenti" label={t.strumentiAnalisiPrezzi.backToTools} iconOnly className="mb-0 shrink-0" />}
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M3 3v18h18M7 16l4-8 4 4 4-6" />
          </svg>
        }
      >
        <h1 className={APP_PAGE_HEADER_STRIP_H1_CLASS}>{t.strumentiAnalisiPrezzi.pageTitle}</h1>
        <button
          type="button"
          onClick={() => void handleSyncListino()}
          disabled={syncing || loading}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-200 transition-colors hover:bg-cyan-500/18 disabled:opacity-50"
        >
          {syncing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          <span className="hidden sm:inline">{ap.syncButton ?? 'Aggiorna prodotti e prezzi'}</span>
        </button>
      </AppPageHeaderStrip>

      {syncProgress ? (
        <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4" role="status">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-cyan-200">
              {syncProgress.name}
            </span>
            <span className="text-[11px] tabular-nums text-white/40">
              {syncProgress.current}/{syncProgress.total}
            </span>
          </div>
          <div className="mb-2 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-cyan-400 transition-all duration-500"
              style={{ width: `${(syncProgress.current / syncProgress.total) * 100}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-white/40">{syncStatusText}</span>
            {syncRigheInserite > 0 ? (
              <span className="tabular-nums text-emerald-400">
                +{syncRigheInserite} righe
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      <ProductPriceCompareSection ap={ap} locale={locale} />

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-2 h-4 w-1/3 rounded bg-white/10" />
              <div className="h-3 w-1/2 rounded bg-white/5" />
            </div>
          ))}
        </div>
      ) : data && data.totali > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {([
              {
                key: 'all' as const,
                value: data.totali,
                label: ap.kpiSuppliersAnalyzed,
                valueClass: 'text-white',
                activeClass: 'border-cyan-400/50 bg-cyan-500/10 ring-1 ring-cyan-400/25',
              },
              {
                key: 'ok' as const,
                value: data.ok,
                label: ap.kpiHealthOk,
                valueClass: 'text-emerald-400',
                activeClass: 'border-emerald-400/50 bg-emerald-500/10 ring-1 ring-emerald-400/25',
              },
              {
                key: 'attenzione' as const,
                value: data.attenzione,
                label: ap.kpiAttention,
                valueClass: 'text-amber-400',
                activeClass: 'border-amber-400/50 bg-amber-500/10 ring-1 ring-amber-400/25',
              },
              {
                key: 'critici' as const,
                value: data.critici,
                label: ap.kpiCritical,
                valueClass: 'text-red-400',
                activeClass: 'border-red-400/50 bg-red-500/10 ring-1 ring-red-400/25',
              },
            ]).map((kpi) => {
              const isActive = healthFilter === kpi.key
              return (
                <button
                  key={kpi.key}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => toggleHealthFilter(kpi.key)}
                  className={`rounded-xl border p-4 text-left transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 ${
                    isActive
                      ? kpi.activeClass
                      : 'border-white/10 bg-white/[0.03]'
                  }`}
                >
                  <div className={`text-2xl font-bold tabular-nums ${kpi.valueClass}`}>{kpi.value}</div>
                  <div className="text-[11px] text-white/40">{kpi.label}</div>
                </button>
              )
            })}
          </div>

          <div className="overflow-x-auto rounded-lg border border-white/[0.06] bg-black/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-[1.5px] text-white/40">{t.strumentiAnalisiPrezzi.tableColStato}</th>
                  <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-[1.5px] text-white/40">{t.strumentiAnalisiPrezzi.tableColFornitore}</th>
                  <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-[1.5px] text-white/40">{t.strumentiAnalisiPrezzi.tableColProdotti}</th>
                  <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-[1.5px] text-white/40">{t.strumentiAnalisiPrezzi.tableColTrend}</th>
                  <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-[1.5px] text-white/40">{t.strumentiAnalisiPrezzi.tableColVolatilita}</th>
                  <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-[1.5px] text-white/40">{t.strumentiAnalisiPrezzi.tableColAnomalie}</th>
                  <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-[1.5px] text-white/40">{t.strumentiAnalisiPrezzi.tableColScore}</th>
                </tr>
              </thead>
              <tbody>
                {filteredSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-2 py-8 text-center text-sm text-white/40">
                      {ap.filterEmptyCategory}
                    </td>
                  </tr>
                ) : null}
                {filteredSuppliers.map((s) => {
                  const isExpanded = expandedId === s.fornitore_id
                  return (
                    <Fragment key={s.fornitore_id}>
                      <tr className={`border-b border-white/[0.04] transition-colors ${isExpanded ? 'bg-white/[0.03]' : 'hover:bg-white/[0.02]'}`}>
                        <td className="px-2 py-2.5">
                          <StatusIcon score={s.punteggio_salute} />
                        </td>
                        <td className="px-2 py-2.5">
                          <button
                            type="button"
                            aria-expanded={isExpanded}
                            onClick={() => toggleSupplierExpanded(s.fornitore_id)}
                            className="group flex max-w-full items-center gap-1.5 text-left font-semibold text-white transition-colors hover:text-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 rounded"
                          >
                            <ChevronDown
                              className={`h-3.5 w-3.5 shrink-0 text-white/40 transition-transform group-hover:text-sky-300 ${isExpanded ? 'rotate-180 text-sky-400' : ''}`}
                              aria-hidden
                            />
                            <span className="truncate">{s.fornitore_nome}</span>
                          </button>
                        </td>
                        <td className="px-2 py-2.5 text-white/60">{s.prodotti_analizzati}</td>
                        <td className="px-2 py-2.5">
                          <span className={`text-xs font-semibold ${
                            s.trend_complessivo > 0 ? 'text-red-400'
                            : s.trend_complessivo < 0 ? 'text-emerald-400'
                            : 'text-white/40'
                          }`}>
                            {s.trend_complessivo > 0 ? `+${s.trend_complessivo}%` : s.trend_complessivo < 0 ? `${s.trend_complessivo}%` : '—'}
                          </span>
                        </td>
                        <td className="px-2 py-2.5 text-white/60">
                          {s.volatilita_media > 0 ? `${(s.volatilita_media * 100).toFixed(0)}%` : '—'}
                        </td>
                        <td className="px-2 py-2.5">
                          <span className={`text-xs font-semibold ${
                            s.anomalie_attive > 0 ? 'text-red-400' : 'text-white/40'
                          }`}>
                            {s.anomalie_attive}
                          </span>
                        </td>
                        <td className="px-2 py-2.5">
                          <HealthBar score={s.punteggio_salute} />
                        </td>
                      </tr>
                      {isExpanded ? (
                        <tr className="border-b border-white/[0.04] bg-black/10">
                          <td colSpan={7} className="px-2 py-1">
                            <SupplierProductsDetail
                              fornitoreId={s.fornitore_id}
                              entry={detailCache[s.fornitore_id]}
                              ap={ap}
                              locale={locale}
                            />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

          {data.totali === 0 && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center">
              <p className="text-sm text-white/40">{t.strumentiAnalisiPrezzi.emptyInsufficientData}</p>
              <p className="mt-1 text-xs text-white/30">
                {t.strumentiAnalisiPrezzi.emptyInsufficientDataHint}
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <p className="text-sm text-white/40">{t.strumentiAnalisiPrezzi.emptyNoData}</p>
          <p className="mt-1 text-xs text-white/30">
            {t.strumentiAnalisiPrezzi.emptyNoDataHint}
          </p>
        </div>
      )}
    </div>
  )
}
