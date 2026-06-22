'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useT } from '@/lib/use-t'
import { useLocale } from '@/lib/locale-context'
import { formatDate as formatDateLib, formatCurrency } from '@/lib/locale'
import { SUPPLIER_DETAIL_TAB_HIGHLIGHT } from '@/lib/supplier-detail-tab-theme'

import { DocumentRowActions } from '@/components/DocumentRowActions'
import { OpenDocumentInAppButton } from '@/components/OpenDocumentInAppButton'
import AppSectionEmptyState from '@/components/AppSectionEmptyState'
import { APP_SECTION_MOBILE_LIST } from '@/lib/app-shell-layout'
import {
  APP_SECTION_TABLE_TBODY,
  APP_SECTION_TABLE_THEAD_STICKY,
  APP_SECTION_TABLE_TR,
  SUPPLIER_LEDGER_TABLE,
  SUPPLIER_LEDGER_TABLE_WRAP,
  SUPPLIER_LEDGER_TD,
  SUPPLIER_LEDGER_TD_ACTIONS,
  SUPPLIER_LEDGER_TD_AMOUNT,
  SUPPLIER_LEDGER_TD_DATE,
  SUPPLIER_LEDGER_TH,
  SUPPLIER_LEDGER_TH_AMOUNT,
  SUPPLIER_LEDGER_TH_RIGHT,
  supplierLedgerTableHeadRow,
} from '@/lib/supplier-detail-ledger-table'
import { iconAccentClass as icon } from '@/lib/icon-accent-classes'
import { useToast } from '@/lib/toast-context'

import {
  analyzeOrdineDuplicatesForDeletion,
  ordineExcessIdsForAutoDeletion,
  serializeFatturaDuplicateDeletionPayload,
} from '@/lib/check-duplicates'
import { confermeFileUrlsInUse, deleteConfermaOrdineRow } from '@/lib/conferme-ordine-delete'
import { confermaOrdineDisplayLabel } from '@/lib/extract-doc-type'
import { confermaOrdineImportoTotaleDisplay } from '@/lib/conferme-ordine-importo'
import {
  type ConfermaOrdineListRow,
  confermaOrdineRowToOrdineDupProbe,
  sortConfermeOrdineByDocumentDateDesc,
} from '@/lib/conferme-ordine-query'
import DocumentOcrRefreshButton from '@/components/DocumentOcrRefreshButton'
import { DuplicateLedgerRowExtras } from '@/components/DuplicateLedgerRowExtras'
import {
  documentOcrRefreshTargetId,
  runDocumentOcrRefresh,
  type DocumentOcrRefreshTarget,
} from '@/lib/document-refresh-from-ocr-client'
import { confermeOrdineTableMissingFromApiError } from '@/lib/conferme-ordine-schema'

/**
 * Riga prodotto come salvata in `conferme_ordine.righe` (jsonb).
 * Popolata dal parser Rekki — vedi `src/lib/rekki-parser.ts`.
 */
export type ConfermaOrdineRiga = {
  prodotto?: string | null
  quantita?: number | null
  prezzo_unitario?: number | null
  importo_linea?: number | null
}

/** Alias per compatibilità export; allineato a `ConfermaOrdineListRow`. */
export type ConfermaOrdineRow = ConfermaOrdineListRow

function confermaRowLabel(
  r: Pick<
    ConfermaOrdineListRow,
    'titolo' | 'file_name' | 'numero_ordine' | 'numero_fattura_doc' | 'oggetto_mail'
  >,
) {
  return confermaOrdineDisplayLabel({
    titolo: r.titolo,
    fileName: r.file_name,
    numeroOrdine: r.numero_ordine,
    numeroFatturaMetadata: r.numero_fattura_doc,
    oggettoMail: r.oggetto_mail,
  })
}

/** Sul guscio `supplier-detail-tab-shell` (trasparente): niente `app-workspace-inset-bg`. */

