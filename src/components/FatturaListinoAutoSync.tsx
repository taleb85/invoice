'use client'

import { type ReactNode, useLayoutEffect, useRef, useState } from 'react'
import { useEffect } from 'react'
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

type Props = {
  fatturaId: string
  /** Mostra pulsante analisi listino (fatture senza bolla). */
  enabled?: boolean
  onLedgerMutated?: () => void
  onComplete?: () => void
  /** Incapsula intestazione tab + azioni (pulsante listino come slot). */
  renderActions?: (listinoButton: ReactNode) => ReactNode
}

/** Pulsante + risultati analisi listino (senza selettore documento — come tab Conferme ordine). */
export default function FatturaListinoAutoSync({
  fatturaId,
  enabled = true,
  onLedgerMutated,
  onComplete,
  renderActions,
}: Props) {
  const router = useRouter()
  const t = useT()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AutoSyncResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    setResult(null)
    setError(null)
  }, [fatturaId])

  const handleAutoSync = async () => {
    if (!fatturaId) return
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
      onComplete?.()
      onLedgerMutated?.()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t.appStrings.autoSyncErrImport)
    } finally {
      setImporting(false)
    }
  }

  const listinoButton =
    enabled && !result ? (
      <button
        type="button"
        onClick={handleAutoSync}
        disabled={loading || !fatturaId}
        className="inline-flex items-center justify-center rounded-lg bg-violet-600 px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
      >
        {loading ? t.appStrings.autoSyncBtnLoading : t.appStrings.autoSyncBtn}
      </button>
    ) : null

  const listinoButtonRef = useRef(listinoButton)
  listinoButtonRef.current = listinoButton

  useLayoutEffect(() => {
    renderActions?.(listinoButtonRef.current)
  }, [renderActions, enabled, result, loading, fatturaId])

  if (!renderActions && !enabled && !result && !error) return null

  return (
    <>
      {renderActions ? null : listinoButton}

      {error ? (
        <div className="border-b border-app-line-20 px-5 py-3">
          <div className="rounded-lg border border-[rgba(34,211,238,0.15)] bg-red-500/10 px-3 py-2.5 text-xs text-red-200">
            {error}
          </div>
        </div>
      ) : null}

      {result ? (
        <div className="border-b border-app-line-20 px-5 py-3.5">
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-md bg-app-line-15 px-3 py-2 text-center">
              <p className="text-xs text-app-fg-muted">{t.appStrings.autoSyncTotal}</p>
              <p className="text-lg font-bold tabular-nums text-app-fg sm:text-xl">{result.summary.total}</p>
            </div>
            <div className="rounded-md bg-emerald-500/10 px-3 py-2 text-center">
              <p className="text-xs text-emerald-300/80">Matched</p>
              <p className="text-lg font-bold tabular-nums text-emerald-200 sm:text-xl">{result.summary.matched}</p>
            </div>
            <div className="rounded-md bg-red-500/10 px-3 py-2 text-center">
              <p className="text-xs text-red-300/80">{t.appStrings.autoSyncAnomalies}</p>
              <p className="text-lg font-bold tabular-nums text-red-200 sm:text-xl">{result.summary.anomalies}</p>
            </div>
            <div className="rounded-md bg-violet-500/10 px-3 py-2 text-center">
              <p className="text-xs text-violet-300/80">{t.appStrings.autoSyncNewItems}</p>
              <p className="text-lg font-bold tabular-nums text-violet-200 sm:text-xl">{result.summary.new}</p>
            </div>
          </div>

          <div className="mb-3 max-h-72 overflow-y-auto rounded-lg border border-app-line-22 sm:max-h-96">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-app-line-15">
                <tr>
                  <th className="px-1.5 py-1.5 text-left text-[10px] font-semibold uppercase text-app-fg-muted">
                    {t.appStrings.autoSyncProduct}
                  </th>
                  <th className="px-1.5 py-1.5 text-right text-[10px] font-semibold uppercase text-app-fg-muted">
                    {t.appStrings.autoSyncPrice}
                  </th>
                  <th className="px-1.5 py-1.5 text-center text-[10px] font-semibold uppercase text-app-fg-muted">
                    Match
                  </th>
                  <th className="px-1.5 py-1.5 text-center text-[10px] font-semibold uppercase text-app-fg-muted">
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
                      <td className="px-1.5 py-1.5">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-app-fg">{match.lineItem.prodotto}</span>
                          {match.lineItem.codice_prodotto ? (
                            <span className="font-mono text-[10px] text-app-fg-muted">
                              {match.lineItem.codice_prodotto}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-1.5 py-1.5 text-right font-mono font-semibold tabular-nums text-app-fg">
                        £{match.lineItem.prezzo.toFixed(2)}
                      </td>
                      <td className="px-1.5 py-1.5 text-center">
                        {match.match ? (
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                              match.match.matchType === 'rekki_id'
                                ? 'bg-violet-500/20 text-violet-300'
                                : 'bg-emerald-500/20 text-emerald-300'
                            }`}
                          >
                            {match.match.matchType === 'rekki_id' ? '✓ Rekki' : '✓ Nome'}
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold uppercase text-app-fg-muted">
                            {t.appStrings.autoSyncNewItem}
                          </span>
                        )}
                      </td>
                      <td className="px-1.5 py-1.5 text-center">
                        {match.deltaPercent !== null ? (
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              match.isAnomaly
                                ? 'bg-red-500/20 text-red-200'
                                : match.deltaPercent < -5
                                  ? 'bg-emerald-500/20 text-emerald-200'
                                  : 'bg-app-line-15 text-app-fg-muted'
                            }`}
                          >
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

          <div className="flex flex-wrap items-center justify-between gap-3">
            {result.summary.anomalies > 0 ? (
              <p className="text-xs font-semibold text-red-300">
                {t.appStrings.autoSyncAnomalyWarning
                  .replace('{n}', String(result.summary.anomalies))
                  .replace('{s}', result.summary.anomalies > 1 ? 'i' : '')}
              </p>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setResult(null)}
                className="rounded-lg border border-app-line-28 bg-app-line-10 px-3 py-1.5 text-xs font-medium text-app-fg-muted hover:bg-app-line-15 sm:px-4 sm:py-2 sm:text-sm"
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={importing || result.summary.matched === 0}
                className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-500 disabled:opacity-50 sm:px-4 sm:py-2 sm:text-sm"
              >
                {importing
                  ? t.appStrings.autoSyncImporting
                  : t.appStrings.autoSyncConfirmBtn.replace('{n}', String(result.summary.matched))}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
