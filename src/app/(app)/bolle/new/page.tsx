'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Fornitore } from '@/types'
import { useSedeId } from '@/lib/use-sede'
import { useT } from '@/lib/use-t'
import { useLocale } from '@/lib/locale-context'
import { formatDate } from '@/lib/locale-shared'
import { useActiveOperator } from '@/lib/active-operator-context'

function ymdTodayInTimezone(tz: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970'
  const m = parts.find((p) => p.type === 'month')?.value ?? '01'
  const d = parts.find((p) => p.type === 'day')?.value ?? '01'
  return `${y}-${m}-${d}`
}

type OcrStatus = 'idle' | 'scanning' | 'matched' | 'not_found' | 'error'

type ScanIntent = 'auto' | 'bolla' | 'fattura' | 'nuovo_fornitore'

type HubResponse = {
  intent: string
  document_kind: 'ddt' | 'fattura' | 'supplier_card' | 'unknown'
  nome: string | null
  piva: string | null
  indirizzo?: string | null
  data: string | null
  numero_documento: string | null
  importo: number | null
}

function normalizzaNome(s: string) {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

function matchFornitore(fornitori: Fornitore[], nome: string | null, piva: string | null): Fornitore | null {
  if (!fornitori.length) return null

  if (piva) {
    const pivaNorm = piva.replace(/\D/g, '')
    const byPiva = fornitori.find(f => f.piva && f.piva.replace(/\D/g, '') === pivaNorm)
    if (byPiva) return byPiva
  }

  if (nome) {
    const nomeNorm = normalizzaNome(nome)
    const exact = fornitori.find(f => normalizzaNome(f.nome) === nomeNorm)
    if (exact) return exact
    const partial = fornitori.find(f => {
      const fn = normalizzaNome(f.nome)
      return nomeNorm.includes(fn) || fn.includes(nomeNorm)
    })
    if (partial) return partial
  }

  return null
}

function NuovaBollaForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedFornitoreId = searchParams.get('fornitore_id') ?? ''
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const { sedeId } = useSedeId()
  const t = useT()
  const { locale, timezone } = useLocale()
  const { activeOperator } = useActiveOperator()

  const todayRegistrationLabel = formatDate(ymdTodayInTimezone(timezone), locale, timezone, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  const [fornitori, setFornitori] = useState<Fornitore[]>([])
  const [fornitoreId, setFornitoreId] = useState('')
  const [data, setData] = useState(new Date().toISOString().split('T')[0])
  const [numeroBolla, setNumeroBolla] = useState('')
  const [importo, setImporto] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [registratoDa, setRegistratoDa] = useState('')

  useEffect(() => {
    if (activeOperator?.full_name) {
      setRegistratoDa(activeOperator.full_name)
    }
  }, [activeOperator])
  const [uploadMode, setUploadMode] = useState<'idle' | 'camera' | 'file'>('idle')

  const [scanIntent, setScanIntent] = useState<ScanIntent>('auto')
  const [registrationTarget, setRegistrationTarget] = useState<'bolla' | 'fattura'>('bolla')

  const [ocrStatus, setOcrStatus] = useState<OcrStatus>('idle')
  const [ocrNome, setOcrNome] = useState<string | null>(null)
  const [ocrPiva, setOcrPiva] = useState<string | null>(null)
  const [ocrIndirizzo, setOcrIndirizzo] = useState<string | null>(null)
  const [needsSupplierDeepExtract, setNeedsSupplierDeepExtract] = useState(false)
  const [matchedFornitore, setMatchedFornitore] = useState<Fornitore | null>(null)
  const [dateFromOcr, setDateFromOcr] = useState(false)

  const lastHubRef = useRef<HubResponse | null>(null)
  const lastIntentRef = useRef<ScanIntent>('auto')

  useEffect(() => {
    supabase.from('fornitori').select('id, nome, piva').order('nome').then(({ data }: { data: Fornitore[] | null }) => {
      const rows = (data as Fornitore[]) ?? []
      setFornitori(rows)
      if (preselectedFornitoreId && rows.some(f => f.id === preselectedFornitoreId)) {
        setFornitoreId(preselectedFornitoreId)
      } else if (rows.length > 0) {
        setFornitoreId(rows[0].id)
      }
    })
  }, [supabase, preselectedFornitoreId])

  const navigateToImport = useCallback((nome: string | null, piva: string | null, indirizzo?: string | null) => {
    const q = new URLSearchParams()
    if (nome?.trim()) q.set('prefill_nome', nome.trim())
    if (piva?.trim()) q.set('prefill_piva', piva.trim())
    if (indirizzo?.trim()) q.set('prefill_indirizzo', indirizzo.trim())
    const qs = q.toString()
    router.push(qs ? `/fornitori/import?${qs}` : '/fornitori/import')
  }, [router])

  const applyHubResult = useCallback((result: HubResponse, intent: ScanIntent, list: Fornitore[]) => {
    const kind = result.document_kind
    setOcrNome(result.nome)
    setOcrPiva(result.piva)
    setOcrIndirizzo(result.indirizzo ?? null)
    setNeedsSupplierDeepExtract(false)

    if (result.data) {
      setData(result.data)
      setDateFromOcr(true)
    }
    if (result.numero_documento) setNumeroBolla(result.numero_documento)
    if (result.importo != null) setImporto(String(result.importo))

    if (intent === 'nuovo_fornitore') {
      navigateToImport(result.nome, result.piva, result.indirizzo ?? null)
      setOcrStatus('idle')
      return
    }

    if (list.length === 0) {
      lastHubRef.current = result
      lastIntentRef.current = intent
      setOcrStatus('idle')
      return
    }

    let effectiveKind = kind
    if (intent === 'bolla') effectiveKind = 'ddt'
    if (intent === 'fattura') effectiveKind = 'fattura'

    if (effectiveKind === 'supplier_card') {
      navigateToImport(result.nome, result.piva, result.indirizzo ?? null)
      setOcrStatus('idle')
      return
    }

    const match = matchFornitore(list, result.nome, result.piva)

    if (!match) {
      if (intent === 'auto' || intent === 'fattura') {
        const emptyExtract =
          effectiveKind === 'unknown' && !result.nome?.trim() && !result.piva?.trim()
        if (emptyExtract) {
          setMatchedFornitore(null)
          setOcrStatus('not_found')
          setRegistrationTarget('bolla')
          setNeedsSupplierDeepExtract(true)
          return
        }
        navigateToImport(result.nome, result.piva, result.indirizzo ?? null)
        return
      }
      setMatchedFornitore(null)
      setOcrStatus('not_found')
      setRegistrationTarget('bolla')
      return
    }

    setMatchedFornitore(match)
    setFornitoreId(match.id)

    if (effectiveKind === 'fattura') {
      setRegistrationTarget('fattura')
      setOcrStatus('matched')
      return
    }

    setRegistrationTarget('bolla')
    setOcrStatus('matched')
  }, [navigateToImport])

  useEffect(() => {
    if (fornitori.length === 0 || !lastHubRef.current) return
    const pending = lastHubRef.current
    const intent = lastIntentRef.current
    lastHubRef.current = null
    applyHubResult(pending, intent, fornitori)
  }, [fornitori, applyHubResult])

  const runScannerHub = useCallback(async (f: File, intent: ScanIntent, list: Fornitore[]) => {
    setOcrStatus('scanning')
    setMatchedFornitore(null)
    setOcrNome(null)
    setOcrPiva(null)
    setOcrIndirizzo(null)
    setNeedsSupplierDeepExtract(false)
    setError(null)

    try {
      const fd = new FormData()
      fd.append('file', f)
      fd.append('intent', intent)
      const res = await fetch('/api/ocr-scanner-hub', { method: 'POST', body: fd })
      const result = (await res.json()) as HubResponse & { error?: string }

      if (!res.ok || result.error) {
        setOcrStatus('error')
        if (result.error) setError(result.error)
        return
      }

      applyHubResult(result, intent, list)
    } catch {
      setOcrStatus('error')
    }
  }, [applyHubResult])

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null
    setFile(f)
    setOcrStatus('idle')
    setMatchedFornitore(null)
    setOcrNome(null)
    setOcrPiva(null)
    setOcrIndirizzo(null)
    setNeedsSupplierDeepExtract(false)
    setDateFromOcr(false)
    setRegistrationTarget('bolla')
    if (f) {
      if (f.type.startsWith('image/')) {
        setPreview(URL.createObjectURL(f))
      } else {
        setPreview(null)
      }
      void runScannerHub(f, scanIntent, fornitori)
    } else {
      setPreview(null)
    }
  }

  const handleIntentChange = (next: ScanIntent) => {
    setScanIntent(next)
    setError(null)
    if (file) {
      void runScannerHub(file, next, fornitori)
    }
  }

  const handleRemoveFile = () => {
    setFile(null)
    setPreview(null)
    setOcrStatus('idle')
    setMatchedFornitore(null)
    setOcrNome(null)
    setOcrPiva(null)
    setOcrIndirizzo(null)
    setNeedsSupplierDeepExtract(false)
    setDateFromOcr(false)
    setRegistrationTarget('bolla')
    setUploadMode('idle')
    if (fileRef.current) fileRef.current.value = ''
    if (cameraRef.current) cameraRef.current.value = ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fornitoreId) { setError('Seleziona un fornitore.'); return }
    if (!file) { setError('Carica un documento.'); return }
    setSaving(true)
    setError(null)

    const ext = file.name.split('.').pop() ?? 'jpg'
    const uniqueName = `${crypto.randomUUID()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('documenti')
      .upload(uniqueName, file, { contentType: file.type, upsert: false })

    if (uploadError) {
      setError(`Errore durante il caricamento del file: ${uploadError.message}`)
      setSaving(false)
      return
    }

    const { data: publicUrlData } = supabase.storage
      .from('documenti')
      .getPublicUrl(uniqueName)

    const file_url = publicUrlData.publicUrl

    if (registrationTarget === 'fattura') {
      const importoFinale = importo ? parseFloat(importo) : null
      const { error: insertError } = await supabase.from('fatture').insert([{
        fornitore_id: fornitoreId,
        bolla_id: null,
        sede_id: sedeId,
        data,
        file_url,
        registrato_da: registratoDa.trim() || null,
        numero_fattura: numeroBolla.trim() || null,
        importo: importoFinale,
      }])

      setSaving(false)

      if (insertError) {
        setError(`Errore durante il salvataggio: ${insertError.message}`)
        return
      }

      router.push('/fatture')
      router.refresh()
      return
    }

    const { error: insertError } = await supabase.from('bolle').insert([{
      fornitore_id: fornitoreId,
      sede_id: sedeId,
      data,
      file_url,
      stato: 'in attesa',
      registrato_da: registratoDa.trim() || null,
      numero_bolla: numeroBolla.trim() || null,
      importo: importo ? parseFloat(importo) : null,
    }])

    setSaving(false)

    if (insertError) {
      setError(`Errore durante il salvataggio: ${insertError.message}`)
      return
    }

    router.push('/bolle')
    router.refresh()
  }

  const fieldLabelCls =
    'mb-3 block text-xs font-semibold uppercase tracking-wide text-cyan-400/80'
  const fieldInputCls =
    'w-full rounded-xl border-0 bg-transparent py-1 -mx-1 text-base text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-0'

  const intentBtn = (active: boolean) =>
    `rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors sm:px-3 sm:text-xs ${
      active
        ? 'bg-cyan-500/25 text-cyan-100 ring-1 ring-cyan-500/40'
        : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
    }`

  return (
    <div className="flex flex-col">
      <div className="sticky top-14 z-10 flex items-center gap-3 border-b border-slate-800/80 bg-slate-950/90 px-4 py-3 backdrop-blur-md md:top-0">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-800 hover:text-cyan-300"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold tracking-tight text-slate-100">{t.bolle.scannerTitle}</h1>
          <p className="truncate text-[11px] text-slate-500 sm:text-xs">
            {registrationTarget === 'fattura' ? t.bolle.scannerFlowFattura : t.bolle.scannerFlowBolla}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 p-4 pb-8">

        <div className="app-card">
          <div className="app-card-bar" aria-hidden />
          <div className="space-y-3 p-5">
            <p className={fieldLabelCls}>{t.bolle.scannerWhatLabel}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={intentBtn(scanIntent === 'auto')} onClick={() => handleIntentChange('auto')}>
                {t.bolle.scannerModeAuto}
              </button>
              <button type="button" className={intentBtn(scanIntent === 'bolla')} onClick={() => handleIntentChange('bolla')}>
                {t.bolle.scannerModeBolla}
              </button>
              <button type="button" className={intentBtn(scanIntent === 'fattura')} onClick={() => handleIntentChange('fattura')}>
                {t.bolle.scannerModeFattura}
              </button>
              <button type="button" className={intentBtn(scanIntent === 'nuovo_fornitore')} onClick={() => handleIntentChange('nuovo_fornitore')}>
                {t.bolle.scannerModeSupplier}
              </button>
            </div>
          </div>
        </div>

        <div className="app-card">
          <div className="app-card-bar" aria-hidden />
          <div className="p-5">
          <label className={fieldLabelCls}>
            {t.bolle.fotoLabel}
          </label>

          {!preview && !file?.type.startsWith('application/pdf') && uploadMode === 'idle' && (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => { setUploadMode('camera'); setTimeout(() => cameraRef.current?.click(), 50) }}
                className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-slate-600/70 py-8 text-slate-500 transition-colors hover:border-cyan-500/45 hover:text-cyan-300 active:bg-slate-800/50"
              >
                <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-sm font-semibold">{t.bolle.cameraBtn}</span>
              </button>
              <button
                type="button"
                onClick={() => { setUploadMode('file'); setTimeout(() => fileRef.current?.click(), 50) }}
                className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-slate-600/70 py-8 text-slate-500 transition-colors hover:border-cyan-500/45 hover:text-cyan-300 active:bg-slate-800/50"
              >
                <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span className="text-sm font-semibold">{t.bolle.fileBtn}</span>
              </button>
            </div>
          )}

          {preview ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="Anteprima"
                className="w-full rounded-xl object-cover max-h-64"
              />
              <button
                type="button"
                onClick={handleRemoveFile}
                className="absolute top-2 right-2 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {ocrStatus === 'scanning' && (
                <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/70 text-white text-xs px-3 py-1.5 rounded-full">
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  {t.bolle.ocrScanning}
                </div>
              )}
              {ocrStatus === 'matched' && (
                <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-emerald-500/90 px-3 py-1.5 text-xs text-white shadow-lg shadow-emerald-900/40">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                  </svg>
                  {t.bolle.ocrMatched}
                </div>
              )}
              {ocrStatus === 'not_found' && (
                <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-amber-500/90 px-3 py-1.5 text-xs text-amber-950 shadow-lg">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  {t.bolle.ocrNotFound}
                </div>
              )}
            </div>
          ) : null}

          {file?.type === 'application/pdf' && (
            <div className="relative rounded-xl border border-slate-600/60 bg-slate-800/50 px-4 py-8 text-center text-sm text-slate-400">
              <p>{t.bolle.scannerPdfPreview}</p>
              <p className="mt-2 truncate text-xs text-slate-500">{file.name}</p>
              <button
                type="button"
                onClick={handleRemoveFile}
                className="mt-4 text-xs font-semibold text-red-400 hover:text-red-300"
              >
                {t.common.delete}
              </button>
              {ocrStatus === 'scanning' && (
                <p className="mt-3 flex items-center justify-center gap-2 text-xs text-cyan-300">
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  {t.bolle.ocrAnalyzing}
                </p>
              )}
            </div>
          )}

          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFile}
            className="hidden"
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            onChange={handleFile}
            className="hidden"
          />
          </div>
        </div>

        {file && (
          <div className="app-card ring-1 ring-cyan-500/20">
            <div className="app-card-bar" aria-hidden />
            <div className="p-5">
            <label className={fieldLabelCls}>
              Registrato da
            </label>
            <input
              type="text"
              placeholder="Nome di chi ha registrato la bolla…"
              value={registratoDa}
              onChange={(e) => setRegistratoDa(e.target.value)}
              autoFocus
              className={fieldInputCls}
            />
            </div>
          </div>
        )}

        <div className="app-card">
          <div className="app-card-bar" aria-hidden />
          <div className="p-5">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wide text-cyan-400/80">
              {t.bolle.fornitoreLabel}
            </label>
            {ocrStatus === 'scanning' && (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                {t.bolle.ocrAnalyzing}
              </span>
            )}
            {ocrStatus === 'matched' && matchedFornitore && (
              <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/30">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                </svg>
                {t.bolle.ocrAutoRecognized}
              </span>
            )}
            {ocrStatus === 'not_found' && ocrNome && (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-200 ring-1 ring-amber-500/25">
                {t.bolle.ocrRead} &quot;{ocrNome.length > 20 ? ocrNome.slice(0, 20) + '…' : ocrNome}&quot;
              </span>
            )}
          </div>

          {fornitori.length === 0 ? (
            <p className="text-sm text-amber-300">
              {t.fornitori.noSuppliers}{' '}
              <a href="/fornitori/new" className="font-medium text-cyan-400 underline transition-colors hover:text-cyan-300">
                {t.fornitori.addFirst}
              </a>
            </p>
          ) : (
            <select
              required
              value={fornitoreId}
              onChange={(e) => {
                setFornitoreId(e.target.value)
                if (matchedFornitore && e.target.value !== matchedFornitore.id) {
                  setOcrStatus('idle')
                  setMatchedFornitore(null)
                }
              }}
              className={`mt-1 w-full cursor-pointer rounded-xl border border-slate-600/60 bg-slate-800/70 px-3 py-2.5 text-base text-slate-100 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 ${
                ocrStatus === 'matched' ? 'font-semibold text-cyan-100' : ''
              }`}
            >
              {fornitori.map((f) => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </select>
          )}

          {ocrStatus === 'not_found' && (ocrNome || ocrPiva) && (
            <button
              type="button"
              className="mt-3 w-full rounded-xl border border-violet-500/35 bg-violet-950/40 py-2.5 text-sm font-semibold text-violet-100 transition-colors hover:bg-violet-950/55"
              onClick={() => navigateToImport(ocrNome, ocrPiva, ocrIndirizzo)}
            >
              {t.bolle.scannerCreateSupplierCta}
            </button>
          )}
          {needsSupplierDeepExtract && file && ocrStatus === 'not_found' && (
            <button
              type="button"
              className="mt-3 w-full rounded-xl border border-cyan-500/40 bg-cyan-950/35 py-2.5 text-sm font-semibold text-cyan-100 transition-colors hover:bg-cyan-950/50"
              onClick={() => void runScannerHub(file, 'nuovo_fornitore', fornitori)}
            >
              {t.bolle.scannerCreateSupplierFromUnrecognized}
            </button>
          )}
          </div>
        </div>

        <div className="app-card overflow-hidden">
          <div className="app-card-bar" aria-hidden />
          <div className="border-b border-slate-700/50 p-5">
            <label className={fieldLabelCls}>
              {registrationTarget === 'fattura' ? t.fatture.colNumFattura : `N° Bolla / DDT`}{' '}
              <span className="font-normal normal-case text-slate-500">(opzionale)</span>
            </label>
            <input
              type="text"
              placeholder={registrationTarget === 'fattura' ? 'es. FT-2025-042' : 'es. DDT-2025-001'}
              value={numeroBolla}
              onChange={e => setNumeroBolla(e.target.value)}
              className={fieldInputCls}
            />
          </div>
          <div className="p-5">
            <label className={fieldLabelCls}>
              {t.appStrings.labelImportoTotale}{' '}
              <span className="font-normal normal-case text-slate-500">(IVA inclusa, opzionale)</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-base text-slate-500">£</span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={importo}
                onChange={e => setImporto(e.target.value)}
                className={`flex-1 ${fieldInputCls}`}
              />
            </div>
          </div>
        </div>

        <div className="app-card overflow-hidden">
          <div className="app-card-bar" aria-hidden />
          <div className={`p-5 transition-colors ${dateFromOcr ? 'bg-emerald-500/5' : ''}`}>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wide text-cyan-400/80">
                {registrationTarget === 'fattura' ? t.fatture.dataFattura : t.bolle.dataLabel}
              </label>
              {dateFromOcr ? (
                <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/30">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                  </svg>
                  {t.bolle.ocrAutoRecognized}
                </span>
              ) : (
                <span className="text-[11px] text-slate-500">{t.bolle.dateFromDocumentHint}</span>
              )}
            </div>
            <input
              type="date"
              required
              value={data}
              onChange={(e) => { setData(e.target.value); setDateFromOcr(false) }}
              className={`${fieldInputCls} [color-scheme:dark]`}
            />
          </div>

          <div className="flex items-center justify-between border-t border-slate-700/50 bg-slate-800/30 px-5 py-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t.appStrings.uploadDateLabel}
            </span>
            <span className="text-sm font-medium text-slate-400">
              {todayRegistrationLabel} — {t.appStrings.uploadDateAutomatic}
            </span>
          </div>
        </div>

        {error && (
          <p className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-300">{error}</p>
        )}

        <button
          type="submit"
          disabled={saving || fornitori.length === 0 || ocrStatus === 'scanning' || !file}
          className="app-glow-cyan mt-auto w-full rounded-2xl bg-cyan-500 py-4 text-base font-semibold text-slate-950 transition-colors hover:bg-cyan-400 active:bg-cyan-600 disabled:opacity-50"
        >
          {saving
            ? (registrationTarget === 'fattura' ? t.bolle.scannerSavingFattura : t.bolle.savingNote)
            : ocrStatus === 'scanning'
              ? t.bolle.analyzingNote
              : registrationTarget === 'fattura'
                ? t.bolle.scannerSaveFattura
                : t.bolle.saveNote}
        </button>
      </form>
    </div>
  )
}

export default function NuovaBollaPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-slate-500">
          <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
        </div>
      }
    >
      <NuovaBollaForm />
    </Suspense>
  )
}