const RED_ACTION_PILL =
  'inline-flex items-center justify-center rounded-lg border border-[rgba(34,211,238,0.15)] bg-transparent px-2 py-1 text-[10px] font-semibold text-red-200/95 shadow-sm ring-1 ring-inset ring-red-400/10 transition-colors hover:border-[rgba(34,211,238,0.15)] hover:bg-red-500/10 hover:text-red-50 disabled:cursor-not-allowed disabled:opacity-40'

const CONFERMA_OCR_ROW_ACTIVE =
  'bg-cyan-500/8 ring-1 ring-inset ring-cyan-400/25'

const CONFERME_OCR_PILL =
  'inline-flex shrink-0 items-center gap-1 rounded-lg border border-app-line-30 bg-transparent px-2 py-1 text-[10px] font-semibold text-app-fg-muted transition-colors hover:border-cyan-500/40 hover:bg-cyan-500/10 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-40'

export default function FornitoreConfermeOrdineTab({
  fornitoreId,
  sedeId,
  countryCode,
  readOnly,
  dateFrom,
  dateToExclusive,
}: {
  fornitoreId: string
  sedeId: string | null
  countryCode?: string | null
  readOnly?: boolean
  /** Periodo header scheda fornitore (inclusivo / esclusivo). */
  dateFrom?: string
  dateToExclusive?: string
}) {
  const t = useT()
  const { locale, timezone, currency } = useLocale()
  const { showToast } = useToast()
  const [rows, setRows] = useState<ConfermaOrdineListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [convertingId, setConvertingId] = useState<string | null>(null)
  const [convertingAll, setConvertingAll] = useState(false)
  const [ocrProgress, setOcrProgress] = useState<{
    index: number
    total: number
    currentId: string
    currentLabel: string
  } | null>(null)
  const sortedRows = useMemo(
    () =>
      sortConfermeOrdineByDocumentDateDesc(
        rows.map((r) => ({
          ...r,
          fornitore_id: fornitoreId,
          numero_fattura_doc: r.numero_fattura_doc ?? null,
          oggetto_mail: r.oggetto_mail ?? null,
          data_ordine_display: r.data_ordine_display ?? null,
        })),
      ),
    [rows, fornitoreId],
  )

  const currentMonthRows = useMemo(() => {
    if (dateFrom && dateToExclusive) {
      return sortedRows.filter((r) => {
        const dateStr = r.data_ordine_display ?? r.data_ordine
        if (!dateStr) return false
        return dateStr >= dateFrom && dateStr < dateToExclusive
      })
    }
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const prefix = `${y}-${m}`
    return sortedRows.filter((r) => {
      const dateStr = r.data_ordine_display ?? r.data_ordine
      if (!dateStr) return false
      return dateStr.startsWith(prefix)
    })
  }, [sortedRows, dateFrom, dateToExclusive])

  const confermeDupPayload = useMemo(() => {
    const analysis = analyzeOrdineDuplicatesForDeletion(
      sortedRows.map((r) => confermaOrdineRowToOrdineDupProbe(r)),
    )
    return serializeFatturaDuplicateDeletionPayload(analysis)
  }, [sortedRows])

  const onConfermaDuplicateRemoved = useCallback((removedId: string) => {
    setRows((prev) => prev.filter((x) => x.id !== removedId))
  }, [])

  const autoDedupeDoneRef = useRef<string | null>(null)

  const safeAutoDeleteIds = useMemo(
    () => ordineExcessIdsForAutoDeletion(sortedRows.map((r) => confermaOrdineRowToOrdineDupProbe(r))),
    [sortedRows],
  )

  useEffect(() => {
    if (loading || readOnly || safeAutoDeleteIds.length === 0) return
    const runKey = `${fornitoreId}|${dateFrom ?? ''}|${dateToExclusive ?? ''}|${safeAutoDeleteIds.join(',')}`
    if (autoDedupeDoneRef.current === runKey) return
    autoDedupeDoneRef.current = runKey

    void (async () => {
      const supabase = createClient()
      const deleteIds = new Set(safeAutoDeleteIds)
      const urlsStillUsed = confermeFileUrlsInUse(rows, deleteIds)
      let deleted = 0
      for (const id of safeAutoDeleteIds) {
        const row = rows.find((r) => r.id === id)
        if (!row) continue
        const { error } = await deleteConfermaOrdineRow(supabase, {
          id,
          fileUrl: row.file_url,
          otherFileUrlsStillInUse: urlsStillUsed,
        })
        if (!error) {
          deleted++
          onConfermaDuplicateRemoved(id)
        }
      }
      if (deleted > 0) {
        showToast(
          t.fornitori.confermeOrdineAutoDedupeDone.replace('{n}', String(deleted)),
          'success',
        )
      }
    })()
  }, [
    loading,
    readOnly,
    safeAutoDeleteIds,
    fornitoreId,
    dateFrom,
    dateToExclusive,
    rows,
    onConfermaDuplicateRemoved,
    showToast,
    t,
  ])

  const confermeTheme = SUPPLIER_DETAIL_TAB_HIGHLIGHT.conferme
  const migrationTheme = SUPPLIER_DETAIL_TAB_HIGHLIGHT.documenti
  const confermeSecondaryClass = 'text-app-fg-muted'

  const fmt = useCallback(
    (iso: string) => formatDateLib(iso, locale, timezone, { day: '2-digit', month: 'short', year: 'numeric' }),
    [locale, timezone],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (dateFrom && dateToExclusive) {
        params.set('from', dateFrom)
        params.set('to', dateToExclusive)
      }
      const qs = params.toString()
      const res = await fetch(
        `/api/fornitori/${encodeURIComponent(fornitoreId)}/conferme-ordine${qs ? `?${qs}` : ''}`,
        { credentials: 'include', cache: 'no-store' },
      )
      if (!res.ok) {
        let msg = res.statusText
        try {
          const j = (await res.json()) as { error?: string }
          if (j.error?.trim()) msg = j.error.trim()
        } catch {
          /* ignore */
        }
        if (confermeOrdineTableMissingFromApiError(msg)) {
          setTableMissing(true)
          setRows([])
        } else {
          setTableMissing(false)
          setError(msg)
          setRows([])
        }
        return
      }
      setTableMissing(false)
      const data = (await res.json()) as ConfermaOrdineListRow[]
      setRows(
        Array.isArray(data)
          ? data.map((r) => ({
              ...r,
              fornitore_id: r.fornitore_id ?? fornitoreId,
              numero_fattura_doc: r.numero_fattura_doc ?? null,
              oggetto_mail: r.oggetto_mail ?? null,
              data_ordine_display: r.data_ordine_display ?? null,
              importo_totale: r.importo_totale ?? null,
            }))
          : [],
      )
    } catch (e) {
      setTableMissing(false)
      setError(e instanceof Error ? e.message : String(e))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [fornitoreId, dateFrom, dateToExclusive])

  useEffect(() => {
    void load()
  }, [load])

  const confermaLabelById = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of sortedRows) {
      const { primary } = confermaRowLabel(r)
      const datePart = (r.data_ordine_display ?? r.data_ordine)
        ? fmt(r.data_ordine_display ?? r.data_ordine!)
        : null
      map.set(r.id, [primary, datePart].filter(Boolean).join(' · '))
    }
    return map
  }, [sortedRows, fmt])

  const refreshBatch = useMemo(
    () =>
      sortedRows
        .filter((r) => r.file_url?.trim())
        .map((r) => ({
          kind: 'conferma' as const,
          confermaId: r.id,
          onDataOrdineUpdated: (d: string) => {
            setRows((prev) =>
              prev.map((row) =>
                row.id === r.id ? { ...row, data_ordine: d, data_ordine_display: d } : row,
              ),
            )
          },
          onNumeroOrdineUpdated: (n: string) => {
            setRows((prev) =>
              prev.map((row) => (row.id === r.id ? { ...row, numero_ordine: n } : row)),
            )
          },
          onImportoTotaleUpdated: (importo: number) => {
            setRows((prev) =>
              prev.map((row) => (row.id === r.id ? { ...row, importo_totale: importo } : row)),
            )
          },
        })),
    [sortedRows],
  )

  const refreshBatchById = useMemo(() => {
    const map = new Map<string, DocumentOcrRefreshTarget>()
    for (const item of refreshBatch) {
      if (item.kind === 'conferma') map.set(item.confermaId, item)
    }
    return map
  }, [refreshBatch])

  const runOcrBatch = useCallback(async () => {
    if (readOnly || refreshBatch.length === 0) return
    const total = refreshBatch.length
    let ok = 0
    let errors = 0
    setOcrProgress({ index: 0, total, currentId: '', currentLabel: '' })
    try {
      for (let i = 0; i < refreshBatch.length; i++) {
        const target = refreshBatch[i] as DocumentOcrRefreshTarget
        const currentId = documentOcrRefreshTargetId(target)
        const currentLabel = confermaLabelById.get(currentId) ?? currentId
        setOcrProgress({ index: i + 1, total, currentId, currentLabel })
        const result = await runDocumentOcrRefresh(target)
        if (result.ok) ok++
        else errors++
      }
      if (ok > 0) await load()
      const doneMsg = t.fornitori.confermeOrdineOcrAutoDone
        .replace('{ok}', String(ok))
        .replace('{total}', String(total))
      showToast(doneMsg, errors > 0 ? 'info' : ok > 0 ? 'success' : 'info')
      if (errors > 0) {
        showToast(t.fatture.refreshAllFromDocErrors.replace('{n}', String(errors)), 'error')
      }
    } catch {
      showToast(t.ui.networkError, 'error')
    } finally {
      setOcrProgress(null)
    }
  }, [readOnly, refreshBatch, confermaLabelById, load, showToast, t])

  const rowOcrClass = (id: string) =>
    ocrProgress?.currentId === id ? CONFERMA_OCR_ROW_ACTIVE : ''

  const renderRowActions = (r: ConfermaOrdineRow) => {
    const ocrTarget = refreshBatchById.get(r.id)
    const actionsLocked = Boolean(ocrProgress)
    return (
      <>
        {ocrTarget && r.file_url?.trim() ? (
          <DocumentOcrRefreshButton
            hasFile
            batch={[ocrTarget]}
            readOnly={readOnly || actionsLocked}
            onLedgerMutated={() => void load()}
            className={CONFERME_OCR_PILL}
          />
        ) : null}
        <button
          type="button"
          disabled={convertingId === r.id || actionsLocked}
          onClick={() => void handleConvertOne(r)}
          className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/25 bg-transparent px-2 py-1 text-[10px] font-semibold text-emerald-400/80 transition-colors hover:bg-emerald-500/10 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {convertingId === r.id ? t.common.loading : '→ Bolla'}
        </button>
        <button
          type="button"
          disabled={deletingId === r.id || actionsLocked}
          onClick={() => void handleDelete(r)}
          className={RED_ACTION_PILL}
        >
          {deletingId === r.id ? t.common.loading : t.common.delete}
        </button>
      </>
    )
  }

  const handleDelete = async (row: ConfermaOrdineRow) => {
    if (!window.confirm(t.fornitori.confermeOrdineDeleteConfirm)) return
    setDeletingId(row.id)
    setError(null)
    const supabase = createClient()
    const excluding = new Set([row.id])
    const { error: delErr } = await deleteConfermaOrdineRow(supabase, {
      id: row.id,
      fileUrl: row.file_url,
      otherFileUrlsStillInUse: confermeFileUrlsInUse(rows, excluding),
    })
    if (delErr) {
      setDeletingId(null)
      setError(`${t.fornitori.confermeOrdineErrDelete}: ${delErr}`)
      return
    }
    setDeletingId(null)
    onConfermaDuplicateRemoved(row.id)
  }

  const callConvertApi = async (ids: string[], updateHint: boolean) => {
    const res = await fetch(`/api/fornitori/${fornitoreId}/converti-ordini-in-bolle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ids, sede_id: sedeId, update_hint: updateHint }),
    })
    const json = await res.json() as { converted?: number; error?: string }
    if (!res.ok || json.error) throw new Error(json.error ?? 'Errore conversione')
    return json.converted ?? 0
  }

  const handleConvertOne = async (row: ConfermaOrdineRow) => {
    setConvertingId(row.id)
    setError(null)
    try {
      await callConvertApi([row.id], false)
      showToast('Documento convertito in bolla', 'success')
      await load()
    } catch (err) {
      setError(String(err))
    } finally {
      setConvertingId(null)
    }
  }

  const handleConvertAll = async () => {
    if (sortedRows.length === 0) return
    setConvertingAll(true)
    setError(null)
    try {
      const n = await callConvertApi([], true)
      showToast(`${n} document${n === 1 ? 'o convertito' : 'i convertiti'} in bolle. Il sistema ha imparato: i prossimi documenti di questo fornitore andranno in Bolle.`, 'success')
      await load()
    } catch (err) {
      setError(String(err))
    } finally {
      setConvertingAll(false)
    }
  }

  if (tableMissing) {
    return (
      <div className={`supplier-detail-tab-shell overflow-hidden ${migrationTheme.border}`}>
        <div className={`app-card-bar-accent ${migrationTheme.bar}`} aria-hidden />
        <div className="border-b border-[rgba(34,211,238,0.15)] bg-transparent px-5 py-4 text-sm text-amber-100/95">
          <p className="font-semibold text-amber-200">{t.fornitori.confermeOrdineMigrationTitle}</p>
          <p className="mt-1.5 text-xs leading-relaxed text-amber-100/85">{t.fornitori.confermeOrdineMigrationHint}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`supplier-detail-tab-shell flex flex-col overflow-hidden ${confermeTheme.border}`}>
      <div className={`app-card-bar-accent ${confermeTheme.bar}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-2 border-b border-app-line-20 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-snug text-app-fg-muted">{t.fornitori.confermeOrdineIntro}</p>
          {!readOnly && sortedRows.length > 0 ? (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              {refreshBatch.length > 0 ? (
                <button
                  type="button"
                  disabled={Boolean(ocrProgress) || loading}
                  onClick={() => void runOcrBatch()}
                  title={t.fatture.refreshAllFromDocTitle}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-app-line-30 bg-app-line-10 px-3 py-1.5 text-[11px] font-semibold text-app-fg-muted transition-colors hover:border-cyan-500/40 hover:bg-cyan-500/10 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {ocrProgress ? (
                    <span className="h-3 w-3 shrink-0 animate-spin rounded-full border border-current border-t-transparent" aria-hidden />
                  ) : (
                    <svg className={`h-3 w-3 shrink-0 ${icon.orders}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  )}
                  <span className="whitespace-nowrap">
                    {ocrProgress
                      ? `${ocrProgress.index}/${ocrProgress.total}`
                      : t.fatture.refreshDateFromDoc}
                  </span>
                </button>
              ) : null}
              <button
                type="button"
                disabled={convertingAll || Boolean(ocrProgress)}
                onClick={() => void handleConvertAll()}
                title="Converti tutti in bolle e impara per i prossimi documenti"
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/8 px-3 py-1.5 text-[11px] font-semibold text-emerald-300 transition-colors hover:border-emerald-400/50 hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {convertingAll ? (
                  <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden>
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                )}
                Converti tutti in bolle
              </button>
            </div>
          ) : null}
        </div>
        {error ? (
          <p className="border-b border-app-line-20 px-5 py-2 text-sm text-red-200/95">{error}</p>
        ) : null}

        {ocrProgress ? (
          <div
            className="border-b border-app-line-20 bg-cyan-500/5 px-5 py-3"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start gap-3">
              <div
                className="mt-0.5 h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-cyan-400/40 border-t-cyan-300"
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-app-fg">
                  {t.fornitori.confermeOrdineOcrAutoProgress
                    .replace('{current}', String(ocrProgress.index))
                    .replace('{total}', String(ocrProgress.total))
                    .replace('{label}', ocrProgress.currentLabel)}
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-app-line-10">
                  <div
                    className="h-full rounded-full bg-cyan-500/70 transition-[width] duration-300"
                    style={{ width: `${(ocrProgress.index / ocrProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="flex justify-center py-14">
            <div
              className="h-9 w-9 animate-spin rounded-full border-2 border-app-line-40 border-t-app-cyan-400"
              aria-hidden
            />
          </div>
        ) : currentMonthRows.length === 0 ? (
          <AppSectionEmptyState
            message={t.fornitori.confermeOrdineEmpty}
            messageClassName={confermeSecondaryClass}
            icon={
              <svg
                className="app-empty-state-icon mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            }
          />
        ) : (
          <>
            <div className={APP_SECTION_MOBILE_LIST}>
              {currentMonthRows.map((r) => (
                <div
                  key={r.id}
                  className={`flex flex-col gap-2 px-4 py-4 transition-colors hover:bg-app-line-5 ${rowOcrClass(r.id)}`}
                >
                  <div className="min-w-0">
                    {(() => {
                      const { primary, secondary } = confermaRowLabel(r)
                      return (
                        <>
                          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-app-fg">
                            <span>{primary}</span>
                            <DuplicateLedgerRowExtras
                              rowId={r.id}
                              payload={confermeDupPayload}
                              kind="ordine"
                              duplicateBadgeLabel={t.common.duplicateBadge}
                              duplicateDeleteConfirm={t.fornitori.confermeOrdineDuplicateCopyDeleteConfirm}
                              removeCopyLabel={t.fatture.duplicateRemoveThisCopy}
                              deleteFailedPrefix={t.appStrings.deleteFailed}
                              refreshRouter={false}
                              onAfterDelete={() => onConfermaDuplicateRemoved(r.id)}
                            />
                          </p>
                          {secondary && (
                            <p className={`text-xs ${confermeSecondaryClass}`}>{secondary}</p>
                          )}
                        </>
                      )
                    })()}
                    {(r.data_ordine_display ?? r.data_ordine) ? (
                      <p className={`mt-0.5 text-xs ${confermeSecondaryClass}`}>
                        {t.fornitori.confermeOrdineOptionalOrderDate}:{' '}
                        {fmt(r.data_ordine_display ?? r.data_ordine!)}
                      </p>
                    ) : null}
                    {(() => {
                      const tot = confermaOrdineImportoTotaleDisplay(r, countryCode)
                      if (tot == null) return null
                      return (
                        <p className={`mt-0.5 font-mono text-xs tabular-nums ${confermeSecondaryClass}`}>
                          {t.statements.colAmount}: {formatCurrency(tot, currency, locale)}
                        </p>
                      )
                    })()}
                    {r.note?.trim() ? <p className={`mt-1 text-xs ${confermeSecondaryClass}`}>{r.note}</p> : null}
                    <p className={`mt-1 text-xs ${confermeSecondaryClass}`}>
                      {t.fornitori.confermeOrdineColRecorded}: {fmt(r.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {r.file_url?.trim() ? (
                      <DocumentRowActions
                        item={{
                          id: r.id,
                          origine: 'documento_da_processare',
                          fornitore_id: fornitoreId,
                          file_url: r.file_url,
                        }}
                        confermaOrdineId={r.id}
                        fileUrl={r.file_url}
                        fornitoreId={fornitoreId}
                        hideActionsButton
                        categoria={confermaRowLabel(r).secondary ?? t.fornitori.tabConfermeOrdine}
                      />
                    ) : null}
                    {!readOnly ? <div className="flex flex-wrap items-center gap-2">{renderRowActions(r)}</div> : null}
                  </div>
                </div>
              ))}
            </div>

            <div className={SUPPLIER_LEDGER_TABLE_WRAP}>
              <table className={SUPPLIER_LEDGER_TABLE}>
                <thead className={APP_SECTION_TABLE_THEAD_STICKY}>
                  <tr className={supplierLedgerTableHeadRow('conferme')}>
                    <th className={SUPPLIER_LEDGER_TH}>{t.common.date}</th>
                    <th className={SUPPLIER_LEDGER_TH}>{t.fornitori.confermeOrdineColFile}</th>
                    <th className={SUPPLIER_LEDGER_TH_AMOUNT}>{t.statements.colAmount}</th>
                    <th className={SUPPLIER_LEDGER_TH_RIGHT}>{t.common.actions}</th>
                  </tr>
                </thead>
                <tbody className={APP_SECTION_TABLE_TBODY}>
                  {currentMonthRows.map((r) => (
                    <tr key={r.id} className={`${APP_SECTION_TABLE_TR} ${rowOcrClass(r.id)}`}>
                      <td className={SUPPLIER_LEDGER_TD_DATE}>
                        {r.data_ordine_display ?? r.data_ordine
                          ? fmt(r.data_ordine_display ?? r.data_ordine!)
                          : '—'}
                      </td>
                      <td className={SUPPLIER_LEDGER_TD}>
                        <OpenDocumentInAppButton
                          confermaOrdineId={r.id}
                          fileUrl={r.file_url}
                          className="block max-w-[22rem] text-left hover:underline underline-offset-2 font-medium text-app-fg hover:text-app-cyan-300 transition-colors"
                          title={r.titolo?.trim() || r.file_name || undefined}
                          stopTriggerPropagation
                          categoria={confermaRowLabel(r).secondary ?? t.fornitori.tabConfermeOrdine}
                        >
                          {(() => {
                            const { primary, secondary } = confermaRowLabel(r)
                            return (
                              <>
                                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                  <span className="truncate" title={r.titolo?.trim() || r.file_name || undefined}>
                                    {primary}
                                  </span>
                                  <DuplicateLedgerRowExtras
                                    rowId={r.id}
                                    payload={confermeDupPayload}
                                    kind="ordine"
                                    duplicateBadgeLabel={t.common.duplicateBadge}
                                    duplicateDeleteConfirm={t.fornitori.confermeOrdineDuplicateCopyDeleteConfirm}
                                    removeCopyLabel={t.fatture.duplicateRemoveThisCopy}
                                    deleteFailedPrefix={t.appStrings.deleteFailed}
                                    refreshRouter={false}
                                    onAfterDelete={() => onConfermaDuplicateRemoved(r.id)}
                                  />
                                </span>
                                {secondary && (
                                  <span className={`mt-0.5 block truncate text-xs font-normal ${confermeSecondaryClass}`}>
                                    {secondary}
                                  </span>
                                )}
                                {r.note?.trim() ? (
                                  <span className={`mt-0.5 block truncate text-xs font-normal ${confermeSecondaryClass}`} title={r.note}>
                                    {r.note}
                                  </span>
                                ) : null}
                              </>
                            )
                          })()}
                        </OpenDocumentInAppButton>
                      </td>
                      <td className={SUPPLIER_LEDGER_TD_AMOUNT}>
                        {(() => {
                          const tot = confermaOrdineImportoTotaleDisplay(r, countryCode)
                          return tot != null ? formatCurrency(tot, currency, locale) : '—'
                        })()}
                      </td>
                      <td className={SUPPLIER_LEDGER_TD_ACTIONS}>
                        <div className="inline-flex flex-wrap items-center justify-end gap-2">
                          {r.file_url?.trim() ? (
                            <DocumentRowActions
                              item={{
                                id: r.id,
                                origine: 'documento_da_processare',
                                fornitore_id: fornitoreId,
                                file_url: r.file_url,
                              }}
                              confermaOrdineId={r.id}
                              fileUrl={r.file_url}
                              fornitoreId={fornitoreId}
                              readOnly={readOnly}
                              hideActionsButton
                              categoria={confermaRowLabel(r).secondary ?? t.fornitori.tabConfermeOrdine}
                            />
                          ) : (
                            <span className={`text-xs ${confermeSecondaryClass}`}>—</span>
                          )}
                          {!readOnly ? renderRowActions(r) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
