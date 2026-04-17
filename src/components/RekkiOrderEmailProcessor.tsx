'use client'

import { useState } from 'react'

interface RekkiLine {
  prodotto: string
  quantita: number
  prezzo_unitario: number
  importo_linea: number
  action?: 'updated' | 'created' | 'skipped'
  listinoId?: string
  previousPrice?: number
}

interface ProcessResult {
  success: boolean
  productsExtracted: number
  productsUpdated: number
  productsCreated: number
  statementId?: string
  error?: string
  lines: RekkiLine[]
}

export default function RekkiOrderEmailProcessor({
  fornitoreId,
  fornitoreNome,
}: {
  fornitoreId: string
  fornitoreNome: string
}) {
  const [emailBody, setEmailBody] = useState('')
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState<ProcessResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleProcess = async () => {
    if (!emailBody.trim()) {
      setError('Incolla il testo dell\'email di conferma Rekki')
      return
    }
    
    setProcessing(true)
    setError(null)
    setResult(null)
    
    try {
      const res = await fetch('/api/rekki/process-order-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fornitore_id: fornitoreId,
          email_body: emailBody,
          email_subject: 'Order Confirmation',
          data_ordine: new Date().toISOString().split('T')[0],
        }),
        credentials: 'include',
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        setError(data.error || `Errore ${res.status}`)
        setProcessing(false)
        return
      }
      
      setResult(data.result)
      if (data.result.success) {
        setEmailBody('') // Clear on success
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante il processing')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="supplier-detail-tab-shell overflow-hidden border-violet-500/25">
      <div className="app-card-bar-accent bg-gradient-to-r from-violet-500/80 to-purple-500/60" aria-hidden />
      
      <div className="px-5 py-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-app-fg">Importa Ordine Rekki da Email</h3>
            <p className="mt-1 text-xs leading-relaxed text-app-fg-muted">
              Incolla il testo di un'email di conferma ordine Rekki per aggiornare automaticamente il listino
            </p>
          </div>
          <svg className="h-6 w-6 shrink-0 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>

        {/* Textarea for email content */}
        <div className="mb-3">
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-app-fg-muted">
            Testo Email di Conferma
          </label>
          <textarea
            value={emailBody}
            onChange={(e) => setEmailBody(e.target.value)}
            placeholder="Incolla qui il testo dell'email di conferma ordine Rekki&#10;&#10;Es:&#10;2 x Salmon fillet @ £12.50&#10;3 x Tomatoes @ £4.20&#10;1 x Olive oil @ £8.90"
            rows={8}
            disabled={processing}
            className="w-full rounded-lg border border-violet-500/30 bg-violet-950/20 px-3 py-2 text-sm text-app-fg placeholder:text-app-fg-muted/60 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30 disabled:opacity-50"
          />
          <p className="mt-1.5 text-xs text-app-fg-muted">
            Il parser riconosce formati come: <span className="font-mono text-violet-300">"2 x Prodotto @ £12.50"</span> o <span className="font-mono text-violet-300">"Prodotto  3  12.50"</span>
          </p>
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

        {/* Result */}
        {result && (
          <div className="mb-3 rounded-lg border border-violet-500/30 bg-violet-500/10 p-4">
            <div className="mb-3 flex items-center gap-2">
              <svg className="h-5 w-5 text-violet-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-bold text-violet-200">
                {result.success ? 'Ordine processato con successo' : 'Processing completato con errori'}
              </p>
            </div>

            {/* Summary */}
            <div className="mb-3 grid grid-cols-3 gap-2">
              <div className="rounded-md bg-app-line-15 px-3 py-2 text-center">
                <p className="text-xs text-app-fg-muted">Estratti</p>
                <p className="text-xl font-bold tabular-nums text-app-fg">{result.productsExtracted}</p>
              </div>
              <div className="rounded-md bg-emerald-500/15 px-3 py-2 text-center">
                <p className="text-xs text-emerald-300/80">Aggiornati</p>
                <p className="text-xl font-bold tabular-nums text-emerald-200">{result.productsUpdated}</p>
              </div>
              <div className="rounded-md bg-violet-500/15 px-3 py-2 text-center">
                <p className="text-xs text-violet-300/80">Nuovi</p>
                <p className="text-xl font-bold tabular-nums text-violet-200">{result.productsCreated}</p>
              </div>
            </div>

            {/* Lines table */}
            {result.lines.length > 0 && (
              <div className="mb-3 max-h-60 overflow-y-auto rounded-md border border-app-line-22">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-app-line-15">
                    <tr>
                      <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase text-app-fg-muted">
                        Prodotto
                      </th>
                      <th className="px-2 py-1.5 text-center text-[10px] font-semibold uppercase text-app-fg-muted">
                        Qty
                      </th>
                      <th className="px-2 py-1.5 text-right text-[10px] font-semibold uppercase text-app-fg-muted">
                        Prezzo
                      </th>
                      <th className="px-2 py-1.5 text-center text-[10px] font-semibold uppercase text-app-fg-muted">
                        Azione
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.lines.map((line, idx) => (
                      <tr key={idx} className="border-t border-app-line-15">
                        <td className="px-2 py-1.5 text-app-fg">{line.prodotto}</td>
                        <td className="px-2 py-1.5 text-center font-mono tabular-nums text-app-fg-muted">
                          {line.quantita}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono font-semibold tabular-nums text-app-fg">
                          £{line.prezzo_unitario.toFixed(2)}
                          {line.previousPrice && line.previousPrice !== line.prezzo_unitario && (
                            <span className="ml-1 text-[10px] text-app-fg-muted line-through">
                              £{line.previousPrice.toFixed(2)}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          {line.action === 'updated' ? (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-300">
                              ✓ Aggiornato
                            </span>
                          ) : line.action === 'created' ? (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-violet-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-300">
                              + Nuovo
                            </span>
                          ) : (
                            <span className="text-[9px] font-semibold text-app-fg-muted">Saltato</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {result.statementId && (
              <p className="text-xs text-violet-300">
                Statement creato per triple-check: <span className="font-mono">{result.statementId}</span>
              </p>
            )}

            {result.error && (
              <p className="text-xs text-red-300">
                ⚠️ Errore: {result.error}
              </p>
            )}
          </div>
        )}

        {/* Action button */}
        <button
          type="button"
          onClick={handleProcess}
          disabled={processing || !emailBody.trim()}
          className="w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
        >
          {processing ? 'Processing in corso...' : 'Processa Ordine Rekki'}
        </button>

        {/* Help text */}
        <details className="mt-4 rounded-lg border border-app-line-22 bg-app-line-10/50 px-3 py-2">
          <summary className="cursor-pointer text-xs font-semibold text-violet-300 hover:text-violet-200">
            Come funziona?
          </summary>
          <div className="mt-2 space-y-2 text-xs leading-relaxed text-app-fg-muted">
            <p>Quando processi un'email di conferma ordine Rekki:</p>
            <ul className="ml-4 list-disc space-y-1">
              <li>L'AI estrae automaticamente prodotti, quantità e prezzi</li>
              <li>I prezzi vengono salvati/aggiornati nel listino del fornitore</li>
              <li>Viene creato uno "statement" per confrontare con le fatture</li>
              <li>Eventuali discrepanze tra prezzo Rekki e fattura vengono segnalate</li>
            </ul>
            <p className="font-semibold text-violet-300">
              💡 Usa questo per tenere sempre aggiornato il listino con i prezzi pattuiti
            </p>
          </div>
        </details>
      </div>
    </div>
  )
}
