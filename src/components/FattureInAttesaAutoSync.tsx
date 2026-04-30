'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/use-t'

interface LineItem {
  prodotto: string
  codice_prodotto: string | null
  prezzo: number
  unita: string | null
  note: string | null
}

interface MatchResult {
  lineItem: LineItem
  match: {
    listinoId: string
    prodotto: string
    prezzoAttuale: number
    rekkiProductId: string | null
    matchType: 'rekki_id' | 'fuzzy_name' | 'none'
    fuzzyScore?: number
  } | null
  delta: number | null
  deltaPercent: number | null
  isAnomaly: boolean
  isNew: boolean
}

interface AutoSyncResult {
  matches: MatchResult[]
  summary: {
    total: number
    matched: number
    anomalies: number
    new: number
  }
  fattura: {
    id: string
    data: string
    numero_fattura: string | null
  }
}

export default function FattureInAttesaAutoSync({
  fatturaId,
  onComplete,
}: {
  fatturaId: string
  onComplete?: () => void
}) {
  const router = useRouter()
  const t = useT()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AutoSyncResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  const handleAutoSync = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/listino/auto-sync-fattura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fattura_id: fatturaId }),
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || `Errore ${res.status}`)
        setLoading(false)
        return
      }
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.appStrings.autoSyncErrAnalysis)
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmImport = async () => {
    if (!result) return
    setImporting(true)
    setError(null)
    try {
      if (onComplete) onComplete()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t.appStrings.autoSyncErrImport)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="rounded-lg border border-app-line-28 bg-white/[0.04] p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-app-fg">{t.appStrings.autoSyncTitle}</h3>
          <p className="mt-1 text-xs text-app-fg-muted">{t.appStrings.autoSyncDesc}</p>
        </div>
        {!result && (
          <button
            type="button"
            onClick={handleAutoSync}
            disabled={loading}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
          >
            {loading ? t.appStrings.autoSyncBtnLoading : t.appStrings.autoSyncBtn}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-[rgba(34,211,238,0.15)] bg-red-500/10 px-3 py-2.5 text-xs text-red-200">
          <div className="flex items-start gap-2">
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        </div>
      )}

      {result && (
        <>
          <div className="mb-4 grid grid-cols-4 gap-2">
            <div className="rounded-md bg-app-line-15 px-3 py-2 text-center">
              <p className="text-xs text-app-fg-muted">{t.appStrings.autoSyncTotal}</p>
              <p className="text-xl font-bold tabular-nums text-app-fg">{result.summary.total}</p>
            </div>
            <div className="rounded-md bg-emerald-500/10 px-3 py-2 text-center">
              <p className="text-xs text-emerald-300/80">Matched</p>
              <p className="text-xl font-bold tabular-nums text-emerald-200">{result.summary.matched}</p>
            </div>
            <div className="rounded-md bg-red-500/10 px-3 py-2 text-center">
              <p className="text-xs text-red-300/80">{t.appStrings.autoSyncAnomalies}</p>
              <p className="text-xl font-bold tabular-nums text-red-200">{result.summary.anomalies}</p>
            </div>
            <div className="rounded-md bg-violet-500/10 px-3 py-2 text-center">
              <p className="text-xs text-violet-300/80">{t.appStrings.autoSyncNewItems}</p>
              <p className="text-xl font-bold tabular-nums text-violet-200">{result.summary.new}</p>
            </div>
          </div>

          <div className="mb-4 max-h-96 overflow-y-auto rounded-lg border border-app-line-22">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-app-line-15">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-app-fg-muted">
                    {t.appStrings.autoSyncProduct}
                  </th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-app-fg-muted">
                    {t.appStrings.autoSyncPrice}
                  </th>
                  <th className="px-3 py-2 text-center text-[10px] font-semibold uppercase text-app-fg-muted">
                    Match
                  </th>
                  <th className="px-3 py-2 text-center text-[10px] font-semibold uppercase text-app-fg-muted">
                    Δ
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.matches.map((match, idx) => {
                  const rowBg = match.isAnomaly
                    ? 'bg-red-500/15'
                    : match.isNew
                      ? 'bg-violet-500/10'
                      : match.match
                        ? 'bg-emerald-500/5'
                        : ''
                  return (
                    <tr key={idx} className={`border-t border-app-line-15 ${rowBg}`}>
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-app-fg">{match.lineItem.prodotto}</span>
                          {match.lineItem.codice_prodotto && (
                            <span className="font-mono text-[10px] text-app-fg-muted">
                              {match.lineItem.codice_prodotto}
                            </span>
                          )}
                          {match.match && match.match.matchType === 'fuzzy_name' && match.match.prodotto !== match.lineItem.prodotto && (
                            <span className="text-[9px] italic text-app-fg-muted">≈ {match.match.prodotto}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums text-app-fg">
                        £{match.lineItem.prezzo.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {match.match ? (
                          <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                            match.match.matchType === 'rekki_id'
                              ? 'bg-violet-500/20 text-violet-300'
                              : 'bg-emerald-500/20 text-emerald-300'
                          }`}>
                            {match.match.matchType === 'rekki_id' ? '✓ Rekki' : '✓ Nome'}
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold uppercase tracking-wide text-app-fg-muted">
                            {t.appStrings.autoSyncNewItem}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {match.deltaPercent !== null ? (
                          <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            match.isAnomaly
                              ? 'bg-red-500/20 text-red-200'
                              : match.deltaPercent < -5
                                ? 'bg-emerald-500/20 text-emerald-200'
                                : 'bg-app-line-15 text-app-fg-muted'
                          }`}>
                            {match.deltaPercent > 0 ? '▲' : '▼'} {Math.abs(match.deltaPercent).toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-[10px] text-app-fg-muted">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 text-xs text-app-fg-muted">
              {result.summary.anomalies > 0 && (
                <span className="font-semibold text-red-300">
                  ⚠️ {t.appStrings.autoSyncAnomalyWarning
                    .replace('{n}', String(result.summary.anomalies))
                    .replace('{s}', result.summary.anomalies > 1 ? 'i' : '')}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setResult(null)}
                className="rounded-lg border border-app-line-28 bg-app-line-10 px-4 py-2 text-sm font-medium text-app-fg-muted transition-colors hover:bg-app-line-15"
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={importing || result.summary.matched === 0}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
              >
                {importing
                  ? t.appStrings.autoSyncImporting
                  : t.appStrings.autoSyncConfirmBtn.replace('{n}', String(result.summary.matched))}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
