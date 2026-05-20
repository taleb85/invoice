'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { iconAccentClass as icon } from '@/lib/icon-accent-classes'
import type { CodaItem } from '@/lib/command-system/types'

interface Props {
  open: boolean
  item: CodaItem | null
  onClose: () => void
  onSuccess: (message: string) => void
}

export default function RifiutaFatturaDialog({ open, item, onClose, onSuccess }: Props) {
  const [reason, setReason] = useState('')
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (!open) return
    setReason('')
  }, [open])

  const handleConfirm = async () => {
    if (!item) return
    setConfirming(true)
    try {
      const res = await fetch('/api/fatture/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fattura_id: item.id,
          action: 'reject',
          reason: reason || 'Respinta da Control Hub',
        }),
      })
      if (res.ok) {
        onSuccess('Fattura rifiutata')
        onClose()
      } else {
        const data = await res.json().catch(() => ({}))
        onSuccess(`Errore: ${data.error || 'Rifiuto fallito'}`)
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
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-500/15 ring-1 ring-rose-500/30">
              <svg className="h-4 w-4 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-app-fg">Rifiuta fattura</h2>
              <p className="text-xs text-app-fg-muted">{item.nome_file || `Fattura #${item.riferimenti || item.id}`}</p>
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
          <label className="mb-2 block text-xs font-semibold text-app-fg">
            Motivazione del rifiuto
            <span className="ml-1 text-app-fg-muted font-normal">(opzionale)</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Inserisci il motivo del rifiuto..."
            rows={4}
            className="w-full rounded-lg border border-app-line-35 bg-app-line-10/50 px-3.5 py-2.5 text-sm text-app-fg placeholder:text-app-fg-muted focus:border-rose-500/50 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
            autoFocus
          />
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
            disabled={confirming}
            className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-rose-500 disabled:opacity-50"
          >
            {confirming ? 'Rifiuto...' : 'Rifiuta fattura'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
