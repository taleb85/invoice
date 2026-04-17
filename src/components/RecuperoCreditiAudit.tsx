'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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
  const [loading, setLoading] = useState(false)
  const [audit, setAudit] = useState<AuditSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({
    from: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1 year ago
    to: new Date().toISOString().split('T')[0],
  })

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency,
    }).format(amount)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('it-IT', {
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
        setError(data.error || `Errore ${res.status}`)
        setLoading(false)
        return
      }
      
      setAudit(data.summary)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante l\'audit')
    } finally {
      setLoading(false)
    }
  }

  const handleSyncStorico = async () => {
    if (!confirm('Questa operazione analizzerà tutte le fatture storiche e aggiornerà le date di riferimento nel listino. Procedere?')) {
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
        setError(data.error || `Errore ${res.status}`)
        setSyncing(false)
        return
      }
      
      setSyncSuccess(data.message)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante la sincronizzazione')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="app-card overflow-hidden border-red-500/25">
      <div className="app-card-bar-accent bg-gradient-to-r from-red-500/80 to-orange-500/60" aria-hidden />
      
      <div className="px-5 py-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-app-fg">Audit Recupero Crediti</h3>
            <p className="mt-1 text-xs leading-relaxed text-app-fg-muted">
              Analizza tutte le fatture storiche per identificare sovraprezzi rispetto ai prezzi Rekki pattuiti
            </p>
          </div>
          <svg className="h-6 w-6 shrink-0 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        {/* Date range selector */}
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[120px]">
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-app-fg-muted">
              Da
            </label>
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
              className="w-full rounded-lg border border-app-line-28 bg-app-line-15 px-3 py-2 text-sm text-app-fg [color-scheme:dark] focus:border-red-500/40 focus:outline-none focus:ring-2 focus:ring-red-500/20"
            />
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-app-fg-muted">
              A
            </label>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
              className="w-full rounded-lg border border-app-line-28 bg-app-line-15 px-3 py-2 text-sm text-app-fg [color-scheme:dark] focus:border-red-500/40 focus:outline-none focus:ring-2 focus:ring-red-500/20"
            />
          </div>
          <button
            type="button"
            onClick={handleRunAudit}
            disabled={loading}
            className="shrink-0 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-red-500 disabled:opacity-50"
          >
            {loading ? 'Analisi in corso...' : 'Esegui Audit'}
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs text-red-200">
            <div className="flex items-start gap-2">
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          </div>
        )}

        {syncSuccess && (
          <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-200">
            <div className="flex items-start gap-2">
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{syncSuccess}</span>
            </div>
          </div>
        )}

        {/* Sync storico button */}
        <div className="mb-4 rounded-lg border border-violet-500/30 bg-violet-500/10 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="text-xs font-bold text-violet-200">Sincronizza Storico con Rekki</p>
              <p className="mt-1 text-xs leading-relaxed text-violet-300/80">
                Analizza tutte le fatture passate e aggiorna automaticamente le date di riferimento
                per eliminare i blocchi "Data documento anteriore"
              </p>
            </div>
            <button
              type="button"
              onClick={handleSyncStorico}
              disabled={syncing}
              className="shrink-0 rounded-lg bg-violet-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
            >
              {syncing ? 'Sync...' : 'Sincronizza'}
            </button>
          </div>
        </div>

        {audit && (
          <>
            {/* Summary KPIs */}
            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-center">
                <p className="text-xs text-red-300/80">Spreco Totale</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-red-200">
                  {formatCurrency(audit.totalSpreco)}
                </p>
              </div>
              <div className="rounded-lg border border-app-line-22 bg-app-line-10 px-4 py-3 text-center">
                <p className="text-xs text-app-fg-muted">Anomalie</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-app-fg">
                  {audit.totalOvercharges}
                </p>
              </div>
              <div className="rounded-lg border border-app-line-22 bg-app-line-10 px-4 py-3 text-center">
                <p className="text-xs text-app-fg-muted">Prodotti</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-app-fg">
                  {audit.productCount}
                </p>
              </div>
              <div className="rounded-lg border border-app-line-22 bg-app-line-10 px-4 py-3 text-center">
                <p className="text-xs text-app-fg-muted">Fatture</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-app-fg">
                  {audit.fattureCount}
                </p>
              </div>
            </div>

            {audit.items.length === 0 ? (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-6 text-center">
                <svg className="mx-auto h-12 w-12 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="mt-3 text-sm font-semibold text-emerald-200">
                  Nessun sovrapprezzo rilevato!
                </p>
                <p className="mt-1 text-xs text-emerald-300/80">
                  Tutti i prezzi fatturati sono in linea o inferiori a quelli Rekki pattuiti
                </p>
              </div>
            ) : (
              <>
                {/* Overcharges table */}
                <div className="mb-4 max-h-[600px] overflow-y-auto rounded-lg border border-app-line-22">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 app-workspace-inset-bg">
                      <tr>
                        <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-app-fg-muted">
                          Fattura
                        </th>
                        <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-app-fg-muted">
                          Prodotto
                        </th>
                        <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-app-fg-muted">
                          Pagato
                        </th>
                        <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-app-fg-muted">
                          Pattuito
                        </th>
                        <th className="px-3 py-2 text-center text-[10px] font-semibold uppercase text-app-fg-muted">
                          Δ%
                        </th>
                        <th className="px-3 py-2 text-center text-[10px] font-semibold uppercase text-app-fg-muted">
                          Qty
                        </th>
                        <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-app-fg-muted">
                          Spreco
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {audit.items.map((item, idx) => (
                        <tr key={idx} className="border-t border-app-line-15 bg-red-500/5 hover:bg-red-500/10">
                          <td className="px-3 py-2">
                            <div className="flex flex-col gap-0.5">
                              <Link
                                href={`/fornitori/${fornitoreId}?tab=fatture&fattura=${item.fatturaId}`}
                                className="font-semibold text-app-fg hover:text-red-300"
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
                              <span className="font-mono text-[10px] text-violet-300">
                                {item.rekkiProductId}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums text-red-300">
                            {formatCurrency(item.prezzoPagato)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-emerald-300">
                            {formatCurrency(item.prezzoPattuito)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-200">
                              +{item.differenzaPercent.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center font-mono text-app-fg-muted">
                            {item.quantita ?? '?'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold tabular-nums text-red-200">
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
                      // Export to CSV
                      const csv = [
                        ['Data', 'Numero Fattura', 'Prodotto', 'Rekki ID', 'Pagato', 'Pattuito', 'Differenza %', 'Quantità', 'Spreco'].join(','),
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
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `audit-${fornitoreNome}-${dateRange.from}-${dateRange.to}.csv`
                      a.click()
                      URL.revokeObjectURL(url)
                    }}
                    className="flex items-center gap-2 rounded-lg border border-app-line-28 bg-app-line-10 px-4 py-2 text-sm font-medium text-app-fg transition-colors hover:bg-app-line-15"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Esporta CSV
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {/* Help text */}
        {!audit && (
          <details className="mt-4 rounded-lg border border-app-line-22 bg-app-line-15 px-3 py-2">
            <summary className="cursor-pointer text-xs font-semibold text-red-300 hover:text-red-200">
              Come funziona l'audit?
            </summary>
            <div className="mt-2 space-y-2 text-xs leading-relaxed text-app-fg-muted">
              <p>L'audit analizza tutte le fatture nel periodo selezionato e:</p>
              <ul className="ml-4 list-disc space-y-1">
                <li>Estrae i line items da ogni fattura usando AI</li>
                <li>Confronta i prezzi pagati con i prezzi Rekki pattuiti (listino)</li>
                <li>Identifica tutti i casi in cui è stato pagato un prezzo superiore</li>
                <li>Calcola lo spreco totale basandosi sulla quantità acquistata</li>
              </ul>
              <p className="font-semibold text-red-300">
                💡 Usa questo report per richiedere note di credito al fornitore
              </p>
            </div>
          </details>
        )}
      </div>
    </div>
  )
}
