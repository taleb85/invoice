'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Fornitore } from '@/types'
import { useManualDeliverySede } from '@/lib/use-effective-sede-id'
import {
  findDuplicateFatturaId,
  findDuplicateFatturaSansNumeroByImporto,
  normalizeNumeroFattura,
} from '@/lib/fattura-duplicate-check'
import { useT } from '@/lib/use-t'
import { useLocale } from '@/lib/locale-context'
import { formatDate } from '@/lib/locale-shared'
import { useActiveOperator } from '@/lib/active-operator-context'
import { AppPageHeaderTitleWithDashboardShortcut } from '@/components/AppPageHeaderDashboardShortcut'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import { useEmailSyncProgressOptional } from '@/components/EmailSyncProgressProvider'
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

export default function NuovaBollaForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedFornitoreId = searchParams.get('fornitore_id') ?? ''
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  /** Stessa sede della dashboard (cookie admin / operatore attivo / profilo). */
  const { effectiveSedeId: sedeId } = useManualDeliverySede()
  const t = useT()
  const { locale, timezone } = useLocale()
  const { activeOperator } = useActiveOperator()
  const emailSyncCtx = useEmailSyncProgressOptional()
  const emailSyncBannerVisible =
    !!emailSyncCtx?.progress &&
    (emailSyncCtx.progress.active ||
      emailSyncCtx.progress.stalled ||
      emailSyncCtx.progress.toast !== null ||
      !!emailSyncCtx.progress.connectionWarning)

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
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [registratoDa, setRegistratoDa] = useState('')

  useEffect(() => {
    if (activeOperator?.full_name) {
      setRegistratoDa(activeOperator.full_name.toUpperCase())
    }
  }, [activeOperator])
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

      if (sedeId) {
        void supabase.from('scanner_flow_events').insert({ sede_id: sedeId, step: 'ai_elaborata' })
      }

      applyHubResult(result, intent, list)
    } catch {
      setOcrStatus('error')
    }
  }, [applyHubResult, sedeId, supabase])

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null
    setError(null)
    if (f && f.type !== 'application/pdf') {
      setError('Carica un PDF (documento ricevuto per email: fattura, bolla o estratto).')
      e.target.value = ''
      return
    }
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
      void runScannerHub(f, scanIntent, fornitori)
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
    setOcrStatus('idle')
    setMatchedFornitore(null)
    setOcrNome(null)
    setOcrPiva(null)
    setOcrIndirizzo(null)
    setNeedsSupplierDeepExtract(false)
    setDateFromOcr(false)
    setRegistrationTarget('bolla')
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fornitoreId) { setError('Seleziona un fornitore.'); return }
    if (!file) { setError('Carica un documento.'); return }
    setSaving(true)
    setError(null)

    if (registrationTarget === 'fattura') {
      const num = normalizeNumeroFattura(numeroBolla)
      if (num) {
        const dupId = await findDuplicateFatturaId(supabase, {
          sedeId,
          fornitoreId,
          data,
          numeroFattura: num,
        })
        if (dupId) {
          setError(t.fatture.duplicateInvoiceSameSupplierDateNumber)
          setSaving(false)
          return
        }
      } else {
        const importoFinale = importo ? parseFloat(importo) : null
        if (importoFinale != null && Number.isFinite(importoFinale)) {
          const dupSans = await findDuplicateFatturaSansNumeroByImporto(supabase, {
            sedeId,
            fornitoreId,
            data,
            importo: importoFinale,
          })
          if (dupSans) {
            setError(t.fatture.duplicateInvoiceSameSupplierDateAmountNoNumber)
            setSaving(false)
            return
          }
        }
      }
    }

    const ext = file.name.split('.').pop() ?? 'pdf'
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
        registrato_da: registratoDa.trim().toUpperCase() || null,
        numero_fattura: normalizeNumeroFattura(numeroBolla) || null,
        importo: importoFinale,
      }])

      setSaving(false)

      if (insertError) {
        setError(`Errore durante il salvataggio: ${insertError.message}`)
        return
      }

      if (sedeId) {
        void supabase.from('scanner_flow_events').insert({ sede_id: sedeId, step: 'archiviata_fattura' })
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
      registrato_da: registratoDa.trim().toUpperCase() || null,
      numero_bolla: numeroBolla.trim() || null,
      importo: importo ? parseFloat(importo) : null,
    }])

    setSaving(false)

    if (insertError) {
      setError(`Errore durante il salvataggio: ${insertError.message}`)
      return
    }

    if (sedeId) {
      void supabase.from('scanner_flow_events').insert({ sede_id: sedeId, step: 'archiviata_bolla' })
    }

    router.push('/bolle?tutte=1')
    router.refresh()
  }

  const fieldLabelTextCls =
    'text-xs font-bold uppercase tracking-wider text-cyan-50 [text-shadow:0_0_18px_rgba(34,211,238,0.2)]'
  const fieldLabelCls = `mb-2 block ${fieldLabelTextCls}`
  const fieldHintCls = 'font-semibold normal-case tracking-normal text-cyan-100/85'
  const fieldInputCls =
    'w-full rounded-xl border-0 bg-transparent py-1 -mx-1 text-base font-semibold text-white placeholder:text-cyan-200/55 focus:outline-none focus:ring-0'
  /** Campo «Registrato da»: bordo visibile (gli altri campi testuali restano flat nel layout). */
  const registeredByInputCls =
    'w-full rounded-xl border border-cyan-500/35 bg-white/[0.07] px-3 py-2 text-base font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] placeholder:text-cyan-200/55 transition-[border-color,box-shadow] focus:border-cyan-400/55 focus:outline-none focus:ring-2 focus:ring-cyan-400/25'

  const intentBtn = (active: boolean) =>
    `rounded-lg px-2 py-1 text-[11px] font-bold transition-colors sm:px-2.5 sm:py-1 sm:text-xs ${
      active
        ? 'bg-cyan-500/35 text-white ring-1 ring-cyan-300/50 shadow-[0_0_14px_-3px_rgba(6,182,212,0.45)]'
        : 'bg-white/10 text-cyan-50 hover:bg-white/15 hover:text-white'
    }`

  return (
    <div className="flex flex-col">
      {/*
        Su `/bolle/new` il main non ha più offset top (evita doppio offset con sticky). Sotto il topbar
        mobile serve spazio in flow solo quando la barra sync non è visibile (la sync bar ha già margin-top sotto topbar).
      */}
      {!emailSyncBannerVisible ? (
        <div className="h-[calc(3.5rem+env(safe-area-inset-top,0px))] shrink-0 md:hidden" aria-hidden />
      ) : null}
      {/*
        Mobile: `fixed` sotto topbar (o sotto topbar+sync). Desktop: sticky in cima al contenuto.
        Stessa forma della strip dashboard (`AppPageHeaderStrip`: card + app-card-bar + padding interno).
      */}
      <div
        className={`app-shell-page-padding-x z-10 max-md:fixed max-md:left-0 max-md:right-0 md:sticky md:top-0 max-md:mt-2 md:mt-2 ${
          emailSyncBannerVisible
            ? 'max-md:top-[calc(3.5rem+6.5rem+env(safe-area-inset-top,0px))]'
            : 'max-md:top-[calc(3.5rem+env(safe-area-inset-top,0px))]'
        }`}
      >
        <AppPageHeaderStrip dense className="!mb-0">
          <AppPageHeaderTitleWithDashboardShortcut
            dashboardLabel={t.nav.dashboard}
            className="min-w-0 w-full items-center gap-2 sm:flex-1"
          >
            <h1 className="app-page-title text-lg font-extrabold tracking-tight text-white [text-shadow:0_0_24px_rgba(34,211,238,0.35)] md:text-xl">
              {t.bolle.scannerTitle}
            </h1>
          </AppPageHeaderTitleWithDashboardShortcut>
        </AppPageHeaderStrip>
      </div>
      {/* Riserva altezza strip + barra neon + padding (allineato a `AppPageHeaderStrip`). */}
      <div className="h-[5.125rem] shrink-0 md:hidden" aria-hidden />

      <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-3 p-3 pb-6 sm:p-4 sm:pb-7">

        <div className="app-card">
          <div className="space-y-2 p-4">
            <p className={fieldLabelCls}>{t.bolle.scannerWhatLabel}</p>
            <div className="flex flex-wrap gap-1.5">
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
          <div className="p-4">
          <label className={fieldLabelCls}>
            {t.bolle.fotoLabel}
          </label>

          {!file && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-cyan-300/45 py-6 text-cyan-100 transition-colors hover:border-cyan-200/60 hover:bg-white/10 hover:text-white active:bg-white/15"
            >
              <svg className="h-8 w-8 text-cyan-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <span className="text-sm font-bold tracking-tight">{t.bolle.fileBtn} (PDF)</span>
            </button>
          )}

          {file?.type === 'application/pdf' && (
            <div className="relative rounded-xl border border-white/15 bg-white/5 px-3 py-6 text-center text-sm font-semibold text-white">
              <p>{t.bolle.scannerPdfPreview}</p>
              <p className="mt-1.5 truncate text-xs font-medium text-cyan-100">{file.name}</p>
              <button
                type="button"
                onClick={handleRemoveFile}
                className="mt-3 text-xs font-bold text-red-300 underline decoration-red-400/50 underline-offset-2 hover:text-red-200"
              >
                {t.common.delete}
              </button>
              {ocrStatus === 'scanning' && (
                <p className="mt-2 flex items-center justify-center gap-1.5 text-xs font-bold text-cyan-200">
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  {t.bolle.ocrAnalyzing}
                </p>
              )}
              {ocrStatus === 'matched' && (
                <p className="mt-2 flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-200">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                  </svg>
                  {t.bolle.ocrMatched}
                </p>
              )}
              {ocrStatus === 'not_found' && (
                <p className="mt-2 flex items-center justify-center gap-1.5 text-xs font-bold text-amber-200">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  {t.bolle.ocrNotFound}
                </p>
              )}
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            onChange={handleFile}
            className="hidden"
          />
          </div>
        </div>

        {file && (
          <div className="app-card ring-1 ring-cyan-400/30">
            <div className="p-4">
            <label className={fieldLabelCls}>
              Registrato da
            </label>
            <input
              type="text"
              placeholder="Nome di chi ha registrato la bolla…"
              value={registratoDa}
              onChange={(e) => setRegistratoDa(e.target.value.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
              className={registeredByInputCls}
            />
            </div>
          </div>
        )}

        <div className="app-card">
          <div className="p-4">
          <div className="mb-1.5 flex items-center justify-between">
            <label className={`min-w-0 shrink ${fieldLabelTextCls}`}>
              {t.bolle.fornitoreLabel}
            </label>
            {ocrStatus === 'scanning' && (
              <span className="flex items-center gap-1 text-xs font-bold text-cyan-100">
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                {t.bolle.ocrAnalyzing}
              </span>
            )}
            {ocrStatus === 'matched' && matchedFornitore && (
              <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-bold text-emerald-200 ring-1 ring-emerald-400/40">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                </svg>
                {t.bolle.ocrAutoRecognized}
              </span>
            )}
            {ocrStatus === 'not_found' && ocrNome && (
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-100 ring-1 ring-amber-400/35">
                {t.bolle.ocrRead} &quot;{ocrNome.length > 20 ? ocrNome.slice(0, 20) + '…' : ocrNome}&quot;
              </span>
            )}
          </div>

          {fornitori.length === 0 ? (
            <p className="text-sm font-semibold text-amber-100">
              {t.fornitori.noSuppliers}{' '}
              <Link href="/fornitori/new" className="font-bold text-cyan-100 underline decoration-cyan-400/40 underline-offset-2 transition-colors hover:text-white">
                {t.fornitori.addFirst}
              </Link>
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
              className={`mt-0.5 w-full cursor-pointer rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-base font-semibold text-white focus:border-cyan-300/55 focus:outline-none focus:ring-2 focus:ring-cyan-300/40 ${
                ocrStatus === 'matched' ? 'font-bold' : ''
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
              className="mt-2 w-full rounded-xl border border-violet-400/40 bg-violet-950/45 py-2 text-sm font-bold text-violet-50 transition-colors hover:bg-violet-900/55"
              onClick={() => navigateToImport(ocrNome, ocrPiva, ocrIndirizzo)}
            >
              {t.bolle.scannerCreateSupplierCta}
            </button>
          )}
          {needsSupplierDeepExtract && file && ocrStatus === 'not_found' && (
            <button
              type="button"
              className="mt-2 w-full rounded-xl border border-cyan-400/45 bg-cyan-950/40 py-2 text-sm font-bold text-cyan-50 transition-colors hover:bg-cyan-900/50"
              onClick={() => void runScannerHub(file, 'nuovo_fornitore', fornitori)}
            >
              {t.bolle.scannerCreateSupplierFromUnrecognized}
            </button>
          )}
          </div>
        </div>

        <div className="app-card overflow-hidden">
          <div className="border-b border-white/10 p-4">
            <label className={fieldLabelCls}>
              {registrationTarget === 'fattura' ? t.fatture.colNumFattura : `N° Bolla / DDT`}{' '}
              <span className={fieldHintCls}>(opzionale)</span>
            </label>
            <input
              type="text"
              placeholder={registrationTarget === 'fattura' ? 'es. FT-2025-042' : 'es. DDT-2025-001'}
              value={numeroBolla}
              onChange={e => setNumeroBolla(e.target.value)}
              className={fieldInputCls}
            />
          </div>
          <div className="p-4">
            <label className={fieldLabelCls}>
              {t.appStrings.labelImportoTotale}{' '}
              <span className={fieldHintCls}>(IVA inclusa, opzionale)</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-cyan-100">£</span>
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
          <div className={`p-4 transition-colors ${dateFromOcr ? 'bg-emerald-500/10' : ''}`}>
            <div className="mb-1.5 flex items-center justify-between">
              <label className={`min-w-0 shrink ${fieldLabelTextCls}`}>
                {registrationTarget === 'fattura' ? t.fatture.dataFattura : t.bolle.dataLabel}
              </label>
              {dateFromOcr ? (
                <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-bold text-emerald-200 ring-1 ring-emerald-400/40">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                  </svg>
                  {t.bolle.ocrAutoRecognized}
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-cyan-100">{t.bolle.dateFromDocumentHint}</span>
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

          <div className="flex items-center justify-between border-t border-white/10 bg-white/5 px-4 py-2">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-100">
              {t.appStrings.uploadDateLabel}
            </span>
            <span className="text-sm font-bold text-white">
              {todayRegistrationLabel} — {t.appStrings.uploadDateAutomatic}
            </span>
          </div>
        </div>

        {error && (
          <p className="rounded-xl border border-red-400/40 bg-red-950/50 px-3 py-2 text-sm font-semibold text-red-200">{error}</p>
        )}

        <button
          type="submit"
          disabled={saving || fornitori.length === 0 || ocrStatus === 'scanning' || !file}
          className="app-glow-cyan mt-auto w-full rounded-2xl border border-cyan-300/40 bg-cyan-500 py-3 text-base font-extrabold tracking-tight text-slate-950 shadow-[0_0_24px_-4px_rgba(6,182,212,0.5)] transition-colors hover:bg-cyan-400 active:bg-cyan-600 disabled:opacity-50"
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
