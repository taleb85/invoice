'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { iconAccentClass as icon } from '@/lib/icon-accent-classes'
import type { CodaItem } from '@/lib/command-system/types'

interface Props {
  open: boolean
  item: CodaItem | null
  onClose: () => void
  onSuccess: (message: string, itemId?: string) => void
}

type DocKind = 'fattura' | 'bolla' | 'nota_credito' | 'statement' | 'ordine' | 'comunicazione' | 'listino'

interface KindOption {
  kind: DocKind
  label: string
  icon: string
  desc: string
}

const KINDS: KindOption[] = [
  { kind: 'fattura', label: 'Fattura', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', desc: 'Documento fiscale' },
  { kind: 'bolla', label: 'Bolla', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4', desc: 'Documento di trasporto' },
  { kind: 'nota_credito', label: 'Nota credito', icon: 'M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z', desc: 'Nota di credito / storno' },
  { kind: 'statement', label: 'Estratto conto', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', desc: 'Riepilogo / statement' },
  { kind: 'ordine', label: 'Ordine', icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z', desc: 'Ordine / conferma ordine' },
  { kind: 'comunicazione', label: 'Comunicazione', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z', desc: 'Non fiscale / comunicazione' },
  { kind: 'listino', label: 'Listino', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', desc: 'Listino prezzi' },
]

export default function AggiornaCategoriaDialog({ open, item, onClose, onSuccess }: Props) {
  const [selectedKind, setSelectedKind] = useState<DocKind | null>(null)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (!open) return
    const current = item?.pending_kind as DocKind | undefined
    if (current && KINDS.some(k => k.kind === current)) {
      setSelectedKind(current)
    } else {
      setSelectedKind(null)
    }
  }, [open, item])

  const handleConfirm = async () => {
    if (!selectedKind || !item) return
    setConfirming(true)
    try {
      const hasFornitore = !!item.fornitore_id
      const azione = hasFornitore ? 'finalizza_tipo' : 'set_pending_kind'

      const res = await fetch('/api/documenti-da-processare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          azione,
          kind: selectedKind,
        }),
      })
      if (res.ok) {
        onSuccess(`Documento confermato come ${KINDS.find(k => k.kind === selectedKind)?.label || selectedKind}`, item.id)
        onClose()
      } else {
        const data = await res.json().catch(() => ({}))
        if (data.error?.includes('rimane in coda')) {
          const saveRes = await fetch('/api/documenti-da-processare', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: item.id,
              azione: 'set_pending_kind',
              kind: selectedKind,
            }),
          })
          if (saveRes.ok) {
            onSuccess(`Categoria salvata come ${KINDS.find(k => k.kind === selectedKind)?.label || selectedKind}`, item.id)
          } else {
            onSuccess(`Errore: ${data.error || 'Aggiornamento fallito'}`, item.id)
          }
        } else {
          onSuccess(`Errore: ${data.error || 'Aggiornamento fallito'}`, item.id)
        }
        onClose()
      }
    } catch (e) {
      onSuccess(`Errore: ${e instanceof Error ? e.message : 'Richiesta fallita'}`, item?.id)
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
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-500/15 ring-1 ring-teal-500/30">
              <svg className={`h-4 w-4 ${icon.listino}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-app-fg">Conferma categoria</h2>
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
          <div className="grid grid-cols-2 gap-2">
            {KINDS.map((k) => (
              <button
                key={k.kind}
                type="button"
                onClick={() => setSelectedKind(k.kind)}
                className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-colors ${
                  selectedKind === k.kind
                    ? 'border-teal-500/50 bg-teal-500/10'
                    : 'border-app-line-22 bg-app-line-5/30 hover:border-app-line-32'
                }`}
              >
                <svg className={`h-6 w-6 ${selectedKind === k.kind ? 'text-teal-400' : 'text-app-fg-muted'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={k.icon} />
                </svg>
                <span className={`text-xs font-semibold ${selectedKind === k.kind ? 'text-teal-300' : 'text-app-fg'}`}>{k.label}</span>
                <span className="text-[10px] text-app-fg-muted">{k.desc}</span>
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
            disabled={!selectedKind || confirming}
            className="rounded-lg bg-teal-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-teal-500 disabled:opacity-50"
          >
            {confirming ? 'Confermo...' : 'Conferma categoria'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
