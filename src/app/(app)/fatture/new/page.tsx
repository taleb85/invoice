'use client'

import { Suspense, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useSedeId } from '@/lib/use-sede'
import { useT } from '@/lib/use-t'

type OcrStatus = 'idle' | 'scanning' | 'done' | 'error'

function NuovaFatturaForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const { sedeId } = useSedeId()
  const t = useT()

  const bollaId = searchParams.get('bolla_id') ?? ''
  const fornitoreId = searchParams.get('fornitore_id') ?? ''

  const [data, setData] = useState(new Date().toISOString().split('T')[0])
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [registratoDa, setRegistratoDa] = useState('')
  const [uploadMode, setUploadMode] = useState<'idle' | 'camera' | 'file'>('idle')
  const [ocrStatus, setOcrStatus] = useState<OcrStatus>('idle')
  const [dateFromOcr, setDateFromOcr] = useState(false)

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

      if (result.data) {
        setData(result.data)
        setDateFromOcr(true)
      }
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
    if (f) {
      setPreview(URL.createObjectURL(f))
      runOcr(f)
    } else {
      setPreview(null)
    }
  }

  const removeFile = () => {
    setFile(null)
    setPreview(null)
    setOcrStatus('idle')
    setDateFromOcr(false)
    setUploadMode('idle')
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

    const { data: publicUrlData } = supabase.storage
      .from('documenti')
      .getPublicUrl(uniqueName)

    const file_url = publicUrlData.publicUrl

    const { error: insertError } = await supabase.from('fatture').insert([{
      fornitore_id: fornitoreId || null,
      bolla_id: bollaId || null,
      sede_id: sedeId,
      data,
      file_url,
      registrato_da: registratoDa.trim() || null,
    }])

    if (insertError) {
      setError(`Errore salvataggio fattura: ${insertError.message}`)
      setSaving(false)
      return
    }

    if (bollaId) {
      const { error: updateError } = await supabase
        .from('bolle')
        .update({ stato: 'completato' })
        .eq('id', bollaId)

      if (updateError) {
        setError(`Fattura salvata, ma errore aggiornamento bolla: ${updateError.message}`)
        setSaving(false)
        return
      }
    }

    router.push('/bolle')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Header */}
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
        <div>
          <h1 className="text-lg font-bold text-gray-900">{t.fatture.caricaFatturaTitle}</h1>
          {bollaId && <p className="text-xs text-gray-400 mt-0.5">{t.fatture.bollaMarkata}</p>}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-4 p-4 max-w-lg mx-auto w-full">

        {/* Banner bolla collegata */}
        {bollaId && (
          <div className="bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4 flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-700">{t.fatture.collegataABolla}</p>
              <p className="text-xs text-blue-500 mt-0.5">{t.fatture.bollaPasseraCompletato}</p>
            </div>
          </div>
        )}

        {/* Foto / file fattura */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            {t.fatture.fileFattura} <span className="text-red-400">*</span>
          </label>

          {/* Scelta modalità */}
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

          {/* Anteprima immagine */}
          {preview && file?.type !== 'application/pdf' && (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Anteprima fattura" className="w-full rounded-xl object-cover max-h-64" />
              <button
                type="button"
                onClick={removeFile}
                className="absolute top-2 right-2 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Badge OCR */}
              {ocrStatus === 'scanning' && (
                <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/70 text-white text-xs px-3 py-1.5 rounded-full">
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  {t.bolle.ocrScanning}
                </div>
              )}
              {ocrStatus === 'done' && dateFromOcr && (
                <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-green-600 text-white text-xs px-3 py-1.5 rounded-full">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                  </svg>
                  Data rilevata
                </div>
              )}
            </div>
          )}

          {/* Anteprima PDF */}
          {preview && file?.type === 'application/pdf' && (
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{(file.size / 1024).toFixed(0)} KB</p>
              </div>
              <button type="button" onClick={removeFile} className="text-gray-300 hover:text-red-400 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Input fotocamera */}
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" />
          {/* Input file picker */}
          <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={handleFile} className="hidden" />
        </div>

        {/* Registrato da — appare dopo che il file è stato caricato */}
        {file && (
          <div className="bg-white rounded-2xl border border-blue-100 p-5 ring-1 ring-blue-200/50">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Registrato da
            </label>
            <input
              type="text"
              placeholder="Nome di chi ha registrato la fattura…"
              value={registratoDa}
              onChange={(e) => setRegistratoDa(e.target.value)}
              autoFocus
              className="w-full text-base text-gray-900 border-0 bg-transparent focus:outline-none focus:ring-0 py-1 -mx-1 placeholder:text-gray-300"
            />
          </div>
        )}

        {/* Data fattura */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className={`p-5 transition-colors ${dateFromOcr ? 'bg-green-50/40' : ''}`}>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {t.fatture.dataFattura}
              </label>
              {ocrStatus === 'scanning' && (
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Analisi in corso…
                </span>
              )}
              {dateFromOcr && (
                <span className="flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                  </svg>
                  {t.bolle.ocrAutoRecognized}
                </span>
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

        {/* Errore */}
        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl">
            <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={saving || ocrStatus === 'scanning'}
          className="w-full py-4 bg-[#1a3050] hover:bg-[#122238] active:bg-[#0d1e35] disabled:opacity-50 text-white text-base font-semibold rounded-2xl transition-colors mt-auto shadow-sm flex items-center justify-center gap-2"
        >
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
              {t.fatture.salvaChiudiBolla}
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
