'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useSedeId } from '@/lib/use-sede'
import { useT } from '@/lib/use-t'

interface ExtractedData {
  nome: string | null
  piva: string | null
  email: string | null
}

type Step = 'upload' | 'loading' | 'confirm' | 'saving'

export default function ImportFornitore() {
  const router = useRouter()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const { sedeId } = useSedeId()
  const t = useT()

  const [step, setStep] = useState<Step>('upload')
  const [preview, setPreview] = useState<string | null>(null)
  const [extracted, setExtracted] = useState<ExtractedData>({ nome: null, piva: null, email: null })
  const [form, setForm] = useState({ nome: '', piva: '', email: '' })
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)

    // Preview
    if (file.type.startsWith('image/')) {
      setPreview(URL.createObjectURL(file))
    } else {
      setPreview(null)
    }

    setStep('loading')

    try {
      const fd = new FormData()
      fd.append('file', file)

      const res = await fetch('/api/ocr-fattura', { method: 'POST', body: fd })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Errore durante l\'analisi.')
        setStep('upload')
        return
      }

      const result: ExtractedData = data
      setExtracted(result)
      setForm({
        nome: result.nome ?? '',
        piva: result.piva ?? '',
        email: result.email ?? '',
      })
      setStep('confirm')
    } catch {
      setError('Errore di rete. Riprova.')
      setStep('upload')
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nome.trim()) { setError('Il nome è obbligatorio.'); return }
    setStep('saving')
    setError(null)

    const { error: err } = await supabase.from('fornitori').insert([{
      nome: form.nome.trim(),
      email: form.email.trim() || null,
      piva: form.piva.trim() || null,
      sede_id: sedeId,
    }])

    if (err) {
      setError(err.message)
      setStep('confirm')
      return
    }

    router.push('/fornitori')
    router.refresh()
  }

  const inputCls = 'w-full rounded-lg border border-slate-600/50 bg-slate-900/90 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500'
  const labelCls = 'block text-xs font-medium text-slate-400 mb-1'

  return (
    <div className="p-4 md:p-8 max-w-lg">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => router.back()} className="text-slate-500 hover:text-slate-400 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-100">{t.fornitori.importaDaFattura}</h1>
          <p className="text-sm text-slate-400 mt-0.5">{t.bolle.ocrHint}</p>
        </div>
      </div>

      {/* Step: Upload */}
      {(step === 'upload' || step === 'loading') && (
        <div className="bg-slate-900/90 rounded-xl border border-slate-700/50 p-6">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleFileChange}
            className="hidden"
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />

          {step === 'loading' ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-white/20 border-t-[#1a3050] animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center text-xl">🤖</div>
              </div>
              <div className="text-center">
                <p className="font-medium text-slate-100">{t.bolle.ocrAnalyzing}</p>
                <p className="text-sm text-slate-400 mt-1">{t.bolle.analyzingNote}</p>
              </div>
            </div>
          ) : (
            <div className="w-full border-2 border-dashed border-slate-600/50 rounded-xl p-8 flex flex-col items-center gap-4">
              <div className="w-14 h-14 bg-slate-800/80 rounded-xl flex items-center justify-center">
                <svg className="w-7 h-7 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="text-center">
                <p className="font-semibold text-slate-100">{t.fatture.caricaFatturaTitle}</p>
                <p className="text-sm text-slate-400 mt-1">{t.bolle.takePhotoOrFile}</p>
              </div>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => cameraRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-600/50 hover:bg-slate-800/60 text-slate-200 text-sm font-medium rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {t.bolle.cameraBtn}
                </button>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  {t.bolle.fileBtn}
                </button>
              </div>
            </div>
          )}

          {error && (
            <p className="mt-4 text-sm text-red-300 bg-red-500/10 px-4 py-2.5 rounded-lg">{error}</p>
          )}
        </div>
      )}

      {/* Step: Confirm */}
      {(step === 'confirm' || step === 'saving') && (
        <div className="space-y-4">
          {/* Preview documento */}
          {preview && (
            <div className="bg-slate-900/90 rounded-xl border border-slate-700/50 overflow-hidden">
              <img src={preview} alt="Documento" className="w-full max-h-48 object-contain p-2 bg-slate-800/60" />
            </div>
          )}

          {/* Badge campi estratti */}
          <div className="flex gap-2 flex-wrap">
            {extracted.nome && <span className="text-xs px-2.5 py-1 border border-emerald-500/35 bg-emerald-500/15 text-emerald-200 rounded-full font-medium">✓ {t.fornitori.nome}</span>}
            {extracted.piva && <span className="text-xs px-2.5 py-1 border border-emerald-500/35 bg-emerald-500/15 text-emerald-200 rounded-full font-medium">✓ {t.fornitori.piva}</span>}
            {extracted.email && <span className="text-xs px-2.5 py-1 border border-emerald-500/35 bg-emerald-500/15 text-emerald-200 rounded-full font-medium">✓ {t.fornitori.email}</span>}
            {!extracted.nome && <span className="text-xs px-2.5 py-1 border border-amber-500/35 bg-amber-500/15 text-amber-200 rounded-full font-medium">⚠ {t.bolle.ocrNotFound}</span>}
          </div>

          <form onSubmit={handleSave} className="bg-slate-900/90 rounded-xl border border-slate-700/50 p-6 space-y-4">
            <p className="text-sm text-slate-400 font-medium">{t.bolle.ocrMatched}:</p>

            <div>
              <label className={labelCls}>{t.fornitori.nome} *</label>
              <input
                className={inputCls}
                required
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder={t.fornitori.namePlaceholder}
              />
            </div>
            <div>
              <label className={labelCls}>{t.fornitori.email}</label>
              <input
                type="email"
                className={inputCls}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder={t.fornitori.emailPlaceholder}
              />
            </div>
            <div>
              <label className={labelCls}>{t.fornitori.pivaLabel}</label>
              <input
                className={inputCls}
                value={form.piva}
                onChange={(e) => setForm({ ...form, piva: e.target.value })}
                placeholder={t.fornitori.pivaPlaceholder}
              />
            </div>

            {error && <p className="text-sm text-red-300 bg-red-500/10 px-4 py-2.5 rounded-lg">{error}</p>}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setStep('upload'); setPreview(null); if (fileRef.current) fileRef.current.value = '' }}
                className="flex-1 py-2.5 text-sm font-medium text-slate-400 border border-slate-600/50 rounded-lg hover:bg-slate-800/60 transition-colors"
              >
                {t.log.retry}
              </button>
              <button
                type="submit"
                disabled={step === 'saving'}
                className="flex-1 py-2.5 text-sm font-medium bg-cyan-500 hover:bg-cyan-600 disabled:opacity-60 text-white rounded-lg transition-colors"
              >
                {step === 'saving' ? t.fornitori.saving : t.fornitori.new}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
