'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import { LogActivityDocumentLink } from '@/components/LogActivityDocumentLink'
import { actionButtonClassName } from '@/components/ui/ActionButton'
import type { EmailActivityRow } from '@/lib/email-activity-day'
import {
  APP_SECTION_MOBILE_LIST,
  APP_SECTION_TABLE_HEAD_ROW,
  APP_SECTION_TABLE_TBODY,
  APP_SECTION_TABLE_TR,
} from '@/lib/app-shell-layout'

export type LogRowView = EmailActivityRow & {
  amountDisplay: string
  timeDisplay: string
  tipoDisplay: string
  statusDisplay: string
}

type ProcOutcomeCode =
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

type RowElab =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'done'; code: ProcOutcomeCode; detail?: string }

export type ProcLabels = {
  column: string
  spinAria: string
  processedAuto: string
  processedRevision: string
  processedOther: string
  outcomeError: string
  skippedScartato: string
  skippedNoRowOrSede: string
  skippedNoMittente: string
  skippedNoSupplier: string
  skippedHasOcr: string
  pendingBatch: string
  rejectedCv: string
  dash: string
}

function docId(row: EmailActivityRow): string | null {
  return row.docOpen?.kind === 'documento' ? row.docOpen.id : null
}

function labelForOutcome(code: ProcOutcomeCode, detail: string | undefined, L: ProcLabels): string {
  const d = detail?.trim()
  switch (code) {
    case 'processed_auto':
      return L.processedAuto
    case 'processed_revision':
      return L.processedRevision
    case 'processed_other':
      return L.processedOther
    case 'processed_rejected_cv':
      return L.rejectedCv
    case 'error':
      return d ? `${L.outcomeError}: ${d.slice(0, 120)}` : L.outcomeError
    case 'skipped_scartato':
      return L.skippedScartato
    case 'skipped_no_row_or_sede':
      return L.skippedNoRowOrSede
    case 'skipped_no_mittente':
      return L.skippedNoMittente
    case 'skipped_no_supplier_match':
      return L.skippedNoSupplier
    case 'skipped_already_has_ocr':
      return L.skippedHasOcr
    case 'pending_next_batch':
      return L.pendingBatch
    default:
      return L.dash
  }
}

function ElabCell({ row, elab, procLabels }: { row: EmailActivityRow; elab: RowElab; procLabels: ProcLabels }) {
  const id = docId(row)
  if (!id) {
    return <span className="text-app-fg-muted tabular-nums">{procLabels.dash}</span>
  }

  if (elab.phase === 'idle') {
    return <span className="text-app-fg-muted">{procLabels.dash}</span>
  }

  if (elab.phase === 'loading') {
    return (
      <span className="inline-flex items-center gap-1.5 text-cyan-200/90" title={procLabels.spinAria}>
        <svg className="h-4 w-4 shrink-0 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-90"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </span>
    )
  }

  const text = labelForOutcome(elab.code, elab.detail, procLabels)
  const good =
    elab.code === 'processed_auto' ||
    elab.code === 'processed_other' ||
    elab.code === 'processed_revision' ||
    elab.code === 'processed_rejected_cv'
  const bad = elab.code === 'error'
  const muted = elab.code === 'pending_next_batch'

  return (
    <span
      className={`block max-w-[14rem] min-w-0 break-words leading-snug md:max-w-none ${bad ? 'text-red-300/95' : good ? 'text-emerald-200/95' : muted ? 'text-amber-200/85' : 'text-app-fg-muted'}`}
      title={text}
    >
      {text}
    </span>
  )
}

