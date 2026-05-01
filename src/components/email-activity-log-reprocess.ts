'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useRef, useState } from 'react'
import { useToast } from '@/lib/toast-context'
import type { EmailActivityRow } from '@/lib/email-activity-day'

export type EmailActivityProcOutcomeCode =
  | 'processed_auto'
  | 'processed_revision'
  | 'processed_other'
  | 'processed_rejected_cv'
  | 'error'
  | 'skipped_scartato'
  | 'skipped_no_row_or_sede'
  | 'skipped_no_mittente'
  | 'skipped_no_supplier_match'
  | 'skipped_already_has_ocr'
  | 'pending_next_batch'

export type EmailActivityRowElab =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'done'; code: EmailActivityProcOutcomeCode; detail?: string }

function docId(row: EmailActivityRow): string | null {
  return row.docOpen?.kind === 'documento' ? row.docOpen.id : null
}

type TLogProcessSlice = {
  activityProcessDocumentsCta: string
  activityProcessDocumentsBusy: string
  activityProcessDocumentsNoEligibleInLog: string
  activityProcessDocumentsApiError: string
  activityProcessDocumentsSummary: string
  activityProcessToastDetail: string
  activityQueueEmptyCelebrate: string
}

export function useEmailActivityLogReprocess(opts: {
  documentoIds: string[]
  sedeId: string | null
  tLog: TLogProcessSlice
}) {
  const { documentoIds, sedeId, tLog } = opts
  const router = useRouter()
  const { showToast } = useToast()
  const [busy, setBusy] = useState(false)
  const runningRef = useRef(false)
  const [elabByDoc, setElabByDoc] = useState<Record<string, EmailActivityRowElab>>({})

  const setLoadingForDocs = useCallback(() => {
    const next: Record<string, EmailActivityRowElab> = {}
    for (const id of documentoIds) {
      next[id] = { phase: 'loading' }
    }
    setElabByDoc((prev) => ({ ...prev, ...next }))
  }, [documentoIds])

  const applyOutcomes = useCallback((list: { id: string; code: string; detail?: string }[]) => {
    setElabByDoc((prev) => {
      const n = { ...prev }
      for (const o of list) {
        n[o.id] = { phase: 'done', code: o.code as EmailActivityProcOutcomeCode, detail: o.detail }
      }
      return n
    })
  }, [])

  const run = useCallback(async () => {
    if (documentoIds.length === 0 || runningRef.current) return
    runningRef.current = true
    setBusy(true)
    setLoadingForDocs()
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
        error?: string
        runs?: number
        processed?: number
        skipped?: number
        auto_saved?: number
        da_revisionare?: number
        row_outcomes?: { id: string; code: string; detail?: string }[]
        errors?: { id?: string; message?: string }[]
      }
      if (!res.ok) {
        showToast(`${tLog.activityProcessDocumentsApiError}: ${j.error ?? res.statusText}`, 'error')
        setElabByDoc({})
        return
      }
      const outcomes = j.row_outcomes ?? []
      const runs = j.runs ?? 0
      if (runs === 0 && documentoIds.length > 0) {
        showToast(tLog.activityProcessDocumentsNoEligibleInLog, 'info')
        setElabByDoc({})
      } else if (outcomes.length > 0) {
        applyOutcomes(outcomes)
      }

      const processed = j.processed ?? 0
      const skippedCount = j.skipped ?? 0
      const autoSaved = j.auto_saved ?? 0
      const inRevisione = j.da_revisionare ?? 0
      if (runs > 0) {
        let msg = tLog.activityProcessToastDetail
          .replace(/\{auto\}/g, String(autoSaved))
          .replace(/\{rev\}/g, String(inRevisione))
        const errList = j.errors ?? []
        if (errList.length > 0) {
          msg += ` · ${errList
            .slice(0, 2)
            .map((e) => e.message ?? '')
            .filter(Boolean)
            .join('; ')}`
        }
        if (processed === 0 && autoSaved === 0 && inRevisione === 0 && skippedCount > 0) {
          msg = tLog.activityProcessDocumentsSummary
            .replace(/\{runs\}/g, String(runs))
            .replace(/\{processed\}/g, String(processed))
            .replace(/\{skipped\}/g, String(skippedCount))
        }
        showToast(msg, processed > 0 || autoSaved > 0 ? 'success' : 'info')
        if (runs > 0 && processed === runs && (j.errors?.length ?? 0) === 0 && skippedCount === 0) {
          showToast(tLog.activityQueueEmptyCelebrate, 'success')
        }
      }

      router.refresh()
    } catch (e) {
      showToast(e instanceof Error ? e.message : tLog.activityProcessDocumentsApiError, 'error')
      setElabByDoc({})
    } finally {
      runningRef.current = false
      setBusy(false)
    }
  }, [documentoIds, sedeId, setLoadingForDocs, applyOutcomes, showToast, tLog, router])

  const elabFor = useCallback(
    (row: EmailActivityRow): EmailActivityRowElab => {
      const id = docId(row)
      if (!id) return { phase: 'idle' }
      return elabByDoc[id] ?? { phase: 'idle' }
    },
    [elabByDoc],
  )

  return { busy, run, elabFor }
}

export type EmailActivityLogReprocess = ReturnType<typeof useEmailActivityLogReprocess>
