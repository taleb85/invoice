'use client'

import { Suspense, useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useSedeId } from '@/lib/use-sede'
import { useT } from '@/lib/use-t'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'

interface ExtractedData {
  nome: string | null
  piva: string | null
  email: string | null
}

type Step = 'upload' | 'loading' | 'confirm' | 'saving'

function ImportFornitoreInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const { sedeId } = useSedeId()
  const t = useT()
  const prefillApplied = useRef(false)

  const [step, setStep] = useState<Step>('upload')
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)
  const [extracted, setExtracted] = useState<ExtractedData>({ nome: null, piva: null, email: null })
  const [form, setForm] = useState({ nome: '', piva: '', email: '', indirizzo: '' })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (prefillApplied.current) return
    const n = searchParams.get('prefill_nome')
    const p = searchParams.get('prefill_piva')
    const e = searchParams.get('prefill_email')
    const a = searchParams.get('prefill_indirizzo')
    if (!n && !p && !e && !a) return
    prefillApplied.current = true
    setExtracted({ nome: n, piva: p, email: e })
    setForm({
      nome: (n ?? '').trim(),
      piva: (p ?? '').trim(),
      email: (e ?? '').trim().toLowerCase(),
      indirizzo: (a ?? '').trim(),
    })
    setStep('confirm')
  }, [searchParams])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)

    if (file.type !== 'application/pdf') {
      setError('Carica un PDF (es. fattura o documento da mail).')
      e.target.value = ''
      return
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
      setUploadedFileName(file.name)
      setForm({
        nome: result.nome ?? '',
        piva: result.piva ?? '',
        email: result.email ?? '',
        indirizzo: '',
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

    // sede_id: stessa sede per tutti gli utenti Accesso Sede → visibile a tutti (RLS fornitori per sede)
    const { data: ins, error: err } = await supabase
      .from('fornitori')
      .insert([{
        nome: form.nome.trim(),
        email: form.email.trim() || null,
        piva: form.piva.trim() || null,
        indirizzo: form.indirizzo.trim() || null,
        sede_id: sedeId,
      }])
      .select('id')
      .single()

    if (err) {
      setError(err.message)
      setStep('confirm')
      return
    }

    const emailNorm = form.email.trim().toLowerCase()
    if (ins?.id && emailNorm.includes('@')) {
      await fetch('/api/fornitore-emails/remember', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fornitore_id: ins.id, email: emailNorm }),
      })
    }

    router.push('/fornitori')
    router.refresh()
  }

  const inputCls = 'w-full rounded-lg border border-slate-600/50 bg-slate-700/90 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500'
  const labelCls = 'block text-xs font-medium text-slate-200 mb-1'

  return (
    <div className="p-4 md:p-8 max-w-lg">
      <AppPageHeaderStrip>
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <button
            onClick={() => router.back()}
            className="mt-0.5 shrink-0 text-slate-500 transition-colors hover:text-slate-200"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="app-page-title text-2xl font-bold">{t.fornitori.importaDaFattura}</h1>
            <p className="mt-0.5 text-sm text-slate-200">{t.bolle.ocrHint}</p>
          </div>
        </div>
      </AppPageHeaderStrip>

      {(step === 'upload' || step === 'loading') && (
        <div className="bg-slate-700/90 rounded-xl border border-slate-700/50 p-6">
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
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
                <p className="text-sm text-slate-200 mt-1">{t.bolle.analyzingNote}</p>
              </div>
            </div>
          ) : (
            <div className="w-full border-2 border-dashed border-slate-600/50 rounded-xl p-8 flex flex-col items-center gap-4">
              <div className="w-14 h-14 bg-slate-700/80 rounded-xl flex items-center justify-center">
                <svg className="w-7 h-7 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="text-center">
                <p className="font-semibold text-slate-100">{t.fatture.caricaFatturaTitle}</p>
                <p className="text-sm text-slate-200 mt-1">PDF (documento da mail o allegato)</p>
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 px-4 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                {t.bolle.fileBtn} (PDF)
              </button>
            </div>
          )}

          {error && (
            <p className="mt-4 text-sm text-red-300 bg-red-500/10 px-4 py-2.5 rounded-lg">{error}</p>
          )}
        </div>
      )}

      {(step === 'confirm' || step === 'saving') && (
        <div className="space-y-4">
          {uploadedFileName && (
            <div className="flex items-center gap-3 rounded-xl border border-slate-700/50 bg-slate-700/90 px-4 py-3">
              <svg className="h-8 w-8 shrink-0 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <p className="min-w-0 truncate text-sm text-slate-200">{uploadedFileName}</p>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            {extracted.nome && <span className="text-xs px-2.5 py-1 border border-emerald-500/35 bg-emerald-500/15 text-emerald-200 rounded-full font-medium">✓ {t.fornitori.nome}</span>}
            {extracted.piva && <span className="text-xs px-2.5 py-1 border border-emerald-500/35 bg-emerald-500/15 text-emerald-200 rounded-full font-medium">✓ {t.fornitori.piva}</span>}
            {extracted.email && <span className="text-xs px-2.5 py-1 border border-emerald-500/35 bg-emerald-500/15 text-emerald-200 rounded-full font-medium">✓ {t.fornitori.email}</span>}
            {!extracted.nome && <span className="text-xs px-2.5 py-1 border border-amber-500/35 bg-amber-500/15 text-amber-200 rounded-full font-medium">⚠ {t.bolle.ocrNotFound}</span>}
          </div>

          <form onSubmit={handleSave} className="bg-slate-700/90 rounded-xl border border-slate-700/50 p-6 space-y-4">
            <p className="text-sm text-slate-200 font-medium">{t.bolle.ocrMatched}:</p>

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
            <div>
              <label className={labelCls}>{t.fornitori.addressLabel}</label>
              <input
                className={inputCls}
                value={form.indirizzo}
                onChange={(e) => setForm({ ...form, indirizzo: e.target.value })}
                placeholder={t.fornitori.addressPlaceholder}
              />
            </div>

            {error && <p className="text-sm text-red-300 bg-red-500/10 px-4 py-2.5 rounded-lg">{error}</p>}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setStep('upload'); setUploadedFileName(null); prefillApplied.current = false; if (fileRef.current) fileRef.current.value = '' }}
                className="flex-1 py-2.5 text-sm font-medium text-slate-200 border border-slate-600/50 rounded-lg hover:bg-slate-700/60 transition-colors"
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

export default function ImportFornitorePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center p-8 text-slate-500">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
        </div>
      }
    >
      <ImportFornitoreInner />
    </Suspense>
  )
}
