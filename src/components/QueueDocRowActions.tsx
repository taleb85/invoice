'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import LogBlacklistIgnoreButton from '@/components/LogBlacklistIgnoreButton'
import { NewFornitoreLink } from '@/components/NewFornitoreLink'
import { buildNewFornitorePrefillHref } from '@/lib/new-fornitore-prefill-href'
import { extractEmailFromSenderHeader } from '@/lib/sender-email'
import { useToast } from '@/lib/toast-context'

export type QueueDocRowActionsDoc = {
  id: string
  mittente: string | null
  sede_id: string | null
  metadata: unknown
  /** Ragione sociale OCR se serve come prefill */
  docNomeHint?: string | null
}

export type QueueDocRowActionsLabels = {
  ignoreDoneToast: string
  addSupplier: string
  discard: string
  discardedToast: string
  needEmail: string
  apiError: string
}

const PENDING_UNMATCHED = new Set(['da_associare', 'da_processare', 'da_revisionare', 'in_attesa'])

export function QueueDocRowActions({
  doc,
  stato,
  fornitoreId,
  labels,
}: {
  doc: QueueDocRowActionsDoc
  stato: string
  fornitoreId: string | null
  labels: QueueDocRowActionsLabels
}) {
  const router = useRouter()
  const { showToast } = useToast()
  const [discarding, setDiscarding] = useState(false)

  const unmatched =
    !fornitoreId && PENDING_UNMATCHED.has(String(stato ?? '').trim()) && !!doc.mittente?.trim()

  if (!unmatched) return null

  const sede = doc.sede_id?.trim() || null
  const mitt = doc.mittente!.trim()
  const nomeHint =
    doc.docNomeHint?.trim() ||
    (() => {
      const m = doc.metadata
      if (m && typeof m === 'object' && !Array.isArray(m)) {
        const r = (m as { ragione_sociale?: string | null }).ragione_sociale
        return typeof r === 'string' ? r.trim() : ''
      }
      return ''
    })()

  const newHref = buildNewFornitorePrefillHref({
    prefillNome: nomeHint || null,
    mittenteHeader: mitt,
    sedeId: sede,
  })

  const discard = async () => {
    setDiscarding(true)
    try {
      const sc = await fetch('/api/documenti-da-processare', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: doc.id, azione: 'scarta' }),
      })
      const sj = (await sc.json().catch(() => ({}))) as { error?: string }
      if (!sc.ok) {
        showToast(sj.error ?? labels.apiError, 'error')
        return
      }
      showToast(labels.discardedToast, 'success')
      router.refresh()
    } catch (e) {
      showToast(e instanceof Error ? e.message : labels.apiError, 'error')
    } finally {
      setDiscarding(false)
    }
  }

  const emailOk = (extractEmailFromSenderHeader(mitt) ?? '').includes('@')

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-white/10 pt-2">
      {sede && emailOk ? (
        <LogBlacklistIgnoreButton
          mittente={mitt}
          sedeId={sede}
          documentoId={doc.id}
          showLabel
          successMessage={labels.ignoreDoneToast}
        />
      ) : null}
      {sede ? (
        <NewFornitoreLink
          href={newHref}
          className="inline-flex items-center rounded-md border border-teal-500/40 bg-teal-500/15 px-2 py-1 text-[10px] font-bold text-teal-100 hover:border-teal-400/50 hover:bg-teal-500/25"
        >
          {labels.addSupplier}
        </NewFornitoreLink>
      ) : (
        <span className="text-[10px] text-amber-200/90">{labels.needEmail}</span>
      )}
      <button
        type="button"
        disabled={discarding}
        onClick={() => void discard()}
        className="rounded-md border border-app-line-28 bg-white/[0.04] px-2 py-1 text-[10px] font-bold text-app-fg-muted hover:bg-white/[0.07] disabled:opacity-40"
      >
        {labels.discard}
      </button>
    </div>
  )
}
