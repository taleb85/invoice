'use client'

import { useState, useEffect } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { it } from 'date-fns/locale'
import GmailSetupModal from './GmailSetupModal'

interface PriceComparison {
  prodotto: string
  lowestPrice: number
  currentPrice: number | null
  potentialSavings: number
  occurrences: number
}

interface PotentialRefund {
  fatturaId: string
  numeroFattura: string | null
  dataFattura: string
  prodotto: string
  pricePaid: number
  lowestEmailPrice: number
  delta: number
  deltaPercent: number
  quantity: number
  potentialRefund: number
}

interface ScanResult {
  success: boolean
  fornitore: string
  emailsScanned: number
  productsFound: number
  pricesExtracted: number
  dateRange: {
    oldest: string | null
    newest: string | null
  }
  lowestPrices: PriceComparison[]
  potentialRefunds: PotentialRefund[]
  totalPotentialRefund: number
}

export default function RekkiPriceHistoryScanner({
  fornitoreId,
  fornitoreNome,
}: {
  fornitoreId: string
  fornitoreNome: string
}) {
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedView, setSelectedView] = useState<'summary' | 'lowest' | 'refunds'>('summary')
  
  // Gmail setup state
  const [showSetupModal, setShowSetupModal] = useState(false)
  const [gmailConfigured, setGmailConfigured] = useState(false)
  const [gmailConnected, setGmailConnected] = useState(false)
  const [checkingStatus, setCheckingStatus] = useState(false)

  useEffect(() => {
    checkGmailStatus()
  }, [])

  const checkGmailStatus = async () => {
    setCheckingStatus(true)
    try {
      const res = await fetch('/api/auth/google/status', {
        credentials: 'include',
      })
      
      if (res.ok) {
        const data = await res.json()
        setGmailConfigured(data.configured)
        setGmailConnected(data.connected)
      }
    } catch (err) {
      console.error('[GMAIL-STATUS] Error:', err)
    } finally {
      setCheckingStatus(false)
    }
  }

  const handleScan = async () => {
    // Check Gmail status first
    if (!gmailConfigured || !gmailConnected) {
      setShowSetupModal(true)
      return
    }
    
    if (!confirm(`Scansionare tutte le email storiche di ${fornitoreNome}? Questa operazione può richiedere alcuni minuti.`)) {
      return
    }
    
    setScanning(true)
    setError(null)
    setResult(null)
    
    try {
      const res = await fetch('/api/rekki/scan-price-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fornitore_id: fornitoreId,
          max_emails: 200,
          lookback_days: 730, // 2 years
        }),
        credentials: 'include',
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        setError(data.error || `Errore ${res.status}`)
        setScanning(false)
        return
      }
      
      setResult(data.result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante la scansione')
    } finally {
      setScanning(false)
    }
  }

  const exportCSV = () => {
    if (!result) return
    
    const rows = [
      ['Fattura', 'Data', 'Prodotto', 'Prezzo Pagato', 'Prezzo Email Più Basso', 'Delta %', 'Quantità', 'Rimborso Potenziale'],
      ...result.potentialRefunds.map(r => [
        r.numeroFattura || r.fatturaId,
        r.dataFattura,
        r.prodotto,
        `£${r.pricePaid.toFixed(2)}`,
        `£${r.lowestEmailPrice.toFixed(2)}`,
        `+${r.deltaPercent.toFixed(1)}%`,
        r.quantity.toString(),
        `£${r.potentialRefund.toFixed(2)}`,
      ])
    ]
    
    const csv = rows.map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rimborsi-potenziali-${fornitoreNome}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleSetupSuccess = () => {
    setShowSetupModal(false)
    checkGmailStatus()
    // Auto-start scan after setup
    setTimeout(() => {
      handleScan()
    }, 1000)
  }

  return (
    <>
      {/* Gmail Setup Modal */}
      <GmailSetupModal
        isOpen={showSetupModal}
        onClose={() => setShowSetupModal(false)}
        onSuccess={handleSetupSuccess}
      />
      
      <div className="supplier-detail-tab-shell overflow-hidden border-orange-500/25" id="rekki-price-history-scanner">
        <div className="app-card-bar-accent bg-gradient-to-r from-orange-500/80 to-red-500/60" aria-hidden />
      
      <div className="px-5 py-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-app-fg">Cronologia Prezzi Storica</h3>
            <p className="mt-1 text-xs leading-relaxed text-app-fg-muted">
              Scansiona tutte le email passate per trovare discrepanze di prezzo e potenziali rimborsi
            </p>
          </div>
          <button
            type="button"
            onClick={handleScan}
            disabled={scanning || checkingStatus}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-xs font-semibold text-orange-300 transition-colors hover:bg-orange-500/20 disabled:opacity-50"
          >
            {scanning ? (
              <>
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-orange-300 border-t-transparent" />
                Scansione in corso...
              </>
            ) : checkingStatus ? (
              <>
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-orange-300 border-t-transparent" />
                Verifica...
              </>
            ) : !gmailConfigured || !gmailConnected ? (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Configura e Scansiona
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Sincronizza Storico
              </>
            )}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs text-red-200">
            <div className="flex items-start gap-2">
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-4">
            {/* Summary KPIs */}
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <div className="rounded-lg border border-app-line-22 bg-app-line-10/50 px-3 py-2.5 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-app-fg-muted">Email</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-app-fg">{result.emailsScanned}</p>
              </div>
              <div className="rounded-lg border border-app-line-22 bg-app-line-10/50 px-3 py-2.5 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-app-fg-muted">Prodotti</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-app-fg">{result.productsFound}</p>
              </div>
              <div className="rounded-lg border border-app-line-22 bg-app-line-10/50 px-3 py-2.5 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-app-fg-muted">Prezzi</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-app-fg">{result.pricesExtracted}</p>
              </div>
              <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2.5 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-300">Rimborso Tot.</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-orange-200">
                  £{result.totalPotentialRefund.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Date Range */}
            {result.dateRange.oldest && result.dateRange.newest && (
              <div className="rounded-lg border border-app-line-22 bg-app-line-10/30 px-3 py-2 text-xs text-app-fg-muted">
                <span className="font-semibold">Periodo analizzato:</span>{' '}
                {new Date(result.dateRange.oldest).toLocaleDateString('it-IT')} →{' '}
                {new Date(result.dateRange.newest).toLocaleDateString('it-IT')}
                {' '}
                ({formatDistanceToNow(new Date(result.dateRange.oldest), { locale: it })})
              </div>
            )}

            {/* View Tabs */}
            <div className="flex gap-2 border-b border-app-line-22">
              <button
                type="button"
                onClick={() => setSelectedView('summary')}
                className={`px-3 py-2 text-xs font-semibold transition-colors ${
                  selectedView === 'summary'
                    ? 'border-b-2 border-orange-500 text-orange-300'
                    : 'text-app-fg-muted hover:text-app-fg'
                }`}
              >
                Riepilogo
              </button>
              <button
                type="button"
                onClick={() => setSelectedView('lowest')}
                className={`px-3 py-2 text-xs font-semibold transition-colors ${
                  selectedView === 'lowest'
                    ? 'border-b-2 border-orange-500 text-orange-300'
                    : 'text-app-fg-muted hover:text-app-fg'
                }`}
              >
                Prezzi Più Bassi ({result.lowestPrices.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedView('refunds')}
                className={`px-3 py-2 text-xs font-semibold transition-colors ${
                  selectedView === 'refunds'
                    ? 'border-b-2 border-orange-500 text-orange-300'
                    : 'text-app-fg-muted hover:text-app-fg'
                }`}
              >
                Rimborsi Potenziali ({result.potentialRefunds.length})
              </button>
            </div>

            {/* Summary View */}
            {selectedView === 'summary' && (
              <div className="space-y-3">
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <h4 className="text-sm font-bold text-emerald-200">✅ Scansione Completata</h4>
                  <p className="mt-2 text-xs leading-relaxed text-emerald-200/80">
                    Ho analizzato <span className="font-bold">{result.emailsScanned} email</span> storiche di{' '}
                    <span className="font-bold">{fornitoreNome}</span> e trovato{' '}
                    <span className="font-bold">{result.productsFound} prodotti</span> con{' '}
                    <span className="font-bold">{result.pricesExtracted} occorrenze di prezzo</span>.
                  </p>
                  
                  {result.potentialRefunds.length > 0 && (
                    <div className="mt-3 rounded-md border border-orange-500/30 bg-orange-500/10 p-3">
                      <p className="text-xs font-semibold text-orange-200">
                        ⚠️ Ho identificato <span className="font-bold">{result.potentialRefunds.length} fatture</span>{' '}
                        dove hai pagato più del prezzo confermato via email Rekki.
                      </p>
                      <p className="mt-1 text-xs text-orange-200/80">
                        Totale potenziale rimborso:{' '}
                        <span className="font-bold text-orange-100">£{result.totalPotentialRefund.toFixed(2)}</span>
                      </p>
                    </div>
                  )}
                </div>

                <p className="text-xs text-app-fg-muted">
                  Clicca sui tab sopra per vedere i dettagli dei prezzi più bassi trovati o le discrepanze con le fatture.
                </p>
              </div>
            )}

            {/* Lowest Prices View */}
            {selectedView === 'lowest' && (
              <div className="space-y-2">
                {result.lowestPrices.length === 0 ? (
                  <p className="py-8 text-center text-xs text-app-fg-muted">
                    Nessun confronto disponibile (prodotti non presenti nel listino attuale)
                  </p>
                ) : (
                  <>
                    <div className="max-h-96 overflow-y-auto rounded-lg border border-app-line-22">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-app-line-15">
                          <tr>
                            <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-app-fg-muted">
                              Prodotto
                            </th>
                            <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-app-fg-muted">
                              Prezzo Min Email
                            </th>
                            <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-app-fg-muted">
                              Prezzo Listino
                            </th>
                            <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-app-fg-muted">
                              Risparmio
                            </th>
                            <th className="px-3 py-2 text-center text-[10px] font-semibold uppercase text-app-fg-muted">
                              Occorrenze
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.lowestPrices.map((price, idx) => (
                            <tr key={idx} className="border-t border-app-line-15">
                              <td className="px-3 py-2 text-app-fg">{price.prodotto}</td>
                              <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums text-emerald-300">
                                £{price.lowestPrice.toFixed(2)}
                              </td>
                              <td className="px-3 py-2 text-right font-mono tabular-nums text-app-fg">
                                £{price.currentPrice?.toFixed(2) || '—'}
                              </td>
                              <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums text-orange-300">
                                £{price.potentialSavings.toFixed(2)}
                              </td>
                              <td className="px-3 py-2 text-center font-mono tabular-nums text-app-fg-muted">
                                {price.occurrences}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-app-fg-muted">
                      I "Prezzi Min Email" sono i prezzi più bassi mai confermati via email Rekki.
                      Il "Risparmio" indica quanto potresti risparmiare rispetto al listino attuale.
                    </p>
                  </>
                )}
              </div>
            )}

            {/* Potential Refunds View */}
            {selectedView === 'refunds' && (
              <div className="space-y-3">
                {result.potentialRefunds.length === 0 ? (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
                    <p className="text-sm font-semibold text-emerald-200">✅ Nessuna discrepanza trovata!</p>
                    <p className="mt-1 text-xs text-emerald-200/80">
                      Tutti i prezzi delle fatture corrispondono ai prezzi confermati via email Rekki.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-app-fg-muted">
                        Le seguenti fatture contengono prezzi superiori a quelli confermati via email:
                      </p>
                      <button
                        type="button"
                        onClick={exportCSV}
                        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-app-line-22 bg-app-line-10/50 px-2.5 py-1.5 text-xs font-semibold text-app-fg transition-colors hover:bg-app-line-15"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Esporta CSV
                      </button>
                    </div>
                    
                    <div className="max-h-96 overflow-y-auto rounded-lg border border-orange-500/30">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-orange-500/10">
                          <tr>
                            <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-orange-300">
                              Fattura
                            </th>
                            <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-orange-300">
                              Prodotto
                            </th>
                            <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-orange-300">
                              Pagato
                            </th>
                            <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-orange-300">
                              Email Min
                            </th>
                            <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-orange-300">
                              Delta
                            </th>
                            <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-orange-300">
                              Qty
                            </th>
                            <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-orange-300">
                              Rimborso
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.potentialRefunds.map((refund, idx) => (
                            <tr key={idx} className="border-t border-orange-500/20">
                              <td className="px-3 py-2">
                                <div className="text-app-fg">{refund.numeroFattura || '—'}</div>
                                <div className="text-[10px] text-app-fg-muted">
                                  {new Date(refund.dataFattura).toLocaleDateString('it-IT')}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-app-fg">{refund.prodotto}</td>
                              <td className="px-3 py-2 text-right font-mono tabular-nums text-red-300">
                                £{refund.pricePaid.toFixed(2)}
                              </td>
                              <td className="px-3 py-2 text-right font-mono tabular-nums text-emerald-300">
                                £{refund.lowestEmailPrice.toFixed(2)}
                              </td>
                              <td className="px-3 py-2 text-right font-mono tabular-nums text-orange-300">
                                +{refund.deltaPercent.toFixed(1)}%
                              </td>
                              <td className="px-3 py-2 text-right font-mono tabular-nums text-app-fg-muted">
                                {refund.quantity}
                              </td>
                              <td className="px-3 py-2 text-right font-mono font-bold tabular-nums text-orange-200">
                                £{refund.potentialRefund.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t-2 border-orange-500/40 bg-orange-500/15">
                          <tr>
                            <td colSpan={6} className="px-3 py-2 text-right font-semibold text-orange-200">
                              Totale Rimborso Potenziale:
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-lg font-bold tabular-nums text-orange-100">
                              £{result.totalPotentialRefund.toFixed(2)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-3">
                      <p className="text-xs font-semibold text-orange-200">💡 Come procedere:</p>
                      <ul className="mt-2 ml-4 list-disc space-y-1 text-xs text-orange-200/80">
                        <li>Contatta {fornitoreNome} con la lista delle discrepanze</li>
                        <li>Fai riferimento alle email di conferma ordine Rekki come prova</li>
                        <li>Richiedi nota di credito per il totale: £{result.totalPotentialRefund.toFixed(2)}</li>
                      </ul>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Help Text */}
        {!result && !scanning && (
          <details className="mt-4 rounded-lg border border-app-line-22 bg-app-line-10/50 px-3 py-2">
            <summary className="cursor-pointer text-xs font-semibold text-orange-300 hover:text-orange-200">
              Come funziona la sincronizzazione storica?
            </summary>
            <div className="mt-2 space-y-2 text-xs leading-relaxed text-app-fg-muted">
              <p>Quando attivi la scansione, il sistema:</p>
              <ul className="ml-4 list-disc space-y-1">
                <li>Cerca tutte le email passate da orders@rekki.com per questo fornitore</li>
                <li>Estrae ogni occorrenza di prezzo per ogni prodotto</li>
                <li>Identifica il prezzo più basso mai confermato via email</li>
                <li>Confronta con i prezzi delle fatture caricate</li>
                <li>Calcola potenziali rimborsi se hai pagato più del prezzo confermato</li>
              </ul>
              <p className="font-semibold text-orange-300">
                💡 Utile per recuperare crediti su sovraprezzi non autorizzati!
              </p>
            </div>
          </details>
        )}
        
        {/* Setup Hint (when not configured) */}
        {!result && !scanning && !gmailConfigured && (
          <div className="mt-4 rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-4">
            <div className="flex items-start gap-3">
              <svg className="h-5 w-5 shrink-0 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-cyan-200">💡 Configurazione Rapida Necessaria</h4>
                <p className="mt-1 text-xs leading-relaxed text-cyan-200/80">
                  Per attivare la sincronizzazione storica dei prezzi, devi prima connettere Gmail.
                  Click sul tasto sopra per un wizard guidato (~2 minuti).
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Connection Hint (configured but not connected) */}
        {!result && !scanning && gmailConfigured && !gmailConnected && (
          <div className="mt-4 rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
            <div className="flex items-start gap-3">
              <svg className="h-5 w-5 shrink-0 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-blue-200">📧 Connetti Gmail</h4>
                <p className="mt-1 text-xs leading-relaxed text-blue-200/80">
                  Gmail API è configurato, ma il tuo account non è ancora connesso.
                  Click sul tasto sopra per autorizzare l'accesso.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  )
}
