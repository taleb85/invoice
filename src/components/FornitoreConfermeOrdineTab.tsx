'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useT } from '@/lib/use-t'
import { useLocale } from '@/lib/locale-context'
import { formatDate as formatDateLib } from '@/lib/locale'
import { SUPPLIER_DETAIL_TAB_HIGHLIGHT } from '@/lib/supplier-detail-tab-theme'

import { OpenDocumentInAppButton } from '@/components/OpenDocumentInAppButton'
import AppSectionEmptyState from '@/components/AppSectionEmptyState'
import { APP_SECTION_MOBILE_LIST, APP_SECTION_TABLE_TBODY, APP_SECTION_TABLE_TR } from '@/lib/app-shell-layout'
import { openDocumentUrl } from '@/lib/open-document-url'
import { documentiPublicRefUrl } from '@/lib/documenti-storage-url'
import { iconAccentClass as icon } from '@/lib/icon-accent-classes'
import { useToast } from '@/lib/toast-context'

/** Extracts a document-type label from a free-text title or filename.
 *  Matches common keywords in English, Italian, French, German and Spanish.
 *  Returns null when the type cannot be inferred. */
function extractDocTypeFromTitle(titolo: string | null, fileName: string | null): string | null {
  const text = (titolo ?? fileName ?? '').toLowerCase()
  if (!text) return null

  if (/invoice|fattura|facture|rechnung|factura/.test(text)) return 'Invoice'
  if (/credit note|nota.credito|note.de.crédit|gutschrift|nota.de.crédito/.test(text)) return 'Credit Note'
  if (/delivery.note|ddt|bolla|bon.de.livraison|lieferschein|albarán/.test(text)) return 'Delivery Note'
  if (/order.confirm|conferma.ordin|confirmation.de.commande|auftragsbestätigung|confirmaci/.test(text)) return 'Order Confirmation'
  if (/purchase.order|ordine.acquisto|bon.de.commande|bestellung|orden.de.compra/.test(text)) return 'Purchase Order'
  if (/statement|estratto.conto|relevé.de.compte|kontoauszug|extracto/.test(text)) return 'Statement'
  if (/receipt|ricevuta|reçu|quittung|recibo/.test(text)) return 'Receipt'
  if (/proforma|pro.forma/.test(text)) return 'Pro-forma Invoice'
  return null
}

export type ConfermaOrdineRow = {
  id: string
  file_url: string
  file_name: string | null
  titolo: string | null
  data_ordine: string | null
  note: string | null
  created_at: string
}

/** Sul guscio `supplier-detail-tab-shell` (trasparente): niente `app-workspace-inset-bg`. */
const CONFERME_TABLE_HEAD_ROW = 'border-b border-app-soft-border bg-transparent'

/** Apri PDF: contorno rosa, fill trasparente. */
const CONFERME_OPEN_PILL =
  'inline-flex items-center gap-1 rounded-lg border border-app-line-25 bg-transparent px-2 py-1 text-[10px] font-semibold text-app-fg-muted transition-colors hover:bg-app-line-10 hover:text-app-fg'

const RED_ACTION_PILL =
  'inline-flex items-center justify-center rounded-lg border border-[rgba(34,211,238,0.15)] bg-transparent px-2 py-1 text-[10px] font-semibold text-red-200/95 shadow-sm ring-1 ring-inset ring-red-400/10 transition-colors hover:border-[rgba(34,211,238,0.15)] hover:bg-red-500/10 hover:text-red-50 disabled:cursor-not-allowed disabled:opacity-40'

