'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { mutate as swrMutate } from 'swr'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { queueAction } from '@/lib/offline-queue'

const SCAN_ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const

function isAllowedScanMime(ct: string): boolean {
  return (SCAN_ALLOWED_MIME as readonly string[]).includes(ct)
}
import { NewFornitoreLink } from '@/components/NewFornitoreLink'
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
import { documentiPublicRefUrl } from '@/lib/documenti-storage-url'
import RegistratoDaField from '@/components/RegistratoDaField'
import DataFieldWithOcrBadge from '@/components/DataFieldWithOcrBadge'
import ScannerFileUploadSection from '@/components/ScannerFileUploadSection'
import ScannerCameraModal from '@/components/ScannerCameraModal'
import { AppPageHeaderTitleWithDashboardShortcut } from '@/components/AppPageHeaderDashboardShortcut'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import { BackButton } from '@/components/BackButton'
import { useEmailSyncProgressOptional } from '@/components/EmailSyncProgressProvider'
import { navigateAfterDetailAction } from '@/lib/return-navigation-client'
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
  const isOnline = useOnlineStatus()
  const fileRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [scanPreviewUrl, setScanPreviewUrl] = useState<string | null>(null)
  /** Stessa sede della dashboard (cookie admin / operatore attivo / profilo). */
  const { effectiveSedeId: sedeId } = useManualDeliverySede()
  const t = useT()
  const { locale, timezone } = useLocale()
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
  const [quantita, setQuantita] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [registratoDa, setRegistratoDa] = useState('')
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

  useEffect(() => {
    if (!file || file.type === 'application/pdf') {
      setScanPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      return
    }
    const url = URL.createObjectURL(file)
    setScanPreviewUrl(url)
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [file])

  useEffect(() => {
    if (!cameraOpen) return
    const video = videoRef.current
    const stream = streamRef.current
    if (!video || !stream) return
    video.srcObject = stream
    void video.play().catch(() => {})
    return () => {
      video.srcObject = null
    }
  }, [cameraOpen])

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((tr) => tr.stop())
      streamRef.current = null
    },
    [],
  )

  const stopCameraStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  const closeCameraModal = useCallback(() => {
    stopCameraStream()
    setCameraOpen(false)
  }, [stopCameraStream])

  useEffect(() => {
    if (!cameraOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCameraModal()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cameraOpen, closeCameraModal])

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

  const applyScanFile = useCallback(
    (f: File) => {
      setError(null)
      setFile(f)
      setOcrStatus('idle')
      setMatchedFornitore(null)
      setOcrNome(null)
      setOcrPiva(null)
      setOcrIndirizzo(null)
      setNeedsSupplierDeepExtract(false)
      setDateFromOcr(false)
      setRegistrationTarget('bolla')
      void runScannerHub(f, scanIntent, fornitori)
    },
    [fornitori, runScannerHub, scanIntent],
  )

  const openCamera = useCallback(async () => {
    setError(null)
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError(t.bolle.scannerCameraPermissionDenied)
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })
      streamRef.current = stream
      setCameraOpen(true)
    } catch {
      setError(t.bolle.scannerCameraPermissionDenied)
    }
  }, [t])

  const capturePhoto = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    const w = video.videoWidth
    const h = video.videoHeight
    if (!w || !h) return
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        const f = new File([blob], `bolla-scan-${Date.now()}.jpg`, { type: 'image/jpeg' })
        stopCameraStream()
        setCameraOpen(false)
        applyScanFile(f)
      },
      'image/jpeg',
      0.92,
    )
  }, [applyScanFile, stopCameraStream])

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null
    if (!f) return
    if (!isAllowedScanMime(f.type)) {
      setError(t.bolle.scannerFileScanTypeError)
      e.target.value = ''
      return
    }
    applyScanFile(f)
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

    // ── Offline path: queue the action for later sync ──────────────────
    if (!isOnline) {
      try {
        const fileData = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
        await queueAction({
          type: 'bolla.create',
          payload: {
            fornitore_id: fornitoreId,
            sede_id: sedeId ?? '',
            data,
            numero_bolla: numeroBolla.trim() || '',
            importo: importo || '',
            registrato_da: registratoDa.trim().toUpperCase() || '',
          },
          fileData,
          fileType: file.type,
        })
        setSaving(false)
        setError(null)
        // Show inline success message then navigate
        alert('Bolla salvata offline — verrà sincronizzata quando torni online')
        navigateAfterDetailAction(router, searchParams)
      } catch {
        setSaving(false)
        setError('Impossibile salvare offline. Riprova.')
      }
      return
    }
    // ─────────────────────────────────────────────────────────────────

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

    const file_url = documentiPublicRefUrl(uniqueName)

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

      navigateAfterDetailAction(router, searchParams)
      router.refresh()
      return
    }

    const quantitaFinale =
      quantita.trim() !== '' && Number.isFinite(parseFloat(quantita))
        ? parseFloat(quantita)
        : null
    const { error: insertError } = await supabase.from('bolle').insert([{
      fornitore_id: fornitoreId,
      sede_id: sedeId,
      data,
      file_url,
      stato: 'in attesa',
      registrato_da: registratoDa.trim().toUpperCase() || null,
      numero_bolla: numeroBolla.trim() || null,
      importo: null,
      ...(quantitaFinale != null ? { quantita: quantitaFinale } : {}),
    }])

    setSaving(false)

    if (insertError) {
      setError(`Errore durante il salvataggio: ${insertError.message}`)
      return
    }

    if (sedeId) {
      void supabase.from('scanner_flow_events').insert({ sede_id: sedeId, step: 'archiviata_bolla' })
    }

    // Invalidate SWR caches that include bolla counts / open-bolle lists
    void swrMutate((key: unknown) => typeof key === 'string' && key.startsWith('/api/bolle-aperte'), undefined, { revalidate: true })
    void swrMutate('/api/operator-workspace-header', undefined, { revalidate: true })

    navigateAfterDetailAction(router, searchParams)
    router.refresh()
  }

  const fieldLabelTextCls = 'text-xs font-bold uppercase tracking-wider text-app-fg-muted'
  const fieldLabelCls = `mb-2 block ${fieldLabelTextCls}`
  const fieldHintCls = 'font-semibold normal-case tracking-normal text-app-fg-muted'
  const fieldInputCls =
    'w-full rounded-xl border border-app-line-35 app-workspace-inset-bg-soft px-3 py-2 text-base font-semibold text-app-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-app-line-10 placeholder:text-app-fg-placeholder transition-[border-color,box-shadow] focus:border-app-a-55 focus:outline-none focus:ring-2 focus:ring-app-a-30'
  /** Campo «Registrato da»: stesso guscio bordato degli altri input dello scanner. */
  const registeredByInputCls =
    'w-full rounded-xl border border-app-line-35 app-workspace-inset-bg-soft px-3 py-2 text-base font-semibold text-app-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-app-line-10 placeholder:text-app-fg-placeholder transition-[border-color,box-shadow] focus:border-app-a-55 focus:outline-none focus:ring-2 focus:ring-app-a-30'

  const intentBtn = (active: boolean) =>
    `rounded-lg border px-2 py-1 text-[11px] font-bold transition-colors sm:px-2.5 sm:py-1 sm:text-xs ${
      active
        ? 'border-app-a-45 bg-app-line-30 text-app-fg shadow-[0_0_14px_-3px_rgba(6,182,212,0.45)] ring-1 ring-app-tint-300-45'
        : 'border-app-line-25 app-workspace-inset-bg-soft text-app-fg-muted hover:border-app-a-40 hover:brightness-110 hover:text-app-fg'
    }`

  return (
    <div className="flex flex-col">
      <div className="app-shell-page-padding-x pt-2 md:pt-3">
        <BackButton href="/bolle" label={t.nav.bolle} className="mb-2 md:mb-3" />
      </div>
      {/*
        Su `/bolle/new` il main non ha più offset top (evita doppio offset con sticky). Sotto il topbar
        mobile serve spazio in flow solo quando la barra sync non è visibile (la sync bar ha già margin-top sotto topbar).
      */}
      {!emailSyncBannerVisible ? (
        <div className="h-[calc(3.5rem+env(safe-area-inset-top,0px))] shrink-0 md:hidden" aria-hidden />
      ) : null}
      {/*
        Mobile: `fixed` sotto topbar (o sotto topbar+sync). Desktop: sticky in cima al contenuto.
        Stessa forma della strip dashboard (`AppPageHeaderStrip`: card + padding interno).
      */}
      <div
        className={`nuova-bolla-scanner-mobile-header app-shell-page-padding-x z-10 max-md:fixed max-md:left-0 max-md:right-0 md:sticky md:top-0 max-md:mt-2 md:mt-2 ${
          emailSyncBannerVisible
            ? 'max-md:top-[calc(3.5rem+6.5rem+env(safe-area-inset-top,0px))]'
            : 'max-md:top-[calc(3.5rem+env(safe-area-inset-top,0px))]'
        }`}
      >
        <AppPageHeaderStrip dense flushBottom>
          <AppPageHeaderTitleWithDashboardShortcut className="min-w-0 w-full items-center gap-2 sm:flex-1">
            <h1 className="app-page-title text-lg font-extrabold tracking-tight md:text-xl">
              {t.bolle.scannerTitle}
            </h1>
          </AppPageHeaderTitleWithDashboardShortcut>
        </AppPageHeaderStrip>
      </div>
      {/* Riserva altezza strip + padding (allineato a `AppPageHeaderStrip`). */}
      <div className="h-[5.125rem] shrink-0 md:hidden" aria-hidden />

      <form
        onSubmit={handleSubmit}
        className="nuova-bolla-scanner-mobile mx-auto flex min-w-0 w-full max-w-lg flex-1 flex-col gap-3 p-3 pb-6 sm:p-4 sm:pb-7"
      >

        <div className="app-card overflow-hidden">
          <div className="space-y-2 border-t border-app-line-10 app-workspace-inset-bg p-4">
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

        <ScannerFileUploadSection
          file={file}
          scanPreviewUrl={scanPreviewUrl}
          ocrStatus={ocrStatus}
          fileRef={fileRef}
          onFileSelect={handleFile}
          onOpenCamera={() => void openCamera()}
          onRemoveFile={handleRemoveFile}
        />

        <RegistratoDaField
          value={registratoDa}
          onChange={setRegistratoDa}
          show={!!file}
          upperCase
          autoFocus
          placeholder="Nome di chi ha registrato la bolla…"
          wrapperClassName="app-card overflow-hidden ring-1 ring-app-a-30"
          innerClassName="border-t border-app-line-10 app-workspace-inset-bg p-4"
          inputClassName={registeredByInputCls}
        />

        <div className="app-card overflow-hidden">
          <div className="border-t border-app-line-10 app-workspace-inset-bg p-4">
          <div className="mb-1.5 flex items-center justify-between">
            <label className={`min-w-0 shrink ${fieldLabelTextCls}`}>
              {t.bolle.fornitoreLabel}
            </label>
            {ocrStatus === 'scanning' && (
              <span className="flex items-center gap-1 text-xs font-bold text-app-fg-muted">
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
              <NewFornitoreLink
                href="/fornitori/new"
                className="font-bold text-app-fg-muted underline decoration-app-a-45 underline-offset-2 transition-colors hover:text-app-fg"
              >
                {t.fornitori.addFirst}
              </NewFornitoreLink>
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
              className={`mt-0.5 w-full cursor-pointer rounded-lg border border-app-line-28 app-workspace-inset-bg-soft px-3 py-2 text-base font-semibold text-app-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-app-line-10 [color-scheme:dark] focus:border-app-a-55 focus:outline-none focus:ring-2 focus:ring-app-a-30 ${
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
              className="mt-2 w-full rounded-xl border border-[rgba(34,211,238,0.15)] bg-violet-950/45 py-2 text-sm font-bold text-violet-50 transition-colors hover:bg-violet-900/55"
              onClick={() => navigateToImport(ocrNome, ocrPiva, ocrIndirizzo)}
            >
              {t.bolle.scannerCreateSupplierCta}
            </button>
          )}
          {needsSupplierDeepExtract && file && ocrStatus === 'not_found' && (
            <button
              type="button"
              className="mt-2 w-full rounded-xl border border-app-a-45 app-workspace-inset-bg py-2 text-sm font-bold text-app-fg transition-colors hover:brightness-110"
              onClick={() => void runScannerHub(file, 'nuovo_fornitore', fornitori)}
            >
              {t.bolle.scannerCreateSupplierFromUnrecognized}
            </button>
          )}
          </div>
        </div>

        <div className="app-card overflow-hidden">
          <div className="border-b border-app-line-15 app-workspace-inset-bg-soft p-4">
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
          {registrationTarget === 'fattura' ? (
            <div className="border-t border-app-line-10 app-workspace-inset-bg-soft p-4">
              <label className={fieldLabelCls}>
                {t.appStrings.labelImportoTotale}{' '}
                <span className={fieldHintCls}>(IVA inclusa, opzionale)</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-app-fg-muted">£</span>
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
          ) : (
            <div className="border-t border-app-line-10 app-workspace-inset-bg-soft p-4">
              <label className={fieldLabelCls}>
                {t.bolle.labelQuantitaTotale}{' '}
                <span className={fieldHintCls}>({t.bolle.labelQuantitaHint})</span>
              </label>
              <input
                type="number"
                min="0"
                step="any"
                placeholder="0"
                value={quantita}
                onChange={e => setQuantita(e.target.value)}
                className={fieldInputCls}
              />
            </div>
          )}
        </div>

        <DataFieldWithOcrBadge
          value={data}
          onChange={(v) => { setData(v); setDateFromOcr(false) }}
          label={registrationTarget === 'fattura' ? t.fatture.dataFattura : t.bolle.dataLabel}
          dateFromOcr={dateFromOcr}
          ocrRecognizedLabel={t.bolle.ocrAutoRecognized}
          hintLabel={t.bolle.dateFromDocumentHint}
          uploadDateLabel={t.appStrings.uploadDateLabel}
          uploadDateAutomatic={t.appStrings.uploadDateAutomatic}
          todayFormatted={todayRegistrationLabel}
          wrapperClassName="app-card overflow-hidden"
          innerClassName={`border-t border-app-line-10 p-4 transition-colors ${dateFromOcr ? 'bg-emerald-500/10' : 'app-workspace-inset-bg-soft'}`}
          inputClassName={`${fieldInputCls} [color-scheme:dark]`}
          footerClassName="app-workspace-inset-footer-row"
        />

        {error && (
          <p className="rounded-xl border border-[rgba(34,211,238,0.15)] bg-red-950/50 px-3 py-2 text-sm font-semibold text-red-200">{error}</p>
        )}

        <button
          type="submit"
          disabled={saving || fornitori.length === 0 || ocrStatus === 'scanning' || !file}
          className="app-glow-cyan mt-auto w-full rounded-2xl border border-app-line-35 bg-app-cyan-500 py-3 text-base font-extrabold tracking-tight text-cyan-950 transition-colors hover:bg-app-cyan-400 active:bg-cyan-600 disabled:opacity-50"
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

      <ScannerCameraModal
        open={cameraOpen}
        onClose={closeCameraModal}
        onCapture={capturePhoto}
        videoRef={videoRef}
        cancelLabel={t.common.cancel}
        captureLabel={t.bolle.scannerCameraCapture}
      />
    </div>
  )
}
