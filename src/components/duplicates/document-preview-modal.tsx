'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { fornitoreNomeMaiuscolo } from '@/lib/fornitore-display'
import { openDocumentUrl } from '@/lib/open-document-url'

type Entity = 'fatture' | 'bolle' | 'fornitori'

// ─── Raw document shapes from API ────────────────────────────────────────────

type FornitoreEmbed = {
  id: string
  nome: string | null
  email: string | null
  piva: string | null
}

type SedeEmbed = {
  id: string
  nome: string | null
}

type FatturaDoc = {
  id: string
  numero_fattura: string | null
  importo: number | null
  data: string | null
  file_url: string | null
  stato?: string | null
  created_at: string
  updated_at?: string | null
  fornitore: FornitoreEmbed | null
  sede: SedeEmbed | null
}

type BollaDoc = {
  id: string
  numero_bolla: string | null
  importo: number | null
  data: string | null
  file_url: string | null
  stato: string | null
  created_at: string
  fatture_count: number
  fornitore: FornitoreEmbed | null
  sede: SedeEmbed | null
}

type FornitoreDoc = {
  id: string
  nome: string | null
  email: string | null
  piva: string | null
  created_at: string
  fatture_count: number
  bolle_count: number
  sede: SedeEmbed | null
}

type DocDetail =
  | { entity: 'fatture'; document: FatturaDoc }
  | { entity: 'bolle'; document: BollaDoc }
  | { entity: 'fornitori'; document: FornitoreDoc }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
      new Date(iso),
    )
  } catch {
    return iso
  }
}

function fmtAmount(n: number | null | undefined): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n)
}