const inputClass =
  'w-full rounded-lg border border-app-line-25 app-workspace-inset-bg-soft px-3 py-2 text-sm text-app-fg placeholder:text-app-fg-placeholder focus:border-app-a-40 focus:outline-none focus:ring-1 focus:ring-app-a-25 [color-scheme:dark]'

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
}: {
  fornitoreId: string
  sedeId: string | null
  readOnly?: boolean
}) {
  const t = useT()
  const { locale, timezone } = useLocale()
  const { showToast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<ConfermaOrdineRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [titolo, setTitolo] = useState('')
  const [dataOrdine, setDataOrdine] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [convertingId, setConvertingId] = useState<string | null>(null)
  const [convertingAll, setConvertingAll] = useState(false)

  const confermeTheme = SUPPLIER_DETAIL_TAB_HIGHLIGHT.conferme
  const migrationTheme = SUPPLIER_DETAIL_TAB_HIGHLIGHT.documenti
  /** Allineato a `confermeTheme` (bordo/barra rosa): più leggibile di `text-app-fg-muted` su questo guscio. */
  const confermeFormLabelClass = `mb-1.5 block text-[10px] font-bold uppercase tracking-widest ${confermeTheme.label}`
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
    const supabase = createClient()
    const { data, error: qErr } = await supabase
      .from('conferme_ordine')
      .select('id, file_url, file_name, titolo, data_ordine, note, created_at')
      .eq('fornitore_id', fornitoreId)
      .order('created_at', { ascending: false })

    if (qErr) {
      if (qErr.message?.includes('conferme_ordine') || qErr.code === '42P01') {
        setTableMissing(true)
        setRows([])
      } else {
        setError(qErr.message)
        setRows([])
      }
      setLoading(false)
      return
    }
    setTableMissing(false)
    setRows((data ?? []) as ConfermaOrdineRow[])
    setLoading(false)
  }, [fornitoreId])

  useEffect(() => {
    void load()
  }, [load])

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null
    setError(null)
    if (f && f.type !== 'application/pdf') {
      setFile(null)
      setError(t.fornitori.confermeOrdineErrPdf)
      e.target.value = ''
      return
    }
    setFile(f)
  }

  const resetForm = () => {
    setFile(null)
    setTitolo('')
    setDataOrdine('')
    setNote('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleSave = async () => {
    if (!file) {
      setError(t.fornitori.confermeOrdineErrNeedFile)
      return
    }
    setSaving(true)
    setError(null)
    const supabase = createClient()
    const ext = file.name.split('.').pop() ?? 'pdf'
    const uniqueName = `conferma_ordine_${crypto.randomUUID()}.${ext}`
    const { error: upErr } = await supabase.storage.from('documenti').upload(uniqueName, file, {
      contentType: file.type || 'application/pdf',
      upsert: false,
    })
    if (upErr) {
      setSaving(false)
      setError(`${t.fornitori.confermeOrdineErrUpload}: ${upErr.message}`)
      return
    }
    const file_url = documentiPublicRefUrl(uniqueName)

    const payload = {
      fornitore_id: fornitoreId,
      sede_id: sedeId,
      file_url,
      file_name: file.name,
      titolo: titolo.trim() || null,
      data_ordine: dataOrdine.trim() || null,
      note: note.trim() || null,
    }
    const { error: insErr } = await supabase.from('conferme_ordine').insert([payload])
    setSaving(false)
    if (insErr) {
      setError(`${t.fornitori.confermeOrdineErrSave}: ${insErr.message}`)
      await supabase.storage.from('documenti').remove([uniqueName]).catch(() => {})
      return
    }
    resetForm()
    await load()
  }

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
    if (rows.length === 0) return
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
    <div className={`supplier-detail-tab-shell mt-4 flex flex-col overflow-hidden ${confermeTheme.border}`}>
      <div className={`app-card-bar-accent ${confermeTheme.bar}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3 border-b border-app-line-20 px-5 py-3.5">
          <p className="text-sm leading-relaxed text-app-fg">{t.fornitori.confermeOrdineIntro}</p>
          {!readOnly && rows.length > 0 ? (
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

        {!readOnly ? (
        <div className="border-b border-app-line-20 px-5 py-4">
          <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2 lg:grid lg:grid-cols-[2fr_1.2fr_1.2fr_2fr_auto] lg:items-end">
            <div className="flex min-h-0 flex-col sm:col-span-2 lg:col-span-1">
              <label className={confermeFormLabelClass}>{t.common.document}</label>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf"
                onChange={onPickFile}
                className={`block w-full text-sm ${confermeSecondaryClass} file:mr-3 file:rounded-lg file:border file:border-[rgba(34,211,238,0.15)] file:bg-app-line-15 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-app-fg-muted hover:file:bg-app-line-20`}
              />
            </div>
            <div className="flex min-h-0 flex-col">
              <label className={confermeFormLabelClass}>{t.fornitori.confermeOrdineOptionalTitle}</label>
              <input
                value={titolo}
                onChange={(e) => setTitolo(e.target.value)}
                placeholder={t.fornitori.confermeOrdineOptionalTitlePh}
                className={inputClass}
              />
            </div>
            <div className="flex min-h-0 flex-col">
              <label className={confermeFormLabelClass}>{t.fornitori.confermeOrdineOptionalOrderDate}</label>
              <input
                type="date"
                value={dataOrdine}
                onChange={(e) => setDataOrdine(e.target.value)}
                className={`${inputClass} [color-scheme:dark]`}
              />
            </div>
            <div className="flex min-h-0 flex-col sm:col-span-2 lg:col-span-1">
              <label className={confermeFormLabelClass}>{t.common.notes}</label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t.fornitori.confermeOrdineOptionalNotePh}
                className={inputClass}
              />
            </div>
            <div className="flex min-h-0 flex-col sm:col-span-2 lg:col-span-1">
              <div className="hidden min-h-0 flex-1 lg:block" aria-hidden />
              <button
                type="button"
                disabled={saving || !file}
                onClick={() => void handleSave()}
                className="inline-flex min-h-[44px] w-full shrink-0 items-center justify-center whitespace-nowrap rounded-xl border border-app-cyan-400/45 bg-cyan-400/12 px-4 py-2.5 text-sm font-bold text-app-cyan-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm transition-colors hover:border-app-cyan-400/60 hover:bg-cyan-400/18 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? t.common.saving : t.fornitori.confermeOrdineAdd}
              </button>
            </div>
          </div>
          {error ? (
            <p className="mt-3 rounded-lg border border-[rgba(34,211,238,0.15)] bg-transparent px-3 py-2 text-sm text-red-200/95">{error}</p>
          ) : null}
        </div>
        ) : null}

        {loading ? (
          <div className="flex justify-center py-14">
            <div
              className="h-9 w-9 animate-spin rounded-full border-2 border-app-line-40 border-t-app-cyan-400"
              aria-hidden
            />
          </div>
        ) : rows.length === 0 ? (
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
              {rows.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-col gap-2 px-4 py-4 transition-colors hover:bg-app-line-5"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-app-fg">{r.titolo?.trim() || r.file_name || '—'}</p>
                    {r.data_ordine ? (
                      <p className={`mt-0.5 text-xs ${confermeSecondaryClass}`}>
                        {t.fornitori.confermeOrdineOptionalOrderDate}: {fmt(r.data_ordine)}
                      </p>
                    ) : null}
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
                      categoria={extractDocTypeFromTitle(r.titolo, r.file_name) ?? t.fornitori.tabConfermeOrdine}
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
                  {rows.map((r) => (
                    <tr key={r.id} className={APP_SECTION_TABLE_TR}>
                      <td className={`px-5 py-3 ${confermeSecondaryClass}`}>
                        {r.data_ordine ? fmt(r.data_ordine) : '—'}
                      </td>
                      <td className="px-5 py-3">
                        <OpenDocumentInAppButton
                          confermaOrdineId={r.id}
                          fileUrl={r.file_url}
                          className="block max-w-[22rem] text-left hover:underline underline-offset-2 font-medium text-app-fg hover:text-app-cyan-300 transition-colors"
                          title={r.titolo?.trim() || r.file_name || undefined}
                          stopTriggerPropagation
                          categoria={extractDocTypeFromTitle(r.titolo, r.file_name) ?? t.fornitori.tabConfermeOrdine}
                        >
                          <span className="block truncate" title={r.titolo?.trim() || r.file_name || undefined}>
                            {r.titolo?.trim() || r.file_name || '—'}
                          </span>
                          {r.titolo?.trim() && r.file_name && r.file_name !== r.titolo.trim() ? (
                            <span className={`mt-0.5 block truncate text-xs font-normal ${confermeSecondaryClass}`} title={r.file_name}>
                              {extractDocTypeFromTitle(null, r.file_name) ?? r.file_name}
                            </span>
                          ) : null}
                          {r.note?.trim() ? (
                            <span className={`mt-0.5 block truncate text-xs font-normal ${confermeSecondaryClass}`} title={r.note}>
                              {r.note}
                            </span>
                          ) : null}
                        </OpenDocumentInAppButton>
                      </td>
                      <td className={`px-5 py-3 text-right font-mono text-sm tabular-nums ${confermeSecondaryClass}`}>
                        —
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
  )
}