export function EmailActivityLogPanel({
  rows,
  summaryLine,
  documentoIds,
  sedeId,
  tLog,
  procLabels,
}: {
  rows: LogRowView[]
  summaryLine: string
  documentoIds: string[]
  sedeId: string | null
  tLog: {
    activityColSupplier: string
    activityColTipo: string
    activityColAmount: string
    activityColStatus: string
    activityOpenDocument: string
    activityProcessDocumentsCta: string
    activityProcessDocumentsBusy: string
    activityProcessDocumentsNoEligibleInLog: string
    activityProcessDocumentsApiError: string
  }
  procLabels: ProcLabels
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [elabByDoc, setElabByDoc] = useState<Record<string, RowElab>>({})

  const setLoadingForDocs = useCallback(() => {
    const next: Record<string, RowElab> = {}
    for (const id of documentoIds) {
      next[id] = { phase: 'loading' }
    }
    setElabByDoc((prev) => ({ ...prev, ...next }))
  }, [documentoIds])

  const applyOutcomes = useCallback((list: { id: string; code: string; detail?: string }[]) => {
    setElabByDoc((prev) => {
      const n = { ...prev }
      for (const o of list) {
        n[o.id] = { phase: 'done', code: o.code as ProcOutcomeCode, detail: o.detail }
      }
      return n
    })
  }, [])

  const run = async () => {
    if (documentoIds.length === 0 || busy) return
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
        row_outcomes?: { id: string; code: string; detail?: string }[]
      }
      if (!res.ok) {
        window.alert(`${tLog.activityProcessDocumentsApiError}: ${j.error ?? res.statusText}`)
        setElabByDoc({})
        return
      }
      const outcomes = j.row_outcomes ?? []
      if (outcomes.length > 0) {
        applyOutcomes(outcomes)
      } else if (documentoIds.length > 0) {
        window.alert(tLog.activityProcessDocumentsNoEligibleInLog)
        setElabByDoc({})
      }
      router.refresh()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : tLog.activityProcessDocumentsApiError)
      setElabByDoc({})
    } finally {
      setBusy(false)
    }
  }

  const elabFor = (row: EmailActivityRow): RowElab => {
    const id = docId(row)
    if (!id) return { phase: 'idle' }
    return elabByDoc[id] ?? { phase: 'idle' }
  }

  const btnDisabled = documentoIds.length === 0 || busy

  return (
    <div className="app-card flex flex-col overflow-hidden">
      <div className="app-card-bar" aria-hidden />
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] px-4 py-3 md:px-5">
        <p className="min-w-0 flex-1 text-sm text-app-fg">{summaryLine}</p>
        <button
          type="button"
          disabled={btnDisabled}
          className={`${actionButtonClassName('nav', 'sm')} ${btnDisabled ? 'opacity-50' : ''}`}
          aria-busy={busy}
          title={documentoIds.length === 0 ? tLog.activityProcessDocumentsNoEligibleInLog : tLog.activityProcessDocumentsCta}
          onClick={() => void run()}
        >
          {busy ? tLog.activityProcessDocumentsBusy : tLog.activityProcessDocumentsCta}
        </button>
      </div>
      <div className="min-w-0 flex-1">
        <div className={APP_SECTION_MOBILE_LIST}>
          {rows.map((row, idx) => (
            <div key={`${row.atIso}-${idx}`} className="space-y-3 px-4 py-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-snug text-app-fg">{row.fornitoreNome}</p>
                  <p className="mt-0.5 text-[10px] text-app-fg-muted tabular-nums">{row.timeDisplay}</p>
                </div>
                <span className="shrink-0 text-xs text-app-fg-muted">{row.tipoDisplay}</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/10 pt-3 text-xs">
                <span className="text-app-fg-muted">
                  {tLog.activityColAmount}: <span className="font-medium text-app-fg">{row.amountDisplay}</span>
                </span>
                <span className="text-app-fg-muted">{row.statusDisplay}</span>
              </div>
              {docId(row) ? (
                <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-2 text-[11px]">
                  <span className="shrink-0 font-medium text-app-fg-muted">{procLabels.column}:</span>
                  <ElabCell row={row} elab={elabFor(row)} procLabels={procLabels} />
                </div>
              ) : null}
              {row.href || row.docOpen ? (
                <LogActivityDocumentLink
                  label={tLog.activityOpenDocument}
                  href={row.href}
                  docOpen={row.docOpen}
                  variant="mobile"
                />
              ) : null}
            </div>
          ))}
        </div>

        <div className="hidden min-w-0 md:block">
          <table className="w-full table-fixed border-collapse text-left text-xs">
            <thead>
              <tr className={APP_SECTION_TABLE_HEAD_ROW}>
                <th className="min-w-0 px-2 py-2 font-semibold text-app-fg-muted sm:px-3">{tLog.activityColSupplier}</th>
                <th className="w-[11%] min-w-0 px-2 py-2 font-semibold text-app-fg-muted sm:px-3">{tLog.activityColTipo}</th>
                <th className="w-[12%] min-w-0 px-2 py-2 font-semibold text-app-fg-muted sm:px-3">{tLog.activityColAmount}</th>
                <th className="min-w-0 px-2 py-2 font-semibold text-app-fg-muted sm:px-3">{tLog.activityColStatus}</th>
                <th className="w-[min(18rem,22%)] min-w-0 px-2 py-2 font-semibold text-app-fg-muted sm:px-3">{procLabels.column}</th>
                <th className="w-[14%] min-w-0 whitespace-nowrap px-2 py-2 font-semibold text-app-fg-muted sm:px-3">
                  {tLog.activityOpenDocument}
                </th>
              </tr>
            </thead>
            <tbody className={APP_SECTION_TABLE_TBODY}>
              {rows.map((row, idx) => (
                <tr key={`${row.atIso}-t-${idx}`} className={`align-top ${APP_SECTION_TABLE_TR}`}>
                  <td className="min-w-0 px-2 py-2 font-medium text-app-fg sm:px-3">{row.fornitoreNome}</td>
                  <td className="min-w-0 px-2 py-2 text-app-fg-muted sm:px-3">{row.tipoDisplay}</td>
                  <td className="min-w-0 whitespace-nowrap px-2 py-2 tabular-nums text-app-fg sm:px-3">{row.amountDisplay}</td>
                  <td className="min-w-0 px-2 py-2 text-app-fg sm:px-3">{row.statusDisplay}</td>
                  <td className="min-w-0 px-2 py-2 sm:px-3">
                    <ElabCell row={row} elab={elabFor(row)} procLabels={procLabels} />
                  </td>
                  <td className="min-w-0 px-2 py-2 sm:px-3">
                    <LogActivityDocumentLink
                      label={tLog.activityOpenDocument}
                      href={row.href}
                      docOpen={row.docOpen}
                      variant="table"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
