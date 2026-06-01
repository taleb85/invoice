'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/utils/supabase/client'
import { useT } from '@/lib/use-t'
import { useLocale } from '@/lib/locale-context'
import { formatDate as formatDateLib, formatCurrency } from '@/lib/locale'
import { SUPPLIER_DETAIL_TAB_HIGHLIGHT } from '@/lib/supplier-detail-tab-theme'

import { OpenDocumentInAppButton } from '@/components/OpenDocumentInAppButton'
import AppSectionEmptyState from '@/components/AppSectionEmptyState'
import { APP_SECTION_MOBILE_LIST, APP_SECTION_TABLE_TBODY, APP_SECTION_TABLE_TR } from '@/lib/app-shell-layout'
import { iconAccentClass as icon } from '@/lib/icon-accent-classes'
import { useToast } from '@/lib/toast-context'

import {
  analyzeOrdineDuplicatesForDeletion,
  serializeFatturaDuplicateDeletionPayload,
} from '@/lib/check-duplicates'
import { confermaOrdineDisplayLabel } from '@/lib/extract-doc-type'
import {
  confermaOrdineRowToOrdineDupProbe,
  sortConfermeOrdineByDocumentDateDesc,
} from '@/lib/conferme-ordine-query'
import { DuplicateLedgerRowExtras } from '@/components/DuplicateLedgerRowExtras'

const SupplierDocumentOcrToolbar = dynamic(
  () => import('@/components/SupplierDocumentOcrToolbar'),
  { ssr: false, loading: () => null },
)
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

export type ConfermaOrdineRow = {
  id: string
  file_url: string
  file_name: string | null
  titolo: string | null
  numero_ordine?: string | null
  numero_fattura_doc?: string | null
  oggetto_mail?: string | null
  data_ordine: string | null
  data_ordine_display?: string | null
  note: string | null
  created_at: string
  righe: ConfermaOrdineRiga[] | null
}

function confermaRowLabel(r: ConfermaOrdineRow) {
  return confermaOrdineDisplayLabel({
    titolo: r.titolo,
    fileName: r.file_name,
    numeroOrdine: r.numero_ordine,
    numeroFatturaMetadata: r.numero_fattura_doc,
    oggettoMail: r.oggetto_mail,
  })
}

/**
 * Somma `importo_linea` su tutte le righe della conferma.
 * Restituisce `null` se non c'è alcun importo numerico valido (per render `—`).
 */
function sumRigheImporto(righe: ConfermaOrdineRiga[] | null | undefined): number | null {
  if (!Array.isArray(righe) || righe.length === 0) return null
  let total = 0
  let found = false
  for (const r of righe) {
    const v = typeof r?.importo_linea === 'number' ? r.importo_linea : null
    if (v !== null && Number.isFinite(v)) {
      total += v
      found = true
    }
  }
  return found ? Math.round(total * 100) / 100 : null
}

/** Sul guscio `supplier-detail-tab-shell` (trasparente): niente `app-workspace-inset-bg`. */
const CONFERME_TABLE_HEAD_ROW = 'border-b border-app-soft-border bg-transparent'

/** Apri PDF: contorno rosa, fill trasparente. */
const CONFERME_OPEN_PILL =
  'inline-flex items-center gap-1 rounded-lg border border-app-line-25 bg-transparent px-2 py-1 text-[10px] font-semibold text-app-fg-muted transition-colors hover:bg-app-line-10 hover:text-app-fg'

const RED_ACTION_PILL =
  'inline-flex items-center justify-center rounded-lg border border-[rgba(34,211,238,0.15)] bg-transparent px-2 py-1 text-[10px] font-semibold text-red-200/95 shadow-sm ring-1 ring-inset ring-red-400/10 transition-colors hover:border-[rgba(34,211,238,0.15)] hover:bg-red-500/10 hover:text-red-50 disabled:cursor-not-allowed disabled:opacity-40'

function pathFromDocumentiPublicUrl(url: string): string | null {
  try {
    const u = new URL(url)
    const marker = '/object/public/documenti/'
    const i = u.pathname.indexOf(marker)
    if (i === -1) return null
    return decodeURIComponent(u.pathname.slice(i + marker.length))
  } catch {
    return null
  }
}

