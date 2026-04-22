'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useT } from '@/lib/use-t'
import { useLocale } from '@/lib/locale-context'

interface OverchargeItem {
  fatturaId: string
  fatturaData: string
  fatturaNumero: string | null
  prodotto: string
  rekkiProductId: string
  prezzoPagato: number
  prezzoPattuito: number
  differenza: number
  differenzaPercent: number
  quantita: number | null
  sprecoTotale: number
}

interface AuditSummary {
  totalOvercharges: number
  totalSpreco: number
  productCount: number
  fattureCount: number
  items: OverchargeItem[]
}

export default function RecuperoCreditiAudit({
  fornitoreId,
  fornitoreNome,
  currency = 'GBP',
}: {
  fornitoreId: string
  fornitoreNome: string
  currency?: string
}) {
  const router = useRouter()
  const t = useT()
  const { locale } = useLocale()
  const [loading, setLoading] = useState(false)
  const [audit, setAudit] = useState<AuditSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({
    from: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
  })

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).format(amount)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const handleRunAudit = async () => {
    setLoading(true)
    setError(null)
    setSyncSuccess(null)
    
    try {
      const res = await fetch('/api/audit/rekki-price-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fornitore_id: fornitoreId,
          from_date: dateRange.from,
          to_date: dateRange.to,
        }),
        credentials: 'include',
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        setError(data.error || t.appStrings.auditErrStatus.replace('{status}', String(res.status)))
        setLoading(false)
        return
      }
      
      setAudit(data.summary)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.appStrings.auditErrGeneric)
    } finally {
      setLoading(false)
    }
  }

  const handleSyncStorico = async () => {
    if (!confirm(t.appStrings.auditSyncConfirm)) {
      return
    }
    
    setSyncing(true)
    setError(null)
    setSyncSuccess(null)
    
    try {
      const res = await fetch('/api/listino/sync-storico-rekki', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fornitore_id: fornitoreId }),
        credentials: 'include',
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        setError(data.error || t.appStrings.auditErrStatus.replace('{status}', String(res.status)))
        setSyncing(false)
        return
      }
      
      setSyncSuccess(data.message)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t.appStrings.auditErrSync)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[rgba(34,211,238,0.15)] bg-transparent">
      <div className="h-0.5 w-full shrink-0 bg-gradient-to-r from-rose-500 via-rose-400 to-rose-600 [box-shadow:0_0_16px_rgba(244,63,94,0.5),0_0_28px_rgba(225,29,72,0.3)]" aria-hidden />

      <div className="px-5 py-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-rose-400/80">Rekki Audit</p>
            <h3 className="mt-0.5 text-sm font-bold text-app-fg">{t.appStrings.auditTitle}</h3>
            <p className="mt-1 text-xs leading-relaxed text-app-fg-muted">
              {t.appStrings.auditDesc}
            </p>
          </div>
          <svg className="h-5 w-5 shrink-0 text-rose-400/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        {/* Date range selector */}
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[120px]">
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-rose-400/70">
              {t.appStrings.auditDateFrom}
            </label>
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
              className="w-full rounded-xl border border-[rgba(34,211,238,0.15)] bg-rose-500/[0.06] px-3 py-2 text-sm text-app-fg [color-scheme:dark] placeholder:text-rose-300/55 focus:border-[rgba(34,211,238,0.15)] focus:outline-none"
            />
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-rose-400/70">
              {t.appStrings.auditDateTo}
            </label>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
              className="w-full rounded-xl border border-[rgba(34,211,238,0.15)] bg-rose-500/[0.06] px-3 py-2 text-sm text-app-fg [color-scheme:dark] placeholder:text-rose-300/55 focus:border-[rgba(34,211,238,0.15)] focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={handleRunAudit}
            disabled={loading}
            className="shrink-0 rounded-xl border border-[rgba(34,211,238,0.15)] bg-rose-600/80 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-rose-500/80 disabled:opacity-50"
          >
            {loading ? t.appStrings.auditRunning : t.appStrings.auditRunBtn}
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-[rgba(34,211,238,0.15)] bg-rose-500/10 px-3 py-2.5 text-xs text-rose-200">
            <div className="flex items-start gap-2">
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          </div>
        )}

        {syncSuccess && (
          <div className="mb-4 rounded-xl border border-[rgba(34,211,238,0.15)] bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-200">
            <div className="flex items-start gap-2">
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{syncSuccess}</span>
            </div>
          </div>
        )}

        {/* Sync storico button */}
        <div className="mb-4 relative overflow-hidden rounded-xl border border-[rgba(34,211,238,0.15)] bg-transparent">
          <div className="h-px w-full bg-gradient-to-r from-violet-500/60 via-violet-400/40 to-violet-600/60" aria-hidden />
          <div className="flex items-start justify-between gap-3 px-4 py-3">
            <div className="flex-1">
              <p className="text-xs font-bold text-violet-300">{t.appStrings.auditSyncTitle}</p>
              <p className="mt-1 text-xs leading-relaxed text-app-fg-muted">
                {t.appStrings.auditSyncDesc}
              </p>
            </div>
            <button
              type="button"
              onClick={handleSyncStorico}
              disabled={syncing}
              className="shrink-0 rounded-xl border border-[rgba(34,211,238,0.15)] bg-violet-600/70 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-violet-500/70 disabled:opacity-50"
            >
              {syncing ? t.appStrings.auditSyncing : t.appStrings.auditSyncBtn}
            </button>
          </div>
        </div>

        {audit && (
          <>
            {/* Summary KPIs */}
            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="relative overflow-hidden rounded-2xl border border-[rgba(34,211,238,0.15)] bg-transparent">
                <div className="h-0.5 shrink-0 bg-gradient-to-r from-rose-500 via-rose-400 to-rose-700" />
                <div className="px-4 py-3 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-400/80">{t.appStrings.auditKpiSpreco}</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-rose-300">
                    {formatCurrency(audit.totalSpreco)}
                  </p>
                </div>
              </div>
              <div className="relative overflow-hidden rounded-2xl border border-app-soft-border bg-transparent">
                <div className="h-0.5 shrink-0 bg-gradient-to-r from-app-fg-muted/30 to-app-fg-muted/10" />
                <div className="px-4 py-3 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-app-fg-muted">{t.appStrings.auditKpiAnomalies}</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-app-fg">
                    {audit.totalOvercharges}
                  </p>
                </div>
              </div>
              <div className="relative overflow-hidden rounded-2xl border border-app-soft-border bg-transparent">
                <div className="h-0.5 shrink-0 bg-gradient-to-r from-app-fg-muted/30 to-app-fg-muted/10" />
                <div className="px-4 py-3 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-app-fg-muted">{t.appStrings.auditKpiProducts}</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-app-fg">
                    {audit.productCount}
                  </p>
                </div>
              </div>
              <div className="relative overflow-hidden rounded-2xl border border-app-soft-border bg-transparent">
                <div className="h-0.5 shrink-0 bg-gradient-to-r from-app-fg-muted/30 to-app-fg-muted/10" />
                <div className="px-4 py-3 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-app-fg-muted">{t.appStrings.auditKpiFatture}</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-app-fg">
                    {audit.fattureCount}
                  </p>
                </div>
              </div>
            </div>

            {audit.items.length === 0 ? (
              <div className="rounded-xl border border-[rgba(34,211,238,0.15)] bg-emerald-500/[0.05] px-4 py-6 text-center">
                <svg className="mx-auto h-10 w-10 text-emerald-400/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="mt-3 text-sm font-semibold text-emerald-200">
                  {t.appStrings.auditNoOvercharges}
                </p>
                <p className="mt-1 text-xs text-emerald-300/70">
                  {t.appStrings.auditNoOverchargesDesc}
                </p>
              </div>
            ) : (
              <>
                {/* Overcharges table */}
                <div className="mb-4 max-h-[600px] overflow-y-auto rounded-xl border border-app-soft-border">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 app-workspace-inset-bg">
                      <tr>
                        <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-app-fg-muted">
                          {t.appStrings.auditColFattura}
                        </th>
                        <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-app-fg-muted">
                          {t.appStrings.auditColProdotto}
                        </th>
                        <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-app-fg-muted">
                          {t.appStrings.auditColPagato}
                        </th>
                        <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-app-fg-muted">
                          {t.appStrings.auditColPattuito}
                        </th>
                        <th className="px-3 py-2 text-center text-[10px] font-semibold uppercase text-app-fg-muted">
                          Δ%
                        </th>
                        <th className="px-3 py-2 text-center text-[10px] font-semibold uppercase text-app-fg-muted">
                          Qty
                        </th>
                        <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-app-fg-muted">
                          {t.appStrings.auditColSpreco}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {audit.items.map((item, idx) => (
                        <tr key={idx} className="border-t border-app-line-15 bg-rose-500/[0.03] hover:bg-rose-500/[0.08]">
                          <td className="px-3 py-2">
                            <div className="flex flex-col gap-0.5">
                              <Link
                                href={`/fornitori/${fornitoreId}?tab=fatture&fattura=${item.fatturaId}`}
                                className="font-semibold text-app-fg hover:text-rose-300"
                              >
                                {formatDate(item.fatturaData)}
                              </Link>
                              {item.fatturaNumero && (
                                <span className="text-[10px] text-app-fg-muted">
                                  #{item.fatturaNumero}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-medium text-app-fg">{item.prodotto}</span>
                              <span className="font-mono text-[10px] text-violet-300/80">
                                {item.rekkiProductId}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums text-rose-300">
                            {formatCurrency(item.prezzoPagato)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-emerald-300">
                            {formatCurrency(item.prezzoPattuito)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-200">
                              +{item.differenzaPercent.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center font-mono text-app-fg-muted">
                            {item.quantita ?? '?'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold tabular-nums text-rose-200">
                            {formatCurrency(item.sprecoTotale)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Export button */}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      const a = t.appStrings
                      const csv = [
                        [a.auditCsvDate, a.auditCsvInvoiceNum, a.auditCsvProduct, a.auditCsvRekkiId, a.auditCsvPaid, a.auditCsvAgreed, a.auditCsvDiffPct, a.auditCsvQty, a.auditCsvWaste].join(','),
                        ...audit.items.map(item => [
                          item.fatturaData,
                          item.fatturaNumero ?? '',
                          `"${item.prodotto}"`,
                          item.rekkiProductId,
                          item.prezzoPagato,
                          item.prezzoPattuito,
                          item.differenzaPercent.toFixed(2),
                          item.quantita ?? '',
                          item.sprecoTotale.toFixed(2),
                        ].join(',')),
                      ].join('\n')
                      const blob = new Blob([csv], { type: 'text/csv' })
                      const url = URL.createObjectURL(blob)
                      const el = document.createElement('a')
                      el.href = url
                      el.download = `audit-${fornitoreNome}-${dateRange.from}-${dateRange.to}.csv`
                      el.click()
                      URL.revokeObjectURL(url)
                    }}
                    className="flex items-center gap-2 rounded-xl border border-app-line-25 bg-transparent px-4 py-2 text-sm font-medium text-app-fg transition-colors hover:bg-app-line-10"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {t.appStrings.attivitaExportCsv}
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {/* Help text */}
        {!audit && (
          <details className="mt-4 rounded-xl border border-app-soft-border px-3 py-2">
            <summary className="cursor-pointer text-xs font-semibold text-rose-300/80 hover:text-rose-200">
              {t.appStrings.auditHelpTitle}
            </summary>
            <div className="mt-2 space-y-2 text-xs leading-relaxed text-app-fg-muted">
              <p>{t.appStrings.auditHelpP1}</p>
              <ul className="ml-4 list-disc space-y-1">
                <li>{t.appStrings.auditHelpLi1}</li>
                <li>{t.appStrings.auditHelpLi2}</li>
                <li>{t.appStrings.auditHelpLi3}</li>
                <li>{t.appStrings.auditHelpLi4}</li>
              </ul>
              <p className="font-semibold text-rose-300/80">
                {t.appStrings.auditHelpCta}
              </p>
            </div>
          </details>
        )}
      </div>
    </div>
  )
}
