'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { iconAccentClass as icon } from '@/lib/icon-accent-classes'
import type { CodaItem } from '@/lib/command-system/types'

interface Fornitore {
  id: string
  nome: string
  piva: string | null
}

interface Props {
  open: boolean
  item: CodaItem | null
  sedeId: string | null
  onClose: () => void
  onSuccess: (message: string) => void
}

export default function AssociaFornitoreDialog({ open, item, sedeId, onClose, onSuccess }: Props) {
  const [query, setQuery] = useState('')
  const [fornitori, setFornitori] = useState<Fornitore[]>([])
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const search = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (sedeId) params.set('sede_id', sedeId)
      if (q) params.set('q', q)
      const res = await fetch(`/api/fornitori/search?${params}`, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setFornitori(data)
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [sedeId])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setSelectedId(null)
    search('')
  }, [open, search])

  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => search(query), 250)
    return () => clearTimeout(timer)
  }, [query, search, open])

  const handleConfirm = async () => {
    if (!selectedId || !item) return
    setConfirming(true)
    try {
      const isStatement = item.origine === 'riga_statement'
      const url = isStatement ? '/api/statements/update-fornitore' : '/api/documenti-da-processare'
      const body = isStatement
        ? { rowId: item.id, fornitore_id: selectedId }
        : { id: item.id, azione: 'aggiorna_fornitore', fornitore_id: selectedId }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok) {
        onSuccess(isStatement ? 'Fornitore aggiornato per la riga estratto conto' : 'Documento associato al fornitore')
        onClose()
      } else {
        onSuccess(`Errore: ${data.error || 'Associazione fallita'}`)
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
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 ring-1 ring-cyan-500/30">
              <svg className={`h-4 w-4 ${icon.fornitori}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-app-fg">Associa a fornitore</h2>
              <p className="text-xs text-app-fg-muted">{item.nome_file || 'Documento'}</p>
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
          <div className="relative mb-3">
            <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-fg-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca fornitore per nome o partita IVA..."
              className="w-full rounded-lg border border-app-line-35 bg-app-line-10/50 py-2.5 pl-10 pr-3 text-sm text-app-fg placeholder:text-app-fg-muted focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
              autoFocus
            />
          </div>

          {loading && (
            <div className="flex justify-center py-6">
              <svg className="h-5 w-5 animate-spin text-app-fg-muted" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}

          {!loading && fornitori.length === 0 && (
            <p className="py-6 text-center text-xs text-app-fg-muted">Nessun fornitore trovato</p>
          )}

          <div className="space-y-1">
            {fornitori.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSelectedId(f.id)}
                className={`w-full rounded-lg px-3.5 py-2.5 text-left text-sm transition-colors ${
                  selectedId === f.id
                    ? 'bg-cyan-500/15 ring-1 ring-cyan-500/40 text-app-fg'
                    : 'text-app-fg hover:bg-app-line-10'
                }`}
              >
                <span className="font-medium">{f.nome}</span>
                {f.piva && <span className="ml-2 text-xs text-app-fg-muted">P.IVA {f.piva}</span>}
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
            className="rounded-lg bg-cyan-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-cyan-500 disabled:opacity-50"
          >
            {confirming ? 'Associo...' : 'Associa'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
