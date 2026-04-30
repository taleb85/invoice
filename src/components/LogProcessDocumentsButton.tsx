'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useToast } from '@/lib/toast-context'
import { actionButtonClassName } from '@/components/ui/ActionButton'

type LogProcessLabels = {
  cta: string
  busy: string
  noEligibleInLog: string
  summary: string
  apiError: string
  /** Toast: `{auto}` e `{rev}` da sostituire */
  toastDetail: string
  queueEmpty: string
}

export function LogProcessDocumentsButton({
  documentoIds,
  sedeId,
  labels,
}: {
  documentoIds: string[]
  sedeId: string | null
  labels: LogProcessLabels
}) {
  const router = useRouter()
  const { showToast } = useToast()
  const [pending, setPending] = useState(false)
  const disabled = documentoIds.length === 0 || pending

  const run = async () => {
    if (documentoIds.length === 0 || pending) return
    setPending(true)
    try {
      const res = await fetch('/api/admin/reprocess-log-documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          doc_ids: documentoIds,
          ...(sedeId ? { sede_id: sedeId } : {}),
        }),
      })
      const j = (await res.json()) as {
        ok?: boolean
        runs?: number
        processed?: number
        skipped?: number
        auto_saved?: number
        da_revisionare?: number
        errors?: { id?: string; message?: string }[]
        error?: string
        row_outcomes?: unknown[]
      }
      if (!res.ok) {
        showToast(`${labels.apiError}: ${j.error ?? res.statusText}`, 'error')
        return
      }

      const runs = j.runs ?? 0
      const processed = j.processed ?? 0
      const skippedCount = j.skipped ?? 0
      const autoSaved = j.auto_saved ?? 0
      const inRevisione = j.da_revisionare ?? 0

      if (runs === 0 && documentoIds.length > 0) {
        showToast(labels.noEligibleInLog, 'info')
      } else if (runs > 0) {
        let msg = labels.toastDetail
          .replace(/\{auto\}/g, String(autoSaved))
          .replace(/\{rev\}/g, String(inRevisione))

        const errList = j.errors ?? []
        if (errList.length > 0) {
          msg += ` · ${errList
            .slice(0, 2)
            .map((e) => e.message ?? '')
            .filter(Boolean)
            .join('; ')}`
          if (errList.length > 2) msg += '…'
        }

        if (processed === 0 && autoSaved === 0 && inRevisione === 0 && skippedCount > 0) {
          msg = labels.summary
            .replace(/\{runs\}/g, String(runs))
            .replace(/\{processed\}/g, String(processed))
            .replace(/\{skipped\}/g, String(skippedCount))
        }

        showToast(msg, processed > 0 || autoSaved > 0 ? 'success' : 'info')

        if (
          runs > 0 &&
          processed === runs &&
          (j.errors?.length ?? 0) === 0 &&
          skippedCount === 0
        ) {
          showToast(labels.queueEmpty, 'success')
        }
      }

      router.refresh()
    } catch (e) {
      showToast(e instanceof Error ? e.message : labels.apiError, 'error')
    } finally {
      setPending(false)
    }
  }

  return (
    <button
      type="button"
      disabled={disabled}
      className={`${actionButtonClassName('nav', 'sm')} ${disabled ? 'opacity-50' : ''}`}
      aria-busy={pending}
      title={documentoIds.length === 0 ? labels.noEligibleInLog : labels.cta}
      onClick={() => void run()}
    >
      {pending ? labels.busy : labels.cta}
    </button>
  )
}
