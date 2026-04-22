'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useT } from '@/lib/use-t'
import { useLocale } from '@/lib/locale-context'
import { formatDate as formatDateLib } from '@/lib/locale'
import { SUPPLIER_DETAIL_TAB_HIGHLIGHT } from '@/lib/supplier-detail-tab-theme'
import { PublicPdfOpenMenu } from '@/components/PublicPdfOpenMenu'
import AppSectionEmptyState from '@/components/AppSectionEmptyState'
import { APP_SECTION_MOBILE_LIST, APP_SECTION_TABLE_TBODY, APP_SECTION_TABLE_TR } from '@/lib/app-shell-layout'

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
  'inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-transparent px-2 py-1 text-[10px] font-semibold text-rose-100/90 transition-colors hover:bg-rose-500/10'

const RED_ACTION_PILL =
  'inline-flex items-center justify-center rounded-lg border border-red-400/45 bg-transparent px-2 py-1 text-[10px] font-semibold text-red-200/95 shadow-sm ring-1 ring-inset ring-red-400/10 transition-colors hover:border-red-400/60 hover:bg-red-500/10 hover:text-red-50 disabled:cursor-not-allowed disabled:opacity-40'

const inputClass =
  'w-full rounded-lg border border-rose-500/35 bg-rose-500/[0.06] px-3 py-2 text-sm text-rose-50/[0.96] placeholder:text-rose-300/55 focus:border-rose-400/55 focus:outline-none focus:ring-1 focus:ring-rose-400/25 [color-scheme:dark]'

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

  const confermeTheme = SUPPLIER_DETAIL_TAB_HIGHLIGHT.conferme
  const migrationTheme = SUPPLIER_DETAIL_TAB_HIGHLIGHT.documenti
  /** Allineato a `confermeTheme` (bordo/barra rosa): più leggibile di `text-app-fg-muted` su questo guscio. */
  const confermeFormLabelClass = `mb-1.5 block text-[10px] font-bold uppercase tracking-widest ${confermeTheme.label}`
  const confermeSecondaryClass = 'text-rose-200/[0.88]'

  const fmt = useCallback(
    (iso: string) => formatDateLib(iso, locale, timezone, { day: '2-digit', month: 'short', year: 'numeric' }),
    [locale, timezone],
  )

  const pdfOpenMenuLabels = {
    preview: t.dashboard.ordiniPdfPreview,
    copyLink: t.dashboard.ordiniPdfCopyLink,
    linkCopied: t.dashboard.ordiniPdfLinkCopied,
  }

  const pdfOpenTrigger = (
    <>
      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
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
    const { data: pub } = supabase.storage.from('documenti').getPublicUrl(uniqueName)
    const file_url = pub.publicUrl

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

  if (tableMissing) {
    return (
      <div className={`supplier-detail-tab-shell mt-4 overflow-hidden ${migrationTheme.border}`}>
        <div className={`app-card-bar-accent ${migrationTheme.bar}`} aria-hidden />
        <div className="border-b border-amber-500/25 bg-transparent px-5 py-4 text-sm text-amber-100/95">
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
        <div className="border-b border-app-line-20 px-5 py-3.5">
          <p className="text-sm leading-relaxed text-rose-100/[0.94]">{t.fornitori.confermeOrdineIntro}</p>
        </div>

        {!readOnly ? (
        <div className="border-b border-app-line-20 bg-rose-500/[0.04] px-5 py-4">
          <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2 lg:grid-cols-12 lg:items-stretch">
            <div className="flex min-h-0 flex-col sm:col-span-2 lg:col-span-4">
              <label className={confermeFormLabelClass}>{t.common.document}</label>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf"
                onChange={onPickFile}
                className={`block w-full text-sm ${confermeSecondaryClass} file:mr-3 file:rounded-lg file:border file:border-rose-500/40 file:bg-rose-500/10 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-rose-100/90 hover:file:bg-rose-500/20`}
              />
            </div>
            <div className="flex min-h-0 flex-col lg:col-span-2">
              <label className={confermeFormLabelClass}>{t.fornitori.confermeOrdineOptionalTitle}</label>
              <input
                value={titolo}
                onChange={(e) => setTitolo(e.target.value)}
                placeholder={t.fornitori.confermeOrdineOptionalTitlePh}
                className={inputClass}
              />
            </div>
            <div className="flex min-h-0 flex-col lg:col-span-2">
              <label className={confermeFormLabelClass}>{t.fornitori.confermeOrdineOptionalOrderDate}</label>
              <input
                type="date"
                value={dataOrdine}
                onChange={(e) => setDataOrdine(e.target.value)}
                className={`${inputClass} [color-scheme:dark]`}
              />
            </div>
            <div className="flex min-h-0 flex-col sm:col-span-2 lg:col-span-3">
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
                className="inline-flex min-h-[44px] w-full shrink-0 items-center justify-center rounded-xl border border-app-cyan-400/45 bg-cyan-400/12 px-4 py-2.5 text-sm font-bold text-app-cyan-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm transition-colors hover:border-app-cyan-400/60 hover:bg-cyan-400/18 disabled:cursor-not-allowed disabled:opacity-40 lg:min-w-[9rem]"
              >
                {saving ? t.common.saving : t.fornitori.confermeOrdineAdd}
              </button>
            </div>
          </div>
          {error ? (
            <p className="mt-3 rounded-lg border border-red-400/35 bg-transparent px-3 py-2 text-sm text-red-200/95">{error}</p>
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
                className="mx-auto mb-3 h-11 w-11 text-rose-400/55"
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
                  className="flex flex-col gap-2 px-4 py-4 transition-colors hover:bg-rose-500/[0.06]"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-rose-50/[0.96]">{r.titolo?.trim() || r.file_name || '—'}</p>
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
                    <PublicPdfOpenMenu
                      fileUrl={r.file_url}
                      triggerClassName={CONFERME_OPEN_PILL}
                      labels={pdfOpenMenuLabels}
                    >
                      {pdfOpenTrigger}
                    </PublicPdfOpenMenu>
                    {!readOnly ? (
                    <button
                      type="button"
                      disabled={deletingId === r.id}
                      onClick={() => void handleDelete(r)}
                      className={RED_ACTION_PILL}
                    >
                      {deletingId === r.id ? t.common.loading : t.common.delete}
                    </button>
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
                      {t.fornitori.confermeOrdineColFile}
                    </th>
                    <th
                      className={`px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest ${confermeTheme.label}`}
                    >
                      {t.common.date}
                    </th>
                    <th
                      className={`px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest ${confermeTheme.label}`}
                    >
                      {t.fornitori.confermeOrdineColRecorded}
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
                      <td className="px-5 py-3">
                        <p className="font-medium text-rose-50/[0.96]">{r.titolo?.trim() || r.file_name || '—'}</p>
                        {r.note?.trim() ? <p className={`mt-1 text-xs ${confermeSecondaryClass}`}>{r.note}</p> : null}
                        <PublicPdfOpenMenu
                          fileUrl={r.file_url}
                          triggerClassName={`${CONFERME_OPEN_PILL} mt-2 inline-flex`}
                          labels={pdfOpenMenuLabels}
                        >
                          {pdfOpenTrigger}
                        </PublicPdfOpenMenu>
                      </td>
                      <td className={`px-5 py-3 ${confermeSecondaryClass}`}>
                        {r.data_ordine ? fmt(r.data_ordine) : '—'}
                      </td>
                      <td className={`px-5 py-3 ${confermeSecondaryClass}`}>{fmt(r.created_at)}</td>
                      <td className="px-5 py-3 text-right">
                        {!readOnly ? (
                        <button
                          type="button"
                          disabled={deletingId === r.id}
                          onClick={() => void handleDelete(r)}
                          className={RED_ACTION_PILL}
                        >
                          {deletingId === r.id ? t.common.loading : t.common.delete}
                        </button>
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
