'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { iconAccentClass as icon } from '@/lib/icon-accent-classes'
import type { CodaItem } from '@/lib/command-system/types'

interface FatturaOption {
  id: string
  numero_fattura: string | null
  data: string
  importo: number | null
  fornitore_nome: string | null
}

interface Props {
  open: boolean
  item: CodaItem | null
  sedeId: string | null
  onClose: () => void
  onSuccess: (message: string) => void
}

export default function AssegnaFatturaDialog({ open, item, sedeId, onClose, onSuccess }: Props) {
  const [fatture, setFatture] = useState<FatturaOption[]>([])
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const loadFatture = useCallback(async () => {
    if (!item?.fornitore_id) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('fornitore_id', item.fornitore_id)
      if (sedeId) params.set('sede_id', sedeId)
      const res = await fetch(`/api/fatture/pending-approval?${params}`, { cache: 'no-store' })
      if (res.ok) {
        setFatture(await res.json())
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [item?.fornitore_id, sedeId])

  useEffect(() => {
    if (!open) return
    setSelectedId(null)
    loadFatture()
  }, [open, loadFatture])

  const handleConfirm = async () => {
    if (!selectedId || !item) return
    setConfirming(true)
    try {
      const res = await fetch('/api/statements/assign-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          row_id: item.id,
          fattura_id: selectedId,
        }),
      })
      if (res.ok) {
        onSuccess('Fattura assegnata alla riga estratto conto')
        onClose()
      } else {
        const data = await res.json().catch(() => ({}))
        onSuccess(`Errore: ${data.error || 'Assegnazione fallita'}`)
      }
    } catch (e) {
      onSuccess(`Errore: ${e instanceof Error ? e.message : 'Richiesta fallita'}`)
    } finally {
      setConfirming(false)
    }
  }

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  if (!open || !item) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center p-4 app-aurora-modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
    >
      <div className="app-card flex max-h-[min(90dvh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-app-line-22 shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-app-line-22 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-500/15 ring-1 ring-purple-500/30">
              <svg className={`h-4 w-4 ${icon.analytics}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-app-fg">Assegna fattura</h2>
              <p className="text-xs text-app-fg-muted">{item.nome_file || `Riga #${item.id.slice(0, 8)}`}</p>
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-app-line-22 bg-app-line-10/50 text-app-fg-muted transition-colors hover:bg-app-line-15 hover:text-app-fg"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          {loading && (
            <div className="flex justify-center py-6">
              <svg className="h-5 w-5 animate-spin text-app-fg-muted" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}

          {!loading && fatture.length === 0 && (
            <p className="py-6 text-center text-xs text-app-fg-muted">Nessuna fattura pending trovata per questo fornitore</p>
          )}

          <div className="space-y-2">
            {fatture.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSelectedId(f.id)}
                className={`w-full rounded-xl border p-3.5 text-left transition-colors ${
                  selectedId === f.id
                    ? 'border-purple-500/40 bg-purple-500/10'
                    : 'border-app-line-22 hover:border-app-line-32 hover:bg-app-line-5/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium ${selectedId === f.id ? 'text-purple-300' : 'text-app-fg'}`}>
                    {f.numero_fattura || `Fattura #${f.id.slice(0, 8)}`}
                  </span>
                  <span className="text-sm font-bold tabular-nums text-app-fg">
                    {f.importo != null ? `€ ${f.importo.toFixed(2)}` : '-'}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-app-fg-muted">
                  {f.data ? new Date(f.data).toLocaleDateString('it-IT') : 'Data sconosciuta'}
                  {f.fornitore_nome ? ` · ${f.fornitore_nome}` : ''}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-app-line-22 px-5 py-3">
          <button type="button" onClick={onClose}
            className="rounded-lg border border-app-line-22 px-4 py-2 text-xs font-semibold text-app-fg-muted transition-colors hover:bg-app-line-10 hover:text-app-fg"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedId || confirming}
            className="rounded-lg bg-purple-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-purple-500 disabled:opacity-50"
          >
            {confirming ? 'Assegno...' : 'Assegna fattura'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
