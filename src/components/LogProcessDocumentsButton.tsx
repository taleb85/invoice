'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { actionButtonClassName } from '@/components/ui/ActionButton'

type LogProcessLabels = {
  cta: string
  busy: string
  noEligibleInLog: string
  summary: string
  apiError: string
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
  const [pending, startTransition] = useTransition()
  const disabled = documentoIds.length === 0 || pending

  const run = () => {
    startTransition(async () => {
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
          errors?: { id?: string; message?: string }[]
          error?: string
        }
        if (!res.ok) {
          window.alert(`${labels.apiError}: ${j.error ?? res.statusText}`)
          return
        }

        const runs = j.runs ?? 0
        const processed = j.processed ?? 0
        const skippedCount = j.skipped ?? 0

        if (runs === 0 && documentoIds.length > 0) {
          window.alert(labels.noEligibleInLog)
        } else if (runs > 0) {
          let summary = labels.summary
            .replace(/\{runs\}/g, String(runs))
            .replace(/\{processed\}/g, String(processed))
            .replace(/\{skipped\}/g, String(skippedCount))

          const errList = j.errors ?? []
          if (errList.length > 0) {
            summary += `\n\n${errList.slice(0, 4).map((e) => `${e.id ?? '?'}: ${e.message ?? ''}`).join('\n')}`
            if (errList.length > 4) summary += '\n…'
          }
          window.alert(summary)
        }

        router.refresh()
      } catch (e) {
        window.alert(e instanceof Error ? e.message : labels.apiError)
      }
    })
  }

  return (
    <button
      type="button"
      disabled={disabled}
      className={`${actionButtonClassName('nav', 'sm')} ${disabled ? 'opacity-50' : ''}`}
      aria-busy={pending}
      title={documentoIds.length === 0 ? labels.noEligibleInLog : labels.cta}
      onClick={() => run()}
    >
      {pending ? labels.busy : labels.cta}
    </button>
  )
}