export default function FornitoreConfermeOrdineTab({
  fornitoreId,
  sedeId,
  readOnly,
  dateFrom,
  dateToExclusive,
}: {
  fornitoreId: string
  sedeId: string | null
  readOnly?: boolean
  /** Periodo header scheda fornitore (inclusivo / esclusivo). */
  dateFrom?: string
  dateToExclusive?: string
}) {
  const t = useT()
  const { locale, timezone, currency } = useLocale()
  const { showToast } = useToast()
  const [rows, setRows] = useState<ConfermaOrdineRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [convertingId, setConvertingId] = useState<string | null>(null)
  const [convertingAll, setConvertingAll] = useState(false)
  const [toolbarConfermaId, setToolbarConfermaId] = useState('')

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

  const confermeDupPayload = useMemo(() => {
    const analysis = analyzeOrdineDuplicatesForDeletion(
      sortedRows.map((r) => confermaOrdineRowToOrdineDupProbe(r)),
    )
    return serializeFatturaDuplicateDeletionPayload(analysis)
  }, [sortedRows])

  const onConfermaDuplicateRemoved = useCallback((removedId: string) => {
    setRows((prev) => prev.filter((x) => x.id !== removedId))
  }, [])

  const confermeTheme = SUPPLIER_DETAIL_TAB_HIGHLIGHT.conferme
  const migrationTheme = SUPPLIER_DETAIL_TAB_HIGHLIGHT.documenti
  const confermeSecondaryClass = 'text-app-fg-muted'

  const fmt = useCallback(
    (iso: string) => formatDateLib(iso, locale, timezone, { day: '2-digit', month: 'short', year: 'numeric' }),
    [locale, timezone],
  )

  const pdfOpenTrigger = (
    <>
      <svg className={`h-3 w-3 ${icon.orders}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
        />
      </svg>
      {t.fornitori.confermeOrdineOpen}
    </>
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
      const data = (await res.json()) as ConfermaOrdineRow[]
      setRows(Array.isArray(data) ? data : [])
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

  const toolbarChoices = useMemo(
    () =>
      sortedRows.map((r) => {
        const { primary } = confermaRowLabel(r)
        const datePart = (r.data_ordine_display ?? r.data_ordine)
          ? fmt(r.data_ordine_display ?? r.data_ordine!)
          : null
        return {
          id: r.id,
          label: [primary, datePart].filter(Boolean).join(' · '),
          hasFile: Boolean(r.file_url?.trim()),
        }
      }),
    [sortedRows, fmt],
  )

  const rowsWithFile = useMemo(() => toolbarChoices.filter((c) => c.hasFile), [toolbarChoices])

  useEffect(() => {
    if (!rowsWithFile.length) {
      setToolbarConfermaId('')
      return
    }
    setToolbarConfermaId((prev) =>
      rowsWithFile.some((c) => c.id === prev) ? prev : rowsWithFile[0]!.id,
    )
  }, [rowsWithFile])

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
        })),
    [sortedRows],
  )

  const handleDelete = async (row: ConfermaOrdineRow) => {
    if (!window.confirm(t.fornitori.confermeOrdineDeleteConfirm)) return
    setDeletingId(row.id)
    setError(null)
    const supabase = createClient()
    const { error: delErr } = await supabase.from('conferme_ordine').delete().eq('id', row.id)
    if (delErr) {
      setDeletingId(null)
      setError(`${t.fornitori.confermeOrdineErrDelete}: ${delErr.message}`)
      return
    }
    const path = pathFromDocumentiPublicUrl(row.file_url)
    if (path) {
      await supabase.storage.from('documenti').remove([path]).catch(() => {})
    }
    setDeletingId(null)
    await load()
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
      <div className={`supplier-detail-tab-shell mt-4 overflow-hidden ${migrationTheme.border}`}>
        <div className={`app-card-bar-accent ${migrationTheme.bar}`} aria-hidden />
        <div className="border-b border-[rgba(34,211,238,0.15)] bg-transparent px-5 py-4 text-sm text-amber-100/95">
          <p className="font-semibold text-amber-200">{t.fornitori.confermeOrdineMigrationTitle}</p>
          <p className="mt-1.5 text-xs leading-relaxed text-amber-100/85">{t.fornitori.confermeOrdineMigrationHint}</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {!readOnly && rowsWithFile.length > 0 && toolbarConfermaId ? (
        <div className="mb-4">
          <SupplierDocumentOcrToolbar
            choices={rowsWithFile}
            selectedId={toolbarConfermaId}
            onSelectedIdChange={setToolbarConfermaId}
            refreshBatch={refreshBatch}
            readOnly={readOnly}
            onLedgerMutated={() => void load()}
          />
        </div>
      ) : null}
    <div className={`supplier-detail-tab-shell mt-4 flex flex-col overflow-hidden ${confermeTheme.border}`}>
      <div className={`app-card-bar-accent ${confermeTheme.bar}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-2 border-b border-app-line-20 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-relaxed text-app-fg">{t.fornitori.confermeOrdineIntro}</p>
          {!readOnly && sortedRows.length > 0 ? (
            <button
              type="button"
              disabled={convertingAll}
              onClick={() => void handleConvertAll()}
              title="Converti tutti in bolle e impara per i prossimi documenti"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/8 px-3 py-1.5 text-[11px] font-semibold text-emerald-300 transition-colors hover:border-emerald-400/50 hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-40"
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
          ) : null}
        </div>
        {error ? (
          <p className="border-b border-app-line-20 px-5 py-2 text-sm text-red-200/95">{error}</p>
        ) : null}

        {loading ? (
          <div className="flex justify-center py-14">
            <div
              className="h-9 w-9 animate-spin rounded-full border-2 border-app-line-40 border-t-app-cyan-400"
              aria-hidden
            />
          </div>
        ) : sortedRows.length === 0 ? (
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
              {sortedRows.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-col gap-2 px-4 py-4 transition-colors hover:bg-app-line-5"
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
                      const tot = sumRigheImporto(r.righe)
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
                    <OpenDocumentInAppButton
                      confermaOrdineId={r.id}
                      fileUrl={r.file_url}
                      className={CONFERME_OPEN_PILL}
                      categoria={confermaRowLabel(r).secondary ?? t.fornitori.tabConfermeOrdine}
                    >
                      {pdfOpenTrigger}
                    </OpenDocumentInAppButton>
                    {!readOnly ? (
                    <>
                      <button
                        type="button"
                        disabled={convertingId === r.id}
                        onClick={() => void handleConvertOne(r)}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/25 bg-transparent px-2 py-1 text-[10px] font-semibold text-emerald-400/80 transition-colors hover:bg-emerald-500/10 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {convertingId === r.id ? t.common.loading : '→ Bolla'}
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === r.id}
                        onClick={() => void handleDelete(r)}
                        className={RED_ACTION_PILL}
                      >
                        {deletingId === r.id ? t.common.loading : t.common.delete}
                      </button>
                    </>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className={CONFERME_TABLE_HEAD_ROW}>
                    <th
                      className={`px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest ${confermeTheme.label}`}
                    >
                      {t.common.date}
                    </th>
                    <th
                      className={`px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest ${confermeTheme.label}`}
                    >
                      {t.fornitori.confermeOrdineColFile}
                    </th>
                    <th
                      className={`px-5 py-2.5 text-right font-mono text-[10px] font-bold uppercase tracking-widest tabular-nums ${confermeTheme.label}`}
                    >
                      {t.statements.colAmount}
                    </th>
                    <th
                      className={`px-5 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest ${confermeTheme.label}`}
                    >
                      {t.common.actions}
                    </th>
                  </tr>
                </thead>
                <tbody className={APP_SECTION_TABLE_TBODY}>
                  {sortedRows.map((r) => (
                    <tr key={r.id} className={APP_SECTION_TABLE_TR}>
                      <td className={`px-5 py-3 ${confermeSecondaryClass}`}>
                        {r.data_ordine_display ?? r.data_ordine
                          ? fmt(r.data_ordine_display ?? r.data_ordine!)
                          : '—'}
                      </td>
                      <td className="px-5 py-3">
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
                      <td className={`px-5 py-3 text-right font-mono text-sm tabular-nums ${confermeSecondaryClass}`}>
                        {(() => {
                          const tot = sumRigheImporto(r.righe)
                          return tot != null ? formatCurrency(tot, currency, locale) : '—'
                        })()}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {!readOnly ? (
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            disabled={convertingId === r.id}
                            onClick={() => void handleConvertOne(r)}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/25 bg-transparent px-2 py-1 text-[10px] font-semibold text-emerald-400/80 transition-colors hover:bg-emerald-500/10 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {convertingId === r.id ? t.common.loading : '→ Bolla'}
                          </button>
                          <button
                            type="button"
                            disabled={deletingId === r.id}
                            onClick={() => void handleDelete(r)}
                            className={RED_ACTION_PILL}
                          >
                            {deletingId === r.id ? t.common.loading : t.common.delete}
                          </button>
                        </div>
                        ) : (
                          <span className={`text-xs ${confermeSecondaryClass}`}>—</span>
                        )}
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
    </>
  )
}
