'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import { CircleCheck, Forward, UserPlus } from 'lucide-react'
import { LogActivityDocumentLink } from '@/components/LogActivityDocumentLink'
import LogBlacklistIgnoreButton from '@/components/LogBlacklistIgnoreButton'
import { NewFornitoreLink } from '@/components/NewFornitoreLink'
import { actionButtonClassName } from '@/components/ui/ActionButton'
import { useToast } from '@/lib/toast-context'
import { buildNewFornitorePrefillHref } from '@/lib/new-fornitore-prefill-href'
import { extractEmailFromSenderHeader } from '@/lib/sender-email'
import type { EmailActivityRow } from '@/lib/email-activity-day'
import {
  APP_SECTION_MOBILE_LIST,
  APP_SECTION_TABLE_HEAD_ROW,
  APP_SECTION_TABLE_TH,
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

function ActivityLogStatusCell({ row }: { row: LogRowView }) {
  const k = row.statusKey
  const label = row.statusDisplay
  const iconBase = 'h-4 w-4 shrink-0'
  if (k === 'saved') {
    return (
      <span className="inline-flex items-center gap-2 text-sm text-app-fg">
        <CircleCheck className={`${iconBase} text-emerald-200/90`} strokeWidth={2} aria-hidden />
        <span className="min-w-0">{label}</span>
      </span>
    )
  }
  if (k === 'needs_supplier') {
    return (
      <span className="inline-flex items-center gap-2 text-sm text-app-fg">
        <UserPlus className={`${iconBase} text-amber-200/90`} strokeWidth={2} aria-hidden />
        <span className="min-w-0">{label}</span>
      </span>
    )
  }
  if (k === 'ignored') {
    return (
      <span className="inline-flex items-center gap-2 text-sm text-app-fg">
        <Forward className={`${iconBase} text-app-fg-muted`} strokeWidth={2} aria-hidden />
        <span className="min-w-0">{label}</span>
      </span>
    )
  }
  return <span className="text-sm text-app-fg">{label}</span>
}

function ActivityLogSupplierCell({
  primary,
  docHint,
  pdfLineTemplate,
  primaryClassName,
}: {
  primary: string
  docHint?: string | null
  pdfLineTemplate: string
  /** Default: tabella desktop */
  primaryClassName?: string
}) {
  const hint = typeof docHint === 'string' ? docHint.trim() : ''
  return (
    <div className="min-w-0">
      <span className={primaryClassName ?? 'text-sm font-medium leading-snug text-app-fg'}>{primary}</span>
      {hint ? (
        <span
          className="mt-0.5 block break-words text-xs leading-snug text-app-fg-muted line-clamp-2"
          title={hint}
        >
          {pdfLineTemplate.includes('{name}') ? pdfLineTemplate.replace(/\{name\}/g, hint) : `${pdfLineTemplate} ${hint}`}
        </span>
      ) : null}
    </div>
  )
}

function ElabCell({ row, elab, procLabels }: { row: EmailActivityRow; elab: RowElab; procLabels: ProcLabels }) {
  const id = docId(row)
  if (!id) {
    return <span className="text-sm text-app-fg-muted tabular-nums">{procLabels.dash}</span>
  }

  if (elab.phase === 'idle') {
    return <span className="text-sm text-app-fg-muted">{procLabels.dash}</span>
  }

  if (elab.phase === 'loading') {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-cyan-200/90" title={procLabels.spinAria}>
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
      className={`text-sm block max-w-[14rem] min-w-0 break-words leading-snug md:max-w-none ${bad ? 'text-red-300/95' : good ? 'text-emerald-200/95' : muted ? 'text-amber-200/85' : 'text-app-fg-muted'}`}
      title={text}
    >
      {text}
    </span>
  )
}

function shouldShowElabInline(row: EmailActivityRow, elab: RowElab): boolean {
  return docId(row) != null && (elab.phase === 'loading' || elab.phase === 'done')
}

function TableSupplierWithElab({
  row,
  elab,
  procLabels,
  pdfLineTemplate,
}: {
  row: EmailActivityRow
  elab: RowElab
  procLabels: ProcLabels
  pdfLineTemplate: string
}) {
  const showElab = shouldShowElabInline(row, elab)
  return (
    <div className="min-w-0 space-y-2">
      <ActivityLogSupplierCell
        primary={row.fornitoreNome}
        docHint={row.docDetectedHint}
        pdfLineTemplate={pdfLineTemplate}
      />
      {showElab ? (
        <div className="border-t border-white/[0.06] pt-2">
          <span className="sr-only">
            {procLabels.column}:{' '}
          </span>
          <ElabCell row={row} elab={elab} procLabels={procLabels} />
        </div>
      ) : null}
    </div>
  )
}

function NeedsSupplierRowActions({
  row,
  blacklistSedeFallback,
  tLog,
}: {
  row: LogRowView
  blacklistSedeFallback: string | null
  tLog: {
    activityInboxAddSupplier: string
    activityInboxDiscard: string
    activityDocDiscardedToast: string
    activityNeedEmailOnRow: string
    activityIgnoreSenderDoneToast: string
    blacklistError: string
  }
}) {
  const id = docId(row)
  const router = useRouter()
  const { showToast } = useToast()
  const [discarding, setDiscarding] = useState(false)

  if (row.statusKey !== 'needs_supplier' || !id || !row.mittenteRaw?.trim()) return null

  const sede = row.sedeId?.trim() || blacklistSedeFallback?.trim() || null
  const mitt = row.mittenteRaw.trim()
  const emailOk = (extractEmailFromSenderHeader(mitt) ?? '').includes('@')
  const prefillNome =
    row.docDetectedHint?.trim() ||
    (row.fornitoreNome.trim() && row.fornitoreNome !== '—' ? row.fornitoreNome.trim() : null)

  const newHref = buildNewFornitorePrefillHref({
    prefillNome,
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
        body: JSON.stringify({ id, azione: 'scarta' }),
      })
      const sj = (await sc.json().catch(() => ({}))) as { error?: string }
      if (!sc.ok) {
        showToast(sj.error ?? tLog.blacklistError, 'error')
        return
      }
      showToast(tLog.activityDocDiscardedToast, 'success')
      router.refresh()
    } catch (e) {
      showToast(e instanceof Error ? e.message : tLog.blacklistError, 'error')
    } finally {
      setDiscarding(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {sede && emailOk ? (
        <LogBlacklistIgnoreButton
          mittente={mitt}
          sedeId={sede}
          documentoId={id}
          showLabel
          successMessage={tLog.activityIgnoreSenderDoneToast}
        />
      ) : null}
      {!emailOk ? <p className="text-[10px] text-amber-200/90">{tLog.activityNeedEmailOnRow}</p> : null}
      <NewFornitoreLink
        href={newHref}
        className="inline-flex w-fit items-center gap-1 rounded-md border border-teal-500/40 bg-teal-500/15 px-2 py-1 text-[11px] font-bold text-teal-100 hover:border-teal-400/50 hover:bg-teal-500/25"
      >
        <UserPlus className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
        {tLog.activityInboxAddSupplier}
      </NewFornitoreLink>
      <button
        type="button"
        disabled={discarding}
        onClick={() => void discard()}
        className="w-fit rounded-md border border-app-line-28 bg-white/[0.04] px-2 py-1 text-[11px] font-bold text-app-fg-muted hover:bg-white/[0.07] disabled:opacity-40"
      >
        {tLog.activityInboxDiscard}
      </button>
    </div>
  )
}

export function EmailActivityLogPanel({
  rows,
  summaryLine,
  documentoIds,
  sedeId,
  blacklistSedeFallback,
  tLog,
  procLabels,
}: {
  rows: LogRowView[]
  summaryLine: string
  documentoIds: string[]
  sedeId: string | null
  /** Se `row.sedeId` manca (documento senza sede), usa questo per blacklist «Ignora». */
  blacklistSedeFallback: string | null
  tLog: {
    activityColSupplier: string
    activityPdfDetectedLine: string
    activityColTipo: string
    activityColAmount: string
    activityColStatus: string
    activityColDocument: string
    activityOpenDocument: string
    activityProcessDocumentsCta: string
    activityProcessDocumentsBusy: string
    activityProcessDocumentsNoEligibleInLog: string
    activityProcessDocumentsApiError: string
    activityProcessDocumentsSummary: string
    activityProcessToastDetail: string
    activityQueueEmptyCelebrate: string
    activityLogRowActions: string
    activityInboxIgnoreSender: string
    activityInboxAddSupplier: string
    activityInboxDiscard: string
    activityDocDiscardedToast: string
    activityNeedEmailOnRow: string
    activityIgnoreSenderDoneToast: string
    blacklistError: string
  }
  procLabels: ProcLabels
}) {
  const router = useRouter()
  const { showToast } = useToast()
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
                  <ActivityLogSupplierCell
                    primary={row.fornitoreNome}
                    docHint={row.docDetectedHint}
                    pdfLineTemplate={tLog.activityPdfDetectedLine}
                    primaryClassName="text-sm font-semibold leading-snug text-app-fg"
                  />
                  <p className="mt-0.5 text-xs text-app-fg-muted tabular-nums">{row.timeDisplay}</p>
                </div>
                <span className="shrink-0 text-sm text-app-fg-muted">{row.tipoDisplay}</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/10 pt-3 text-sm">
                <span className="text-app-fg-muted">
                  {tLog.activityColAmount}: <span className="font-medium text-app-fg">{row.amountDisplay}</span>
                </span>
                <ActivityLogStatusCell row={row} />
              </div>
              {shouldShowElabInline(row, elabFor(row)) ? (
                <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-2 text-sm">
                  <span className="sr-only">
                    {procLabels.column}:{' '}
                  </span>
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
              <NeedsSupplierRowActions row={row} blacklistSedeFallback={blacklistSedeFallback} tLog={tLog} />
            </div>
          ))}
        </div>

        <div className="hidden min-w-0 md:block">
          <table className="w-full table-fixed border-collapse text-left text-sm">
            <thead>
              <tr className={APP_SECTION_TABLE_HEAD_ROW}>
                <th className={`${APP_SECTION_TABLE_TH} w-[36%] min-w-0`}>{tLog.activityColSupplier}</th>
                <th className={`${APP_SECTION_TABLE_TH} w-[8%] min-w-0`}>{tLog.activityColTipo}</th>
                <th className={`${APP_SECTION_TABLE_TH} w-[9%] min-w-0 tabular-nums`}>{tLog.activityColAmount}</th>
                <th className={`${APP_SECTION_TABLE_TH} w-[13%] min-w-0`}>{tLog.activityColStatus}</th>
                <th className={`${APP_SECTION_TABLE_TH} w-[14%] min-w-0 whitespace-nowrap`}>
                  {tLog.activityColDocument}
                </th>
                <th className={`${APP_SECTION_TABLE_TH} w-[20%] min-w-0`}>{tLog.activityLogRowActions}</th>
              </tr>
            </thead>
            <tbody className={APP_SECTION_TABLE_TBODY}>
              {rows.map((row, idx) => (
                <tr key={`${row.atIso}-t-${idx}`} className={`align-top ${APP_SECTION_TABLE_TR}`}>
                  <td className="w-[36%] min-w-0 px-4 py-2.5 md:px-5 md:py-3 lg:py-2">
                    <TableSupplierWithElab
                      row={row}
                      elab={elabFor(row)}
                      procLabels={procLabels}
                      pdfLineTemplate={tLog.activityPdfDetectedLine}
                    />
                  </td>
                  <td className="w-[8%] min-w-0 px-4 py-2.5 text-app-fg-muted md:px-5 md:py-3 lg:py-2">{row.tipoDisplay}</td>
                  <td className="w-[9%] min-w-0 whitespace-nowrap px-4 py-2.5 tabular-nums text-app-fg md:px-5 md:py-3 lg:py-2">
                    {row.amountDisplay}
                  </td>
                  <td className="w-[13%] min-w-0 px-4 py-2.5 text-app-fg md:px-5 md:py-3 lg:py-2">
                    <ActivityLogStatusCell row={row} />
                  </td>
                  <td className="w-[14%] min-w-0 px-4 py-2.5 md:px-5 md:py-3 lg:py-2">
                    <LogActivityDocumentLink
                      label={tLog.activityOpenDocument}
                      href={row.href}
                      docOpen={row.docOpen}
                      variant="table"
                    />
                  </td>
                  <td className="w-[20%] min-w-0 px-4 py-2.5 md:px-5 md:py-3 lg:py-2">
                    <NeedsSupplierRowActions row={row} blacklistSedeFallback={blacklistSedeFallback} tLog={tLog} />
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
