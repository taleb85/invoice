'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useT } from '@/lib/use-t'
import { useLocale } from '@/lib/locale-context'
import { formatDate as formatDateLib } from '@/lib/locale'

export type ConfermaOrdineRow = {
  id: string
  file_url: string
  file_name: string | null
  titolo: string | null
  data_ordine: string | null
  note: string | null
  created_at: string
}

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
}: {
  fornitoreId: string
  sedeId: string | null
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

  const fmt = useCallback(
    (iso: string) => formatDateLib(iso, locale, timezone, { day: '2-digit', month: 'short', year: 'numeric' }),
    [locale, timezone],
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
      <div className="rounded-xl border border-amber-500/35 bg-amber-950/25 px-4 py-3 text-sm text-amber-100/95">
        <p className="font-semibold text-amber-200">{t.fornitori.confermeOrdineMigrationTitle}</p>
        <p className="mt-1 text-xs leading-relaxed text-amber-100/85">{t.fornitori.confermeOrdineMigrationHint}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-200">{t.fornitori.confermeOrdineIntro}</p>

      <div className="rounded-xl border border-slate-700/60 bg-slate-700/50 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
          <div className="min-w-0 flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-200">{t.common.document}</label>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              onChange={onPickFile}
              className="block w-full text-sm text-slate-200 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-500/20 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-cyan-200 hover:file:bg-cyan-500/30"
            />
          </div>
          <div className="w-full md:w-48">
            <label className="mb-1 block text-xs font-medium text-slate-200">{t.fornitori.confermeOrdineOptionalTitle}</label>
            <input
              value={titolo}
              onChange={(e) => setTitolo(e.target.value)}
              placeholder={t.fornitori.confermeOrdineOptionalTitlePh}
              className="w-full rounded-lg border border-slate-600/80 bg-slate-700/90 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
            />
          </div>
          <div className="w-full md:w-40">
            <label className="mb-1 block text-xs font-medium text-slate-200">{t.fornitori.confermeOrdineOptionalOrderDate}</label>
            <input
              type="date"
              value={dataOrdine}
              onChange={(e) => setDataOrdine(e.target.value)}
              className="w-full rounded-lg border border-slate-600/80 bg-slate-700/90 px-3 py-2 text-sm text-slate-100 [color-scheme:dark]"
            />
          </div>
          <div className="min-w-0 flex-1 md:min-w-[12rem]">
            <label className="mb-1 block text-xs font-medium text-slate-200">{t.common.notes}</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t.fornitori.confermeOrdineOptionalNotePh}
              className="w-full rounded-lg border border-slate-600/80 bg-slate-700/90 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
            />
          </div>
          <button
            type="button"
            disabled={saving || !file}
            onClick={() => void handleSave()}
            className="min-h-[44px] rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? t.common.saving : t.fornitori.confermeOrdineAdd}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-slate-700/50 bg-slate-700/40 px-4 py-6 text-center text-sm text-slate-500">
          {t.fornitori.confermeOrdineEmpty}
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-700/55">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-700/60 bg-slate-700/80 text-xs font-semibold uppercase tracking-wide text-slate-200">
              <tr>
                <th className="px-4 py-3">{t.fornitori.confermeOrdineColFile}</th>
                <th className="hidden px-4 py-3 sm:table-cell">{t.common.date}</th>
                <th className="px-4 py-3">{t.fornitori.confermeOrdineColRecorded}</th>
                <th className="w-32 px-4 py-3 text-right">{t.common.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {rows.map((r) => (
                <tr key={r.id} className="bg-slate-700/40 transition-colors hover:bg-slate-700/50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-100">{r.titolo?.trim() || r.file_name || '—'}</p>
                    {r.data_ordine && (
                      <p className="mt-0.5 text-xs text-slate-500 sm:hidden">
                        {t.fornitori.confermeOrdineOptionalOrderDate}: {fmt(r.data_ordine)}
                      </p>
                    )}
                    {r.note?.trim() && <p className="mt-1 text-xs text-slate-200">{r.note}</p>}
                    <a
                      href={r.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block text-xs font-semibold text-cyan-400 hover:text-cyan-300 hover:underline"
                    >
                      {t.fornitori.confermeOrdineOpen} ↗
                    </a>
                  </td>
                  <td className="hidden px-4 py-3 text-slate-200 sm:table-cell">
                    {r.data_ordine ? fmt(r.data_ordine) : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-200">{fmt(r.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      disabled={deletingId === r.id}
                      onClick={() => void handleDelete(r)}
                      className="text-xs font-semibold text-red-400 hover:text-red-300 disabled:opacity-40"
                    >
                      {deletingId === r.id ? t.common.loading : t.common.delete}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