function StatoBadge({ stato }: { stato: string | null | undefined }) {
  if (!stato) return <span className="text-app-fg-muted">—</span>
  const isOk = stato === 'completato' || stato === 'approvato'
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        isOk ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'
      }`}
    >
      {stato}
    </span>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[28px] items-start gap-2">
      <span className="w-32 shrink-0 text-[11px] text-app-fg-muted">{label}</span>
      <span className="min-w-0 flex-1 text-[12px] font-medium text-app-fg">{children}</span>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">
      {children}
    </p>
  )
}

// ─── Entity-specific detail panels ───────────────────────────────────────────

function FatturaDetail({ doc }: { doc: FatturaDoc }) {
  const fileNome = doc.file_url ? doc.file_url.split('/').pop()?.split('?')[0] ?? null : null
  return (
    <div className="space-y-5">
      <div>
        <SectionTitle>Documento</SectionTitle>
        <div className="space-y-1.5">
          <Field label="Numero fattura">{doc.numero_fattura ?? '—'}</Field>
          <Field label="Data documento">{fmtDate(doc.data)}</Field>
          <Field label="Importo">{fmtAmount(doc.importo)}</Field>
          {doc.stato !== undefined && (
            <Field label="Stato approvazione">
              <StatoBadge stato={doc.stato} />
            </Field>
          )}
        </div>
      </div>

      <div className="border-t border-white/10 pt-4">
        <SectionTitle>Fornitore</SectionTitle>
        <div className="space-y-1.5">
          <Field label="Nome">{doc.fornitore?.nome ? fornitoreNomeMaiuscolo(doc.fornitore.nome) : '—'}</Field>
          <Field label="Email">{doc.fornitore?.email ?? '—'}</Field>
          <Field label="P.IVA">{doc.fornitore?.piva ?? '—'}</Field>
        </div>
      </div>

      {doc.sede && (
        <div className="border-t border-white/10 pt-4">
          <SectionTitle>Sede</SectionTitle>
          <div className="space-y-1.5">
            <Field label="Nome sede">{doc.sede.nome ?? '—'}</Field>
          </div>
        </div>
      )}

      <div className="border-t border-white/10 pt-4">
        <SectionTitle>Metadati</SectionTitle>
        <div className="space-y-1.5">
          <Field label="Creato il">{fmtDate(doc.created_at)}</Field>
          {doc.updated_at && <Field label="Aggiornato il">{fmtDate(doc.updated_at)}</Field>}
          <Field label="ID documento">
            <span className="font-mono text-[11px] text-app-fg-muted">{doc.id}</span>
          </Field>
        </div>
      </div>

      {doc.file_url && (
        <div className="border-t border-white/10 pt-4">
          <SectionTitle>Allegato</SectionTitle>
          <a
            href={openDocumentUrl({ fatturaId: doc.id })}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-[rgba(34,211,238,0.2)] bg-[rgba(34,211,238,0.06)] px-3 py-1.5 text-[11px] font-semibold text-[#22d3ee] transition-colors hover:bg-[rgba(34,211,238,0.12)]"
          >
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            {fileNome ?? 'Apri PDF'}
            <svg className="h-3 w-3 shrink-0 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      )}
    </div>
  )
}

function BollaDetail({ doc }: { doc: BollaDoc }) {
  const fileNome = doc.file_url ? doc.file_url.split('/').pop()?.split('?')[0] ?? null : null
  return (
    <div className="space-y-5">
      <div>
        <SectionTitle>Documento</SectionTitle>
        <div className="space-y-1.5">
          <Field label="Numero bolla">{doc.numero_bolla ?? '—'}</Field>
          <Field label="Data documento">{fmtDate(doc.data)}</Field>
          <Field label="Importo">{fmtAmount(doc.importo)}</Field>
          <Field label="Stato">
            <StatoBadge stato={doc.stato} />
          </Field>
          <Field label="Fatture collegate">{doc.fatture_count} fattura{doc.fatture_count !== 1 ? 'e' : ''}</Field>
        </div>
      </div>

      <div className="border-t border-white/10 pt-4">
        <SectionTitle>Fornitore</SectionTitle>
        <div className="space-y-1.5">
          <Field label="Nome">{doc.fornitore?.nome ? fornitoreNomeMaiuscolo(doc.fornitore.nome) : '—'}</Field>
          <Field label="Email">{doc.fornitore?.email ?? '—'}</Field>
          <Field label="P.IVA">{doc.fornitore?.piva ?? '—'}</Field>
        </div>
      </div>

      {doc.sede && (
        <div className="border-t border-white/10 pt-4">
          <SectionTitle>Sede</SectionTitle>
          <div className="space-y-1.5">
            <Field label="Nome sede">{doc.sede.nome ?? '—'}</Field>
          </div>
        </div>
      )}

      <div className="border-t border-white/10 pt-4">
        <SectionTitle>Metadati</SectionTitle>
        <div className="space-y-1.5">
          <Field label="Creato il">{fmtDate(doc.created_at)}</Field>
          <Field label="ID documento">
            <span className="font-mono text-[11px] text-app-fg-muted">{doc.id}</span>
          </Field>
        </div>
      </div>

      {doc.file_url && (
        <div className="border-t border-white/10 pt-4">
          <SectionTitle>Allegato</SectionTitle>
          <a
            href={openDocumentUrl({ bollaId: doc.id })}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-[rgba(34,211,238,0.2)] bg-[rgba(34,211,238,0.06)] px-3 py-1.5 text-[11px] font-semibold text-[#22d3ee] transition-colors hover:bg-[rgba(34,211,238,0.12)]"
          >
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            {fileNome ?? 'Apri PDF'}
            <svg className="h-3 w-3 shrink-0 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      )}
    </div>
  )
}

function FornitoreDetail({ doc }: { doc: FornitoreDoc }) {
  return (
    <div className="space-y-5">
      <div>
        <SectionTitle>Anagrafica</SectionTitle>
        <div className="space-y-1.5">
          <Field label="Nome">{doc.nome ? fornitoreNomeMaiuscolo(doc.nome) : '—'}</Field>
          <Field label="Email">{doc.email ?? '—'}</Field>
          <Field label="P.IVA">{doc.piva ?? '—'}</Field>
        </div>
      </div>

      {doc.sede && (
        <div className="border-t border-white/10 pt-4">
          <SectionTitle>Sede</SectionTitle>
          <div className="space-y-1.5">
            <Field label="Nome sede">{doc.sede.nome ?? '—'}</Field>
          </div>
        </div>
      )}

      <div className="border-t border-white/10 pt-4">
        <SectionTitle>Documenti associati</SectionTitle>
        <div className="space-y-1.5">
          <Field label="Fatture">{doc.fatture_count} fattura{doc.fatture_count !== 1 ? 'e' : ''}</Field>
          <Field label="Bolle">{doc.bolle_count} bolla{doc.bolle_count !== 1 ? '/bolle' : ''}</Field>
        </div>
      </div>

      <div className="border-t border-white/10 pt-4">
        <SectionTitle>Metadati</SectionTitle>
        <div className="space-y-1.5">
          <Field label="Creato il">{fmtDate(doc.created_at)}</Field>
          <Field label="ID fornitore">
            <span className="font-mono text-[11px] text-app-fg-muted">{doc.id}</span>
          </Field>
        </div>
      </div>
    </div>
  )
}

// ─── Modal titles ─────────────────────────────────────────────────────────────

function entityTitle(entity: Entity): string {
  return entity === 'fatture' ? 'Dettaglio fattura' : entity === 'bolle' ? 'Dettaglio bolla' : 'Dettaglio fornitore'
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  open: boolean
  onClose: () => void
  itemId: string | null
  entity: Entity | null
  /** Whether this item is currently selected for deletion. */
  isSelected: boolean
  /** Toggle the item's deletion-selection state and close the modal. */
  onMarkForDeletion: (id: string) => void
}

type FetchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'done'; detail: DocDetail }

export default function DocumentPreviewModal({
  open,
  onClose,
  itemId,
  entity,
  isSelected,
  onMarkForDeletion,
}: Props) {
  const titleId = useId()
  const [fetchState, setFetchState] = useState<FetchState>({ status: 'idle' })
  const prevKey = useRef<string | null>(null)

  // Fetch when open + itemId + entity changes
  useEffect(() => {
    if (!open || !itemId || !entity) return
    const key = `${entity}:${itemId}`
    if (prevKey.current === key && fetchState.status === 'done') return
    prevKey.current = key

    setFetchState({ status: 'loading' })
    const controller = new AbortController()
    fetch(`/api/duplicates/document?id=${encodeURIComponent(itemId)}&entity=${encodeURIComponent(entity)}`, {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async (res) => {
        const json = (await res.json()) as { ok?: boolean; entity?: string; document?: unknown; error?: string }
        if (!res.ok || !json.ok || !json.document) {
          throw new Error(json.error ?? 'Errore durante il caricamento')
        }
        setFetchState({ status: 'done', detail: { entity: json.entity, document: json.document } as DocDetail })
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setFetchState({
          status: 'error',
          message: err instanceof Error ? err.message : 'Errore sconosciuto',
        })
      })

    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, itemId, entity])

  // Reset when closed
  useEffect(() => {
    if (!open) {
      setFetchState({ status: 'idle' })
      prevKey.current = null
    }
  }, [open])

  // Escape key
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open || !itemId || !entity) return null

  const title = entityTitle(entity)

  return createPortal(
    <div
      className="fixed inset-0 z-[285] flex items-center justify-center p-4 app-aurora-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="app-card flex max-h-[80vh] w-full max-w-[600px] flex-col overflow-hidden shadow-[0_0_52px_-12px_rgba(56,189,248,0.22)]">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-sky-400/15 px-5 py-4">
          <h2 id={titleId} className="text-sm font-bold text-app-fg">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-app-fg-muted transition-colors hover:border-white/20 hover:text-app-fg"
            aria-label="Chiudi"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {fetchState.status === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-12" role="status" aria-live="polite">
              <svg className="h-7 w-7 animate-spin text-sky-400/70" fill="none" viewBox="0 0 24 24" aria-hidden>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <p className="text-xs text-app-fg-muted">Caricamento dettagli…</p>
            </div>
          )}

          {fetchState.status === 'error' && (
            <div className="rounded-xl border border-red-500/25 bg-red-950/30 p-4 text-sm text-red-300">
              <p className="font-semibold">Errore</p>
              <p className="mt-1 text-red-300/80">{fetchState.message}</p>
            </div>
          )}

          {fetchState.status === 'done' && (
            <>
              {fetchState.detail.entity === 'fatture' && (
                <FatturaDetail doc={fetchState.detail.document} />
              )}
              {fetchState.detail.entity === 'bolle' && (
                <BollaDetail doc={fetchState.detail.document} />
              )}
              {fetchState.detail.entity === 'fornitori' && (
                <FornitoreDetail doc={fetchState.detail.document} />
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-sky-400/15 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-app-fg-muted transition-colors hover:border-white/25 hover:text-app-fg"
          >
            Chiudi
          </button>
          <button
            type="button"
            onClick={() => {
              onMarkForDeletion(itemId)
              onClose()
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition-colors ${
              isSelected
                ? 'border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20'
                : 'bg-red-600 text-white shadow-[0_0_12px_-4px_rgba(239,68,68,0.5)] hover:bg-red-700'
            }`}
          >
            {isSelected ? (
              <>
                <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Deseleziona
              </>
            ) : (
              <>
                <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Seleziona per eliminazione
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
