'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useSedeId } from '@/lib/use-sede'
import { useT } from '@/lib/use-t'
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
  const cameraRef = useRef<HTMLInputElement>(null)
  const { sedeId } = useSedeId()
  const t = useT()
  const { activeOperator } = useActiveOperator()

  const bollaIdParam    = searchParams.get('bolla_id') ?? ''
  const fornitoreIdParam = searchParams.get('fornitore_id') ?? ''

  const [data, setData] = useState(new Date().toISOString().split('T')[0])
  const [numeroFattura, setNumeroFattura] = useState('')
  const [importoManuale, setImportoManuale] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [registratoDa, setRegistratoDa] = useState('')

  // Auto-fill registratoDa dall'operatore attivo
  useEffect(() => {
    if (activeOperator?.full_name) {
      setRegistratoDa(activeOperator.full_name)
    }
  }, [activeOperator])
  const [uploadMode, setUploadMode] = useState<'idle' | 'camera' | 'file'>('idle')
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
    if (!f.type.startsWith('image/')) return
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
    setFile(f)
    setOcrStatus('idle')
    setDateFromOcr(false)
    if (f) { setPreview(URL.createObjectURL(f)); runOcr(f) } else setPreview(null)
  }

  const removeFile = () => {
    setFile(null); setPreview(null); setOcrStatus('idle')
    setDateFromOcr(false); setUploadMode('idle')
    if (fileRef.current) fileRef.current.value = ''
    if (cameraRef.current) cameraRef.current.value = ''
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
    <div className="flex min-h-screen flex-col bg-slate-950">

      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-700/50 bg-slate-900/90 px-4 py-4 backdrop-blur-md">
        <button type="button" onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div>
          <h1 className="text-lg font-bold text-slate-100">{t.fatture.caricaFatturaTitle}</h1>
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
          <div className="app-card-login relative overflow-hidden rounded-2xl border border-cyan-500/20 p-5">
            <div className="app-card-bar mb-4" aria-hidden />
            <label className="mb-3 block text-xs font-semibold uppercase tracking-wide text-slate-400">
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
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${sel ? 'border-cyan-500/40 bg-cyan-500/10' : 'border-slate-700/50 hover:bg-slate-800/60'}`}>
                      <input type="checkbox" checked={sel} onChange={() => toggleBolla(b.id)}
                        className="rounded border-slate-600 text-cyan-500 focus:ring-cyan-500" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-100">
                          {b.numero_bolla ? `${b.numero_bolla} · ` : ''}{fmt(b.data)}
                        </p>
                        {b.importo != null && (
                          <p className="text-xs text-slate-400">£ {b.importo.toFixed(2)}</p>
                        )}
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${sel ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-800 text-slate-500'}`}>
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
        )}

        {/* Numero fattura + importo */}
        <div className="app-card-login overflow-hidden rounded-2xl">
          <div className="app-card-bar" aria-hidden />
          <div className="border-b border-slate-700/50 p-5">
            <label className="mb-3 block text-xs font-semibold uppercase tracking-wide text-slate-400">
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
            <label className="mb-3 block text-xs font-semibold uppercase tracking-wide text-slate-400">
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
        <div className="app-card-login p-5">
          <div className="app-card-bar mb-4" aria-hidden />
          <label className="mb-3 block text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t.fatture.fileFattura} <span className="text-red-400">*</span>
          </label>

          {!preview && uploadMode === 'idle' && (
            <div className="grid grid-cols-2 gap-3">
              <button type="button"
                onClick={() => { setUploadMode('camera'); setTimeout(() => cameraRef.current?.click(), 50) }}
                className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-slate-600/50 py-8 text-slate-500 transition-colors hover:border-cyan-500/50 hover:text-cyan-400">
                <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-sm font-semibold">{t.bolle.cameraBtn}</span>
              </button>
              <button type="button"
                onClick={() => { setUploadMode('file'); setTimeout(() => fileRef.current?.click(), 50) }}
                className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-slate-600/50 py-8 text-slate-500 transition-colors hover:border-cyan-500/50 hover:text-cyan-400">
                <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span className="text-sm font-semibold">{t.bolle.fileBtn}</span>
              </button>
            </div>
          )}

          {preview && file?.type !== 'application/pdf' && (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Anteprima fattura" className="w-full rounded-xl object-cover max-h-64" />
              <button type="button" onClick={removeFile}
                className="absolute top-2 right-2 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              {ocrStatus === 'scanning' && (
                <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/70 text-white text-xs px-3 py-1.5 rounded-full">
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Analisi…
                </div>
              )}
              {ocrStatus === 'done' && dateFromOcr && (
                <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-green-600 text-white text-xs px-3 py-1.5 rounded-full">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                  </svg>
                  Dati rilevati
                </div>
              )}
            </div>
          )}

          {preview && file?.type === 'application/pdf' && (
            <div className="flex items-center gap-3 rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
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

          <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" />
          <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={handleFile} className="hidden" />
        </div>

        {/* Registrato da */}
        {file && (
          <div className="app-card-login relative overflow-hidden rounded-2xl border border-cyan-500/20 p-5">
            <div className="app-card-bar mb-4" aria-hidden />
            <label className="mb-3 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Registrato da
            </label>
            <input type="text" placeholder="Nome di chi ha registrato la fattura…"
              value={registratoDa} onChange={e => setRegistratoDa(e.target.value)}
              className="-mx-1 w-full border-0 bg-transparent py-1 text-base text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-0"
            />
          </div>
        )}

        {/* Data fattura */}
        <div className="app-card-login overflow-hidden rounded-2xl">
          <div className="app-card-bar" aria-hidden />
          <div className={`p-5 transition-colors ${dateFromOcr ? 'bg-emerald-500/10' : ''}`}>
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
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
          <div className="flex items-center justify-between border-t border-slate-700/50 bg-slate-800/40 px-5 py-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Data caricamento</span>
            <span className="text-sm font-medium text-slate-400">
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
