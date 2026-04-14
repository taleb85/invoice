'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useSedeId } from '@/lib/use-sede'
import { useT } from '@/lib/use-t'
import { desktopHeaderBarDefaultBorderColor, desktopHeaderBarDefaultFill } from '@/lib/desktop-header-bar-surface'
import { useActiveOperator } from '@/lib/active-operator-context'

type OcrStatus = 'idle' | 'scanning' | 'done' | 'error'

type BollaAperta = {
  id: string
  data: string
  numero_bolla: string | null
  importo: number | null
  stato: string
}

function fmt(d: string) {
  return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d))
}

function NuovaFatturaForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const { sedeId } = useSedeId()
  const t = useT()
  const { activeOperator } = useActiveOperator()

  const bollaIdParam    = searchParams.get('bolla_id') ?? ''
  const fornitoreIdParam = searchParams.get('fornitore_id') ?? ''
  const dataParam       = searchParams.get('data') ?? ''

  const [data, setData] = useState(new Date().toISOString().split('T')[0])
  const [numeroFattura, setNumeroFattura] = useState('')
  const [importoManuale, setImportoManuale] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [registratoDa, setRegistratoDa] = useState('')

  // Auto-fill registratoDa dall'operatore attivo
  useEffect(() => {
    if (activeOperator?.full_name) {
      setRegistratoDa(activeOperator.full_name)
    }
  }, [activeOperator])
  const [ocrStatus, setOcrStatus] = useState<OcrStatus>('idle')
  const [dateFromOcr, setDateFromOcr] = useState(false)

  // Multi-bolla
  const [bolleDisponibili, setBolleDisponibili] = useState<BollaAperta[]>([])
  const [bolleSelezionate, setBolleSelezionate] = useState<Set<string>>(new Set())
  const [loadingBolle, setLoadingBolle] = useState(false)

  // Importo calcolato automaticamente dalle bolle selezionate
  const importoCalcolato = [...bolleSelezionate].reduce((sum, id) => {
    const b = bolleDisponibili.find(b => b.id === id)
    return sum + (b?.importo ?? 0)
  }, 0)

  const tutteConImporto = [...bolleSelezionate].every(id => {
    const b = bolleDisponibili.find(b => b.id === id)
    return b?.importo != null
  })

  // importo finale: calcolato se tutte le bolle hanno importo, altrimenti manuale
  const importoFinale = bolleSelezionate.size > 0 && tutteConImporto
    ? importoCalcolato
    : importoManuale ? parseFloat(importoManuale) : null

  useEffect(() => {
    if (dataParam && /^\d{4}-\d{2}-\d{2}$/.test(dataParam)) {
      setData(dataParam)
      setDateFromOcr(true)
    }
  }, [dataParam])

  // Carica bolle aperte per il fornitore
  useEffect(() => {
    if (!fornitoreIdParam) return
    setLoadingBolle(true)
    const q = supabase
      .from('bolle')
      .select('id, data, numero_bolla, importo, stato')
      .eq('fornitore_id', fornitoreIdParam)
      .eq('stato', 'in attesa')
      .order('data', { ascending: false })

    if (sedeId) {
      q.eq('sede_id', sedeId)
    }

    q.then(({ data: rows }: { data: BollaAperta[] | null }) => {
      setBolleDisponibili(rows ?? [])
      // Pre-seleziona la bolla dal URL param
      if (bollaIdParam) {
        setBolleSelezionate(new Set([bollaIdParam]))
      }
      setLoadingBolle(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fornitoreIdParam, bollaIdParam, sedeId])

  const toggleBolla = (id: string) => {
    setBolleSelezionate(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const runOcr = async (f: File) => {
    if (f.type !== 'application/pdf') return
    setOcrStatus('scanning')
    setDateFromOcr(false)
    try {
      const fd = new FormData()
      fd.append('file', f)
      const res = await fetch('/api/ocr-fattura', { method: 'POST', body: fd })
      const result = await res.json()
      if (!res.ok || result.error) { setOcrStatus('error'); return }
      if (result.data) { setData(result.data); setDateFromOcr(true) }
      if (result.numero_fattura && !numeroFattura) setNumeroFattura(result.numero_fattura)
      if (result.importo && !importoManuale) setImportoManuale(String(result.importo))
      setOcrStatus('done')
    } catch {
      setOcrStatus('error')
    }
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null
    setError(null)
    if (f && f.type !== 'application/pdf') {
      setError('Carica un PDF (fattura ricevuta per email).')
      e.target.value = ''
      return
    }
    setFile(f)
    setOcrStatus('idle')
    setDateFromOcr(false)
    if (f) void runOcr(f)
  }

  const removeFile = () => {
    setFile(null)
    setOcrStatus('idle')
    setDateFromOcr(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) { setError('Carica il file della fattura prima di procedere.'); return }
    setSaving(true)
    setError(null)

    const ext = file.name.split('.').pop() ?? 'pdf'
    const uniqueName = `${crypto.randomUUID()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('documenti')
      .upload(uniqueName, file, { contentType: file.type, upsert: false })

    if (uploadError) {
      setError(`Errore caricamento file: ${uploadError.message}`)
      setSaving(false)
      return
    }

    const { data: publicUrlData } = supabase.storage.from('documenti').getPublicUrl(uniqueName)
    const file_url = publicUrlData.publicUrl

    // Determina bolla_id: se singola bolla selezionata, mantieni per compatibilità
    const bolleIds = [...bolleSelezionate]
    const primaBolaId = bolleIds.length === 1 ? bolleIds[0] : (bollaIdParam || null)

    const { data: fatturaData, error: insertError } = await supabase
      .from('fatture')
      .insert([{
        fornitore_id: fornitoreIdParam || null,
        bolla_id: primaBolaId || null,
        sede_id: sedeId,
        data,
        file_url,
        registrato_da: registratoDa.trim() || null,
        numero_fattura: numeroFattura.trim() || null,
        importo: importoFinale,
      }])
      .select('id')
      .single()

    if (insertError || !fatturaData) {
      setError(`Errore salvataggio fattura: ${insertError?.message}`)
      setSaving(false)
      return
    }

    const fatturaId = fatturaData.id

    // Se ci sono più bolle, crea le junction rows
    if (bolleIds.length > 1) {
      const junctionRows = bolleIds.map(bid => ({ fattura_id: fatturaId, bolla_id: bid }))
      const { error: jErr } = await supabase.from('fattura_bolle').insert(junctionRows)
      if (jErr) console.error('Junction insert error:', jErr.message)
    }

    // Segna tutte le bolle selezionate come completate
    if (bolleIds.length > 0) {
      await supabase.from('bolle').update({ stato: 'completato' }).in('id', bolleIds)
    }

    router.push('/bolle')
    router.refresh()
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-zinc-600 via-zinc-700 to-zinc-800">

      {/* Header */}
      <div
        className={`sticky top-0 z-10 flex items-center gap-3 border-b px-4 py-4 backdrop-blur-md ${desktopHeaderBarDefaultBorderColor} ${desktopHeaderBarDefaultFill}`}
      >
        <button type="button" onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-200 transition-colors hover:bg-slate-700 hover:text-slate-200">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div>
          <h1 className="app-page-title text-lg font-bold">{t.fatture.caricaFatturaTitle}</h1>
          {bolleSelezionate.size > 0 && (
            <p className="mt-0.5 text-xs text-cyan-400">
              {bolleSelezionate.size} bolla{bolleSelezionate.size > 1 ? 'e' : ''} selezionata{bolleSelezionate.size > 1 ? '' : ''}
            </p>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-4 p-4 max-w-lg mx-auto w-full">

        {/* Multi-bolla selector */}
        {fornitoreIdParam && (
          <div className="app-card-login relative flex flex-col overflow-hidden rounded-2xl border border-cyan-500/20">
            <div className="app-card-bar shrink-0" aria-hidden />
            <div className="p-5">
              <label className="mb-3 block text-xs font-semibold uppercase tracking-wide text-slate-200">
                Bolle da coprire con questa fattura
              </label>
              {loadingBolle ? (
                <p className="text-sm text-slate-500">Caricamento bolle…</p>
              ) : bolleDisponibili.length === 0 ? (
                <p className="text-sm text-amber-400">Nessuna bolla aperta per questo fornitore.</p>
              ) : (
                <div className="space-y-2">
                  {bolleDisponibili.map(b => {
                    const sel = bolleSelezionate.has(b.id)
                    return (
                      <label key={b.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${sel ? 'border-cyan-500/40 bg-cyan-500/10' : 'border-slate-700/50 hover:bg-slate-700/60'}`}>
                        <input type="checkbox" checked={sel} onChange={() => toggleBolla(b.id)}
                          className="rounded border-slate-600 text-cyan-500 focus:ring-cyan-500" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-100">
                            {b.numero_bolla ? `${b.numero_bolla} · ` : ''}{fmt(b.data)}
                          </p>
                          {b.importo != null && (
                            <p className="text-xs text-slate-200">£ {b.importo.toFixed(2)}</p>
                          )}
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${sel ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-700 text-slate-500'}`}>
                          {sel ? 'Inclusa' : 'Esclusa'}
                        </span>
                      </label>
                    )
                  })}
                  {/* Totale bolle selezionate */}
                  {bolleSelezionate.size > 0 && tutteConImporto && (
                    <div className="mt-1 flex items-center justify-between rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2">
                      <span className="text-xs font-semibold text-cyan-300">
                        Totale {bolleSelezionate.size} boll{bolleSelezionate.size > 1 ? 'e' : 'a'}
                      </span>
                      <span className="text-sm font-bold text-cyan-200">£ {importoCalcolato.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Numero fattura + importo */}
        <div className="app-card-login overflow-hidden rounded-2xl">
          <div className="app-card-bar" aria-hidden />
          <div className="border-b border-slate-700/50 p-5">
            <label className="mb-3 block text-xs font-semibold uppercase tracking-wide text-slate-200">
              N° Fattura <span className="font-normal normal-case text-slate-600">(opzionale)</span>
            </label>
            <input
              type="text"
              placeholder="es. FT-2025-042"
              value={numeroFattura}
              onChange={e => setNumeroFattura(e.target.value)}
              className="-mx-1 w-full border-0 bg-transparent py-1 text-base text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-0"
            />
          </div>
          <div className="p-5">
            <label className="mb-3 block text-xs font-semibold uppercase tracking-wide text-slate-200">
              {t.appStrings.labelImportoTotale}{' '}
              <span className="font-normal normal-case text-slate-600">
                {bolleSelezionate.size > 0 && tutteConImporto ? '— calcolato automaticamente' : '(IVA inclusa)'}
              </span>
            </label>
            {bolleSelezionate.size > 0 && tutteConImporto ? (
              <p className="text-lg font-bold text-cyan-300">£ {importoCalcolato.toFixed(2)}</p>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-base text-slate-500">£</span>
                <input
                  type="number" min="0" step="0.01" placeholder="0.00"
                  value={importoManuale}
                  onChange={e => setImportoManuale(e.target.value)}
                  className="flex-1 border-0 bg-transparent py-1 text-base text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-0"
                />
              </div>
            )}
          </div>
        </div>

        {/* File fattura */}
        <div className="app-card-login flex flex-col overflow-hidden">
          <div className="app-card-bar shrink-0" aria-hidden />
          <div className="p-5">
          <label className="mb-3 block text-xs font-semibold uppercase tracking-wide text-slate-200">
            {t.fatture.fileFattura} <span className="text-red-400">*</span>
          </label>

          {!file && (
            <button type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed border-slate-600/50 py-8 text-slate-500 transition-colors hover:border-cyan-500/50 hover:text-cyan-400">
              <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <span className="text-sm font-semibold">{t.bolle.fileBtn} (PDF)</span>
            </button>
          )}

          {file?.type === 'application/pdf' && (
            <div className="flex items-center gap-3 rounded-xl border border-slate-700/50 bg-slate-700/50 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-500/15">
                <svg className="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-100">{file.name}</p>
                <p className="mt-0.5 text-xs text-slate-500">{(file.size / 1024).toFixed(0)} KB</p>
              </div>
              <button type="button" onClick={removeFile} className="text-slate-600 transition-colors hover:text-red-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          <input ref={fileRef} type="file" accept="application/pdf" onChange={handleFile} className="hidden" />
          </div>
        </div>

        {/* Registrato da */}
        {file && (
          <div className="app-card-login relative flex flex-col overflow-hidden rounded-2xl border border-cyan-500/20">
            <div className="app-card-bar shrink-0" aria-hidden />
            <div className="p-5">
            <label className="mb-3 block text-xs font-semibold uppercase tracking-wide text-slate-200">
              Registrato da
            </label>
            <input type="text" placeholder="Nome di chi ha registrato la fattura…"
              value={registratoDa} onChange={e => setRegistratoDa(e.target.value)}
              className="-mx-1 w-full border-0 bg-transparent py-1 text-base text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-0"
            />
            </div>
          </div>
        )}

        {/* Data fattura */}
        <div className="app-card-login overflow-hidden rounded-2xl">
          <div className="app-card-bar" aria-hidden />
          <div className={`p-5 transition-colors ${dateFromOcr ? 'bg-emerald-500/10' : ''}`}>
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-200">
                {t.fatture.dataFattura}
              </label>
              {ocrStatus === 'scanning' && (
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Analisi…
                </span>
              )}
              {dateFromOcr && (
                <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                  </svg>
                  {t.bolle.ocrAutoRecognized}
                </span>
              )}
            </div>
            <input type="date" required value={data}
              onChange={e => { setData(e.target.value); setDateFromOcr(false) }}
              className="-mx-1 w-full border-0 bg-transparent py-1 text-base text-slate-100 [color-scheme:dark] focus:outline-none focus:ring-0"
            />
          </div>
          <div className="flex items-center justify-between border-t border-slate-700/50 bg-slate-700/40 px-5 py-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Data caricamento</span>
            <span className="text-sm font-medium text-slate-200">
              {new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })} — automatica
            </span>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        <button type="submit" disabled={saving || ocrStatus === 'scanning'}
          className="w-full py-4 bg-cyan-500 hover:bg-cyan-600 active:bg-cyan-700 disabled:opacity-50 text-white text-base font-semibold rounded-2xl transition-colors mt-auto shadow-sm flex items-center justify-center gap-2">
          {saving ? (
            <>
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              {t.fatture.savingInProgress}
            </>
          ) : ocrStatus === 'scanning' ? (
            <>
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Analisi fattura…
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {bolleSelezionate.size > 0 ? `Salva e chiudi ${bolleSelezionate.size} bolla${bolleSelezionate.size > 1 ? 'e' : ''}` : t.fatture.salvaChiudiBolla}
            </>
          )}
        </button>
      </form>
    </div>
  )
}

export default function NuovaFatturaPage() {
  return (
    <Suspense>
      <NuovaFatturaForm />
    </Suspense>
  )
}
