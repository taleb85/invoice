'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Fornitore } from '@/types'
import { useSedeId } from '@/lib/use-sede'
import { useT } from '@/lib/use-t'

type OcrStatus = 'idle' | 'scanning' | 'matched' | 'not_found' | 'error'

function normalizzaNome(s: string) {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

function matchFornitore(fornitori: Fornitore[], nome: string | null, piva: string | null): Fornitore | null {
  if (!fornitori.length) return null

  // 1. Match esatto su P.IVA (più affidabile)
  if (piva) {
    const pivaNorm = piva.replace(/\D/g, '')
    const byPiva = fornitori.find(f => f.piva && f.piva.replace(/\D/g, '') === pivaNorm)
    if (byPiva) return byPiva
  }

  // 2. Match parziale sul nome (case-insensitive)
  if (nome) {
    const nomeNorm = normalizzaNome(nome)
    // Match esatto normalizzato
    const exact = fornitori.find(f => normalizzaNome(f.nome) === nomeNorm)
    if (exact) return exact
    // Match parziale: il nome OCR contiene il nome del fornitore o viceversa
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

  const [fornitori, setFornitori] = useState<Fornitore[]>([])
  const [fornitoreId, setFornitoreId] = useState('')
  const [data, setData] = useState(new Date().toISOString().split('T')[0])
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [registratoDa, setRegistratoDa] = useState('')
  // 'idle' = mostra scelta, 'camera' = input fotocamera, 'file' = input file
  const [uploadMode, setUploadMode] = useState<'idle' | 'camera' | 'file'>('idle')

  // OCR state
  const [ocrStatus, setOcrStatus] = useState<OcrStatus>('idle')
  const [ocrNome, setOcrNome] = useState<string | null>(null)
  const [ocrPiva, setOcrPiva] = useState<string | null>(null)
  const [matchedFornitore, setMatchedFornitore] = useState<Fornitore | null>(null)
  const [dateFromOcr, setDateFromOcr] = useState(false)

  useEffect(() => {
    supabase.from('fornitori').select('id, nome, piva').order('nome').then(({ data }: { data: Fornitore[] | null }) => {
      const rows = (data as Fornitore[]) ?? []
      setFornitori(rows)
      // Pre-select from URL param if valid, otherwise default to first supplier
      if (preselectedFornitoreId && rows.some(f => f.id === preselectedFornitoreId)) {
        setFornitoreId(preselectedFornitoreId)
      } else if (rows.length > 0) {
        setFornitoreId(rows[0].id)
      }
    })
  }, [supabase, preselectedFornitoreId])

  const runOcr = async (f: File) => {
    // Solo immagini — PDF non supportato dall'OCR
    if (!f.type.startsWith('image/')) return

    setOcrStatus('scanning')
    setMatchedFornitore(null)
    setOcrNome(null)
    setOcrPiva(null)

    try {
      const fd = new FormData()
      fd.append('file', f)
      const res = await fetch('/api/ocr-bolla', { method: 'POST', body: fd })
      const result = await res.json()

      if (!res.ok || result.error) {
        setOcrStatus('error')
        return
      }

      const { nome, piva, data: dataOcr } = result as { nome: string | null; piva: string | null; data: string | null }
      setOcrNome(nome)
      setOcrPiva(piva)

      // Auto-fill date if extracted
      if (dataOcr) {
        setData(dataOcr)
        setDateFromOcr(true)
      }

      const match = matchFornitore(fornitori, nome, piva)
      if (match) {
        setMatchedFornitore(match)
        setFornitoreId(match.id)
        setOcrStatus('matched')
      } else {
        setOcrStatus('not_found')
      }
    } catch {
      setOcrStatus('error')
    }
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null
    setFile(f)
    setOcrStatus('idle')
    setMatchedFornitore(null)
    setDateFromOcr(false)
    if (f) {
      setPreview(URL.createObjectURL(f))
      runOcr(f)
    } else {
      setPreview(null)
    }
  }

  const handleRemoveFile = () => {
    setFile(null)
    setPreview(null)
    setOcrStatus('idle')
    setMatchedFornitore(null)
    setOcrNome(null)
    setOcrPiva(null)
    setDateFromOcr(false)
    setUploadMode('idle')
    if (fileRef.current) fileRef.current.value = ''
    if (cameraRef.current) cameraRef.current.value = ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fornitoreId) { setError('Seleziona un fornitore.'); return }
    setSaving(true)
    setError(null)

    let file_url: string | null = null
    if (file) {
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

      file_url = publicUrlData.publicUrl
    }

    const { error: insertError } = await supabase.from('bolle').insert([{
      fornitore_id: fornitoreId,
      sede_id: sedeId,
      data,
      file_url,
      stato: 'in attesa',
      registrato_da: registratoDa.trim() || null,
    }])

    setSaving(false)

    if (insertError) {
      setError(`Errore durante il salvataggio: ${insertError.message}`)
      return
    }

    router.push('/bolle')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header mobile */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button
          type="button"
          onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-500"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-gray-900">Nuova Bolla</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-4 p-4 max-w-lg mx-auto w-full">

        {/* Foto bolla — PRIMA del fornitore per trigger immediato dell'OCR */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            {t.bolle.fotoLabel}
          </label>

          {/* Scelta modalità upload */}
          {!preview && uploadMode === 'idle' && (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => { setUploadMode('camera'); setTimeout(() => cameraRef.current?.click(), 50) }}
                className="flex flex-col items-center gap-3 py-8 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:border-[#2a4a7f] hover:text-[#2a4a7f] transition-colors active:bg-[#e8edf5]"
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
                className="flex flex-col items-center gap-3 py-8 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:border-[#2a4a7f] hover:text-[#2a4a7f] transition-colors active:bg-[#e8edf5]"
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
                alt="Anteprima bolla"
                className="w-full rounded-xl object-cover max-h-64"
              />
              <button
                type="button"
                onClick={handleRemoveFile}
                className="absolute top-2 right-2 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Badge OCR sovrapposto */}
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
                <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-green-600 text-white text-xs px-3 py-1.5 rounded-full">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                  </svg>
                  {t.bolle.ocrMatched}
                </div>
              )}
              {ocrStatus === 'not_found' && (
                <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-amber-500 text-white text-xs px-3 py-1.5 rounded-full">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  {t.bolle.ocrNotFound}
                </div>
              )}
            </div>
          ) : null}

          {/* Input fotocamera */}
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFile}
            className="hidden"
          />
          {/* Input file picker */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            onChange={handleFile}
            className="hidden"
          />
        </div>

        {/* Registrato da — appare dopo che il file è stato caricato */}
        {file && (
          <div className="bg-white rounded-2xl border border-blue-100 p-5 ring-1 ring-blue-200/50">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Registrato da
            </label>
            <input
              type="text"
              placeholder="Nome di chi ha registrato la bolla…"
              value={registratoDa}
              onChange={(e) => setRegistratoDa(e.target.value)}
              autoFocus
              className="w-full text-base text-gray-900 border-0 bg-transparent focus:outline-none focus:ring-0 py-1 -mx-1 placeholder:text-gray-300"
            />
          </div>
        )}

        {/* Fornitore */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {t.bolle.fornitoreLabel}
            </label>
            {ocrStatus === 'scanning' && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                {t.bolle.ocrAnalyzing}
              </span>
            )}
            {ocrStatus === 'matched' && matchedFornitore && (
              <span className="flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                </svg>
                {t.bolle.ocrAutoRecognized}
              </span>
            )}
            {ocrStatus === 'not_found' && ocrNome && (
              <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                {t.bolle.ocrRead} &quot;{ocrNome.length > 20 ? ocrNome.slice(0, 20) + '…' : ocrNome}&quot;
              </span>
            )}
          </div>

          {fornitori.length === 0 ? (
            <p className="text-sm text-amber-600">
              {t.fornitori.noSuppliers}{' '}
              <a href="/fornitori/new" className="underline font-medium">{t.fornitori.addFirst}</a>
            </p>
          ) : (
            <select
              required
              value={fornitoreId}
              onChange={(e) => {
                setFornitoreId(e.target.value)
                // Se l'utente sovrascrive la scelta OCR, resetta il badge
                if (matchedFornitore && e.target.value !== matchedFornitore.id) {
                  setOcrStatus('idle')
                  setMatchedFornitore(null)
                }
              }}
              className={`w-full text-base text-gray-900 border-0 bg-transparent focus:outline-none focus:ring-0 py-1 -mx-1 cursor-pointer ${
                ocrStatus === 'matched' ? 'font-semibold' : ''
              }`}
            >
              {fornitori.map((f) => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </select>
          )}
        </div>

        {/* Date — documento + caricamento */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {/* Data sul documento */}
          <div className={`p-5 transition-colors ${dateFromOcr ? 'bg-green-50/40' : ''}`}>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {t.bolle.dataLabel}
              </label>
              {dateFromOcr ? (
                <span className="flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                  </svg>
                  {t.bolle.ocrAutoRecognized}
                </span>
              ) : (
                <span className="text-[11px] text-gray-300">Dal documento</span>
              )}
            </div>
            <input
              type="date"
              required
              value={data}
              onChange={(e) => { setData(e.target.value); setDateFromOcr(false) }}
              className="w-full text-base text-gray-900 border-0 bg-transparent focus:outline-none focus:ring-0 py-1 -mx-1"
            />
          </div>

          {/* Data di caricamento — automatica */}
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/60 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Data caricamento</span>
            <span className="text-sm text-gray-500 font-medium">
              {new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })} — automatica
            </span>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={saving || fornitori.length === 0 || ocrStatus === 'scanning'}
          className="w-full py-4 bg-accent hover:bg-accent-hover active:bg-cyan-700 disabled:opacity-50 text-white text-base font-semibold rounded-2xl transition-colors mt-auto shadow-sm"
        >
          {saving ? t.bolle.savingNote : ocrStatus === 'scanning' ? t.bolle.analyzingNote : t.bolle.saveNote}
        </button>
      </form>
    </div>
  )
}

export default function NuovaBollaPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">Caricamento…</div>}>
      <NuovaBollaForm />
    </Suspense>
  )
}
