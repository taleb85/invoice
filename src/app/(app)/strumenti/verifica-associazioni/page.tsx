'use client'

import type { ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale } from '@/lib/locale-context'
import { useMe } from '@/lib/me-context'
import { useActiveOperator } from '@/lib/active-operator-context'
import { canAccessCentroOperazioniPage } from '@/lib/effective-operator-ui'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import { AppPageHeaderTitleWithDashboardShortcut } from '@/components/AppPageHeaderDashboardShortcut'
import { BackButton } from '@/components/BackButton'
import { OpenDocumentInAppButton } from '@/components/OpenDocumentInAppButton'
import { CategoriaDropdown } from '@/components/CategoriaDropdown'
import { formatDate, formatDateTime } from '@/lib/locale'
import {
  APP_PAGE_HEADER_STRIP_H1_CLASS,
  APP_PAGE_HEADER_STRIP_SUBTITLE_CLASS,
  APP_SHELL_SECTION_PAGE_STACK_CLASS,
} from '@/lib/app-shell-layout'

type Anomalia = {
  id: string
  tipo: string
  gravita: 'alta' | 'media' | 'bassa'
  descrizione: string
  documento_id: string
  riferimento_id?: string
}

type DocumentoAssociato = {
  id: string
  created_at: string | null
  data_documento: string | null
  mittente: string | null
  oggetto_mail: string | null
  file_url: string | null
  file_name: string | null
  content_type: string | null
  stato: string
  is_statement: boolean
  sede_id: string | null
  fornitore_id: string | null
  fattura_id: string | null
  bolla_id: string | null
  metadata: Record<string, unknown> | null
  fornitore: { nome: string; email?: string; piva?: string } | null
  sede: { nome: string } | null
  fattura: { data: string; numero_fattura: string; importo: number } | null
  bolla: { data: string; numero_bolla: string; importo: number } | null
  anomalie: Anomalia[]
  giorni_da_associazione: number
}

type StatisticheVerifica = {
  totale: number
  totale_con_anomalie: number
  totale_ok: number
  distribuzione_sedi: Record<string, number>
  distribuzione_fornitori: Record<string, number>
  distribuzione_tipo: Record<string, number>
  distribuzione_mese: Record<string, number>
  anomalie: {
    per_tipo: Record<string, number>
    per_gravita: Record<string, number>
    totali: number
  }
}

type AnomaliaRiepilogo = {
  tipo: string
  conteggio: number
  gravita: string
}

type VerifyResponse = {
  success: boolean
  data: DocumentoAssociato[]
  total: number
  page: number
  limit: number
  statistiche: StatisticheVerifica
  anomalie_riepilogo: AnomaliaRiepilogo[]
}

type AnomaliaReport = {
  success: boolean
  total: number
  statistiche: StatisticheVerifica
  anomalie_riepilogo: AnomaliaRiepilogo[]
}

type AzionePattern = {
  action: string
  count: number
  percentuale: number
}

type PatternAnomaliaApprendimento = {
  anomalie_tipi: string[]
  anomalie_count: number
  gravita_max: string
  documento_categoria: string | null
  totale_azioni: number
  azioni: AzionePattern[]
  azione_piu_frequente: { action: string; percentuale: number } | null
}

type StatisticheGeneraliApprendimento = {
  totale_azioni: number
  per_azione: Record<string, number>
  totale_con_consiglio: number
  consigli_seguiti: number
  accuratezza_consigli: number
}

type LearningResponse = {
  success: boolean
  statistiche_generali: StatisticheGeneraliApprendimento
  pattern_anomalie_azioni: PatternAnomaliaApprendimento[]
}

const GRAVITA_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  alta: { label: 'Alta', color: 'text-rose-200', bg: 'bg-rose-500/10', border: 'border-rose-500/30' },
  media: { label: 'Media', color: 'text-amber-200', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  bassa: { label: 'Bassa', color: 'text-sky-200', bg: 'bg-sky-500/10', border: 'border-sky-500/30' },
}

const TIPO_ANOMALIA_LABEL: Record<string, string> = {
  file_mancante: 'File mancante',
  fornitore_mancante: 'Fornitore mancante',
  data_mancante: 'Data mancante',
  riferimento_assente: 'Riferimento assente',
  riferimento_inesistente: 'Riferimento inesistente',
  documento_duplicato: 'Documento duplicato',
  sede_mancante: 'Sede mancante',
  metadati_incompleti: 'Metadati incompleti',
  associazione_vecchia: 'Associazione vecchia',
}

function GravitaBadge({ gravita }: { gravita: string }) {
  const cfg = GRAVITA_CONFIG[gravita] ?? GRAVITA_CONFIG.bassa
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${cfg.color} ${cfg.bg}`}>
      {cfg.label}
    </span>
  )
}

function TipoAnomaliaBadge({ tipo }: { tipo: string }) {
  return (
    <span className="inline-block rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px] text-app-fg-muted">
      {TIPO_ANOMALIA_LABEL[tipo] ?? tipo}
    </span>
  )
}

type AzioneConsigliata = {
  action: 'resetta' | 'scarta' | 'elimina_duplicato'
  label: string
  descrizione: string
  color: string
  border: string
  bg: string
  daApprendimento?: boolean
  percentualeOperatori?: number
  totaleAzioni?: number
}

function determinaCategoriaDocumento(doc: DocumentoAssociato): string {
  const pk = doc.metadata?.pending_kind as string | undefined
  if (doc.fattura_id || pk === 'fattura' || pk === 'invoice') return 'FATTURA'
  if (doc.bolla_id || pk === 'bolla') return 'BOLLA'
  if (doc.is_statement || pk === 'statement') return 'ESTRATTO CONTO'
  if (pk === 'ordine') return 'ORDINE'
  if (pk === 'listino') return 'LISTINO'
  if (pk === 'comunicazione') return 'COMUNICAZIONE'
  if (pk === 'nota_credito') return 'NOTA CREDITO'
  return 'Documento'
}

const AZIONE_CONFIG: Record<string, { label: string; color: string; border: string; bg: string }> = {
  elimina_duplicato: { label: 'Elimina duplicato', color: 'text-purple-200', border: 'border-purple-500/30', bg: 'bg-purple-500/10' },
  resetta: { label: 'Resetta', color: 'text-amber-200', border: 'border-amber-500/30', bg: 'bg-amber-500/10' },
  scarta: { label: 'Scarta', color: 'text-rose-200', border: 'border-rose-500/30', bg: 'bg-rose-500/10' },
}

function analizzaAzioneConsigliata(anomalie: Anomalia[], learningData?: LearningResponse | null, categoria?: string): AzioneConsigliata | null {
  if (anomalie.length === 0) return null

  if (learningData?.pattern_anomalie_azioni && learningData.pattern_anomalie_azioni.length > 0) {
    const currentTipi = [...new Set(anomalie.map((a) => a.tipo))].sort()
    const currentCat = categoria ?? ''

    for (const pattern of learningData.pattern_anomalie_azioni) {
      const patternTipi = [...pattern.anomalie_tipi].sort()
      const patternCat = pattern.documento_categoria ?? ''
      if (
        patternTipi.join('|') === currentTipi.join('|') &&
        patternCat === currentCat &&
        pattern.totale_azioni >= 3 &&
        pattern.azione_piu_frequente &&
        pattern.azione_piu_frequente.percentuale >= 60
      ) {
        const action = pattern.azione_piu_frequente.action as 'resetta' | 'scarta' | 'elimina_duplicato'
        const config = AZIONE_CONFIG[action] ?? AZIONE_CONFIG.resetta

        return {
          action,
          label: config.label,
          descrizione: `${pattern.azione_piu_frequente.percentuale}% degli operatori ha scelto "${config.label}" per questa combinazione di anomalie (${pattern.totale_azioni} casi).`,
          color: config.color,
          border: config.border,
          bg: config.bg,
          daApprendimento: true,
          percentualeOperatori: pattern.azione_piu_frequente.percentuale,
          totaleAzioni: pattern.totale_azioni,
        }
      }
    }
  }

  const tipi = new Set(anomalie.map((a) => a.tipo))

  if (tipi.has('documento_duplicato')) {
    return {
      action: 'elimina_duplicato',
      label: 'Elimina duplicato',
      descrizione: 'Documento con stesso fornitore e numero fattura già presente nel sistema.',
      color: 'text-purple-200',
      border: 'border-purple-500/30',
      bg: 'bg-purple-500/10',
    }
  }

  if (tipi.has('riferimento_inesistente') || tipi.has('riferimento_assente')) {
    return {
      action: 'resetta',
      label: 'Resetta',
      descrizione: tipi.has('riferimento_inesistente')
        ? 'Il riferimento fattura/bolla non esiste. Meglio riassegnare per associarlo correttamente.'
        : 'Documento associato ma senza riferimento a fattura o bolla. Meglio riassegnare.',
      color: 'text-amber-200',
      border: 'border-amber-500/30',
      bg: 'bg-amber-500/10',
    }
  }

  if (tipi.has('file_mancante')) {
    return {
      action: 'scarta',
      label: 'Scarta',
      descrizione: 'Il file fisico non esiste. Il documento è probabilmente inutilizzabile.',
      color: 'text-rose-200',
      border: 'border-rose-500/30',
      bg: 'bg-rose-500/10',
    }
  }

  if (tipi.has('fornitore_mancante') || tipi.has('sede_mancante')) {
    return {
      action: 'resetta',
      label: 'Resetta',
      descrizione: 'Mancano metadati essenziali. Meglio riassegnare per una corretta associazione.',
      color: 'text-amber-200',
      border: 'border-amber-500/30',
      bg: 'bg-amber-500/10',
    }
  }

  if (tipi.has('associazione_vecchia')) {
    return {
      action: 'resetta',
      label: 'Resetta',
      descrizione: 'Associazione datata (oltre 180 giorni). Meglio riprocessare.',
      color: 'text-amber-200',
      border: 'border-amber-500/30',
      bg: 'bg-amber-500/10',
    }
  }

  return {
    action: 'resetta',
    label: 'Resetta',
    descrizione: 'Anomalie generiche. Riassegna per una corretta elaborazione.',
    color: 'text-amber-200',
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/10',
  }
}

function AzioneConsigliataBadge({ anomalie, learningData, categoria, onClick }: { anomalie: Anomalia[]; learningData?: LearningResponse | null; categoria?: string; onClick: () => void }) {
  const consiglio = analizzaAzioneConsigliata(anomalie, learningData, categoria)
  if (!consiglio) return null

  return (
    <button
      type="button"
      onClick={onClick}
      title={consiglio.descrizione}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[10px] font-bold transition-colors hover:opacity-80 ${consiglio.border} ${consiglio.bg} ${consiglio.color}`}
    >
      <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>{consiglio.label}</span>
      <span className="ml-0.5 text-[9px] opacity-60">
        {consiglio.daApprendimento ? `${consiglio.percentualeOperatori}% op.` : 'Consigliato'}
      </span>
    </button>
  )
}

function StatCard({ label, value, color, note }: { label: string; value: string | number; color: string; note?: string }) {
  return (
    <div className="app-card overflow-hidden p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${color}`}>{value}</p>
      {note ? <p className="mt-0.5 text-xs text-app-fg-muted">{note}</p> : null}
    </div>
  )
}

function CollapsibleSection({
  title,
  count,
  countColor,
  defaultOpen,
  action,
  children,
}: {
  title: string
  count: number
  countColor: string
  defaultOpen?: boolean
  action?: ReactNode
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  return (
    <div className="app-card overflow-hidden">
      <div className="flex items-center justify-between gap-2 p-4">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center gap-3 text-left transition-colors hover:opacity-80"
        >
          <div className="flex items-center gap-3">
            <span className={`text-sm font-semibold ${countColor}`}>{title}</span>
            <span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-bold ${countColor} bg-white/[0.06]`}>
              {count}
            </span>
          </div>
          <span className={`text-app-fg-muted transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
        </button>
        {action}
      </div>
      {open ? <div className="border-t border-app-line-10 p-4">{children}</div> : null}
    </div>
  )
}

function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-app-soft-border bg-black/30 px-3 py-2 text-xs text-app-fg outline-none transition-colors focus:border-cyan-500/50"
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  )
}

export default function VerificaAssociazioniPage() {
  const { t, locale } = useLocale()
  const { me, loading: meLoading } = useMe()
  const { activeOperator } = useActiveOperator()
  const canView = canAccessCentroOperazioniPage(me, activeOperator)

  const CATEGORIE_DISPONIBILI = [
    'FATTURA', 'BOLLA', 'ESTRATTO CONTO', 'ORDINE', 'LISTINO', 'COMUNICAZIONE', 'NOTA CREDITO',
  ] as const

  const [data, setData] = useState<VerifyResponse | null>(null)
  const [report, setReport] = useState<AnomaliaReport | null>(null)
  const [learningData, setLearningData] = useState<LearningResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'elenco' | 'anomalie'>('dashboard')

  const [filtroSede, setFiltroSede] = useState('')
  const [filtroFornitore, setFiltroFornitore] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroFromDate, setFiltroFromDate] = useState('')
  const [filtroToDate, setFiltroToDate] = useState('')
  const [filtroSearch, setFiltroSearch] = useState('')
  const [filtroAnomalieOnly, setFiltroAnomalieOnly] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState('desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  const [actionLoading, setActionLoading] = useState(false)
  const [actionFeedback, setActionFeedback] = useState<string | null>(null)
  const [autoResolveConfirm, setAutoResolveConfirm] = useState(false)
  const [autoResolving, setAutoResolving] = useState(false)
  const [confirmAction, setConfirmAction] = useState<{
    mode: 'single'
    docId: string
    action: 'scarta' | 'resetta' | 'elimina_duplicato'
    docName: string
  } | {
    mode: 'batch'
    action: 'scarta' | 'resetta' | 'elimina_duplicato'
    count: number
  } | null>(null)
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set())
  const [batchCategoriaOpen, setBatchCategoriaOpen] = useState(false)
  const [batchCategoriaUpdating, setBatchCategoriaUpdating] = useState(false)
  const batchCategoriaRef = useRef<HTMLDivElement>(null)
  const batchCategoriaBtnRef = useRef<HTMLButtonElement>(null)

  const buildUrl = useCallback((isReport: boolean) => {
    const params = new URLSearchParams()
    if (isReport) params.set('report', 'true')
    else {
      params.set('page', String(page))
      params.set('limit', String(pageSize))
      params.set('sort_by', sortBy)
      params.set('sort_order', sortOrder)
    }
    if (filtroSede) params.set('sede_id', filtroSede)
    if (filtroFornitore) params.set('fornitore_id', filtroFornitore)
    if (filtroTipo) params.set('tipo', filtroTipo)
    if (filtroFromDate) params.set('from_date', filtroFromDate)
    if (filtroToDate) params.set('to_date', filtroToDate)
    if (filtroSearch) params.set('search', filtroSearch)
    if (filtroAnomalieOnly && !isReport) params.set('anomalie_only', 'true')
    return `/api/documenti-associati?${params.toString()}`
  }, [page, pageSize, sortBy, sortOrder, filtroSede, filtroFornitore, filtroTipo, filtroFromDate, filtroToDate, filtroSearch, filtroAnomalieOnly])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [resList, resReport, resLearning] = await Promise.all([
        fetch(buildUrl(false), { cache: 'no-store' }),
        fetch(buildUrl(true), { cache: 'no-store' }),
        fetch('/api/documenti-associati/learning', { cache: 'no-store' }),
      ])
      const listData = (await resList.json().catch(() => ({}))) as VerifyResponse & { error?: string }
      const reportData = (await resReport.json().catch(() => ({}))) as AnomaliaReport & { error?: string }
      const learningRes = (await resLearning.json().catch(() => ({}))) as LearningResponse & { error?: string }

      if (!resList.ok) {
        setError(listData.error ?? `HTTP ${resList.status}`)
        return
      }
      setData(listData)
      if (resReport.ok) setReport(reportData)
      if (resLearning.ok) setLearningData(learningRes)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore di rete')
    } finally {
      setLoading(false)
    }
  }, [buildUrl])

  useEffect(() => {
    if (canView) void loadData()
  }, [canView, loadData])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        batchCategoriaOpen &&
        batchCategoriaRef.current &&
        !batchCategoriaRef.current.contains(e.target as Node) &&
        batchCategoriaBtnRef.current &&
        !batchCategoriaBtnRef.current.contains(e.target as Node)
      ) {
        setBatchCategoriaOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [batchCategoriaOpen])

  useEffect(() => {
    const timer = setTimeout(() => {
      setFiltroSearch(searchInput)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  const handleExportJson = useCallback(() => {
    if (!data) return
    const exportObj = {
      esportato_il: new Date().toISOString(),
      totale_documenti: data.total,
      statistiche: data.statistiche,
      anomalie: data.anomalie_riepilogo,
      documenti: data.data,
    }
    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `verifica-associazioni-${new Date().toISOString().substring(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [data])

  const handleExportReportJson = useCallback(() => {
    if (!report) return
    const exportObj = {
      esportato_il: new Date().toISOString(),
      totale_documenti: report.total,
      statistiche: report.statistiche,
      anomalie_riepilogo: report.anomalie_riepilogo,
    }
    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `report-associazioni-${new Date().toISOString().substring(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [report])

  const handleAction = useCallback(async (docId: string, action: string) => {
    setActionLoading(true)
    setActionFeedback(null)
    try {
      const res = await fetch('/api/documenti-associati', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, documento_id: docId }),
      })
      const result = await res.json()
      if (!res.ok) {
        setError(result.error ?? `HTTP ${res.status}`)
        return
      }
      setActionFeedback(result.message ?? 'Operazione completata.')
      await loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore di rete')
    } finally {
      setActionLoading(false)
      setConfirmAction(null)
    }
  }, [loadData])

  const handleBatchAction = useCallback(async (action: string) => {
    if (!confirmAction || confirmAction.mode !== 'batch') return
    const docIds = Array.from(selectedDocs)
    if (docIds.length === 0) return
    setActionLoading(true)
    setActionFeedback(null)
    try {
      const res = await fetch('/api/documenti-associati', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, document_ids: docIds }),
      })
      const result = await res.json()
      if (!res.ok) {
        setError(result.error ?? `HTTP ${res.status}`)
        return
      }
      setActionFeedback(result.message ?? 'Operazione batch completata.')
      setSelectedDocs(new Set())
      await loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore di rete')
    } finally {
      setActionLoading(false)
      setConfirmAction(null)
    }
  }, [confirmAction, selectedDocs, loadData])

  const handleCategoriaChange = useCallback((_nuovaCategoria: string) => {
    void loadData()
  }, [loadData])

  const handleBatchCategoriaChange = useCallback(async (categoria: string) => {
    if (selectedDocs.size === 0) return
    setBatchCategoriaUpdating(true)
    setBatchCategoriaOpen(false)
    try {
      const res = await fetch('/api/documenti-associati/categoria/batch', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documenti_ids: [...selectedDocs], categoria }),
      })
      const result = await res.json()
      if (res.ok && result.success) {
        clearSelection()
        void loadData()
      }
    } catch {
      // silenzioso
    } finally {
      setBatchCategoriaUpdating(false)
    }
  }, [selectedDocs, loadData])

  const handleAutoResolve = useCallback(async () => {
    setAutoResolving(true)
    setAutoResolveConfirm(false)
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 300000)
      const res = await fetch('/api/documenti-associati/auto-resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      })
      clearTimeout(timeout)
      const data = await res.json()
      if (data.success) {
        setActionFeedback(data.message)
      } else {
        setActionFeedback(data.error || 'Errore auto-resolve')
      }
      await loadData()
    } catch (e) {
      setActionFeedback(`Errore: ${e instanceof Error ? e.message : 'Richiesta fallita'}`)
    } finally {
      setAutoResolving(false)
    }
  }, [loadData])

  const toggleSelectDoc = useCallback((docId: string) => {
    setSelectedDocs((prev) => {
      const next = new Set(prev)
      if (next.has(docId)) next.delete(docId)
      else next.add(docId)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    if (!data?.data) return
    setSelectedDocs((prev) => {
      const allIds = new Set(data.data.map((d) => d.id))
      const allSelected = data.data.every((d) => prev.has(d.id))
      if (allSelected) return new Set()
      return allIds
    })
  }, [data])

  const clearSelection = useCallback(() => {
    setSelectedDocs(new Set())
  }, [])

  const resetFilters = useCallback(() => {
    setFiltroSede('')
    setFiltroFornitore('')
    setFiltroTipo('')
    setFiltroFromDate('')
    setFiltroToDate('')
    setFiltroSearch('')
    setSearchInput('')
    setFiltroAnomalieOnly(false)
    setSortBy('created_at')
    setSortOrder('desc')
    setPage(1)
  }, [])

  if (meLoading) {
    return (
      <div className={`${APP_SHELL_SECTION_PAGE_STACK_CLASS} flex min-h-[40vh] items-center justify-center pb-10`}>
        <p className="text-sm text-app-fg-muted">{t.common.loading}</p>
      </div>
    )
  }

  if (!canView) {
    return (
      <div className={`${APP_SHELL_SECTION_PAGE_STACK_CLASS} pb-10 overflow-x-hidden`}>
        <div className="app-shell-page-padding mx-auto min-w-0 w-full max-w-[var(--app-layout-max-width)]">
          <AppPageHeaderStrip
            accent="teal"
            leadingAccessory={<BackButton href="/" label={t.nav.dashboard} iconOnly className="mb-0 shrink-0" />}
          >
            <AppPageHeaderTitleWithDashboardShortcut>
              <h1 className={APP_PAGE_HEADER_STRIP_H1_CLASS}>Verifica associazioni</h1>
              <p className={`${APP_PAGE_HEADER_STRIP_SUBTITLE_CLASS} !max-w-none`}>Accesso riservato ad admin e operatori.</p>
            </AppPageHeaderTitleWithDashboardShortcut>
          </AppPageHeaderStrip>
          <div className="mt-6 app-card overflow-hidden p-6">
            <p className="m-0 text-sm leading-relaxed text-app-fg-muted">
              Non hai i permessi per visualizzare questa pagina.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const s = data?.statistiche
  const rs = report?.statistiche
  const showStats = rs ?? s

  return (
    <div className={`${APP_SHELL_SECTION_PAGE_STACK_CLASS} pb-10`}>
      <div className="app-shell-page-padding mx-auto min-w-0 w-full max-w-[var(--app-layout-max-width)]">
        <AppPageHeaderStrip
          accent="teal"
          leadingAccessory={<BackButton href="/" label={t.nav.dashboard} iconOnly className="mb-0 shrink-0" />}
        >
          <AppPageHeaderTitleWithDashboardShortcut>
            <h1 className={APP_PAGE_HEADER_STRIP_H1_CLASS}>Verifica associazioni</h1>
            <p className={`${APP_PAGE_HEADER_STRIP_SUBTITLE_CLASS} !max-w-none`}>
              Catalogo e controllo qualità dei documenti associati ({data?.total ?? '...'} documenti).
            </p>
          </AppPageHeaderTitleWithDashboardShortcut>
        </AppPageHeaderStrip>

        {/* Tab Navigation */}
        <div className="mt-3 flex gap-1 rounded-lg border border-app-soft-border bg-black/20 p-1">
          {([
            { key: 'dashboard', label: 'Dashboard' },
            { key: 'elenco', label: 'Elenco documenti' },
            { key: 'anomalie', label: 'Anomalie e validazione' },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 rounded-md px-3 py-2 text-center text-xs font-semibold transition-colors ${
                activeTab === tab.key
                  ? 'bg-white/10 text-app-fg shadow-sm'
                  : 'text-app-fg-muted hover:bg-white/5 hover:text-app-fg'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-app-fg-muted">{t.common.loading}</p>
          </div>
        ) : error ? (
          <div className="mt-6 app-card overflow-hidden p-6">
            <p className="text-sm text-rose-300">{error}</p>
            <button
              type="button"
              onClick={loadData}
              className="mt-4 inline-flex items-center justify-center rounded-lg border border-cyan-500/45 bg-cyan-500/12 px-4 py-2 text-xs font-bold text-cyan-100 transition-colors hover:bg-cyan-500/18"
            >
              Riprova
            </button>
          </div>
        ) : showStats ? (
          <>
            {/* === TAB: DASHBOARD === */}
            {activeTab === 'dashboard' && (
              <div className="mt-6 space-y-6">
                {/* KPI Cards */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  <StatCard label="Totale documenti" value={showStats.totale} color="text-white" />
                  <StatCard
                    label="OK"
                    value={showStats.totale_ok}
                    color={showStats.totale_ok === showStats.totale ? 'text-emerald-300' : 'text-emerald-300'}
                    note={`${showStats.totale > 0 ? ((showStats.totale_ok / showStats.totale) * 100).toFixed(1) : '0'}% del totale`}
                  />
                  <StatCard
                    label="Con anomalie"
                    value={showStats.totale_con_anomalie}
                    color={showStats.totale_con_anomalie > 0 ? 'text-rose-300' : 'text-emerald-300'}
                    note={`${showStats.totale > 0 ? ((showStats.totale_con_anomalie / showStats.totale) * 100).toFixed(1) : '0'}% del totale`}
                  />
                  <StatCard
                    label="Anomalie totali"
                    value={showStats.anomalie.totali}
                    color={showStats.anomalie.totali > 0 ? 'text-amber-300' : 'text-emerald-300'}
                  />
                  <StatCard
                    label="Anomalie alta gravità"
                    value={showStats.anomalie.per_gravita.alta ?? 0}
                    color={showStats.anomalie.per_gravita.alta ? 'text-rose-300' : 'text-emerald-300'}
                  />
                  <StatCard
                    label="Duplicati"
                    value={showStats.anomalie.per_tipo.documento_duplicato ?? 0}
                    color={showStats.anomalie.per_tipo.documento_duplicato ? 'text-rose-300' : 'text-emerald-300'}
                  />
                </div>

                {/* Auto-resolve banner */}
                {showStats.totale_con_anomalie > 0 && (
                  <div className="flex items-center justify-between rounded-lg border border-rose-500/30 bg-rose-900/30 px-5 py-4">
                    <div>
                      <p className="text-sm font-bold text-rose-200">
                        {showStats.totale_con_anomalie} documenti con anomalie
                      </p>
                      <p className="mt-0.5 text-xs text-rose-300/80">
                        {showStats.anomalie.totali} anomalie totali di cui {showStats.anomalie.per_gravita.alta ?? 0} ad alta gravità
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAutoResolveConfirm(true)}
                      disabled={autoResolving}
                      className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-purple-500 disabled:opacity-50"
                    >
                      {autoResolving ? (
                        <>Analizzo...</>
                      ) : (
                        <>
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          Auto-risolvi tutto
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Distribuzione per tipo anomalia */}
                {report?.anomalie_riepilogo && report.anomalie_riepilogo.length > 0 && (
                  <CollapsibleSection
                    title="Distribuzione anomalie per tipo"
                    count={report.anomalie_riepilogo.length}
                    countColor="text-amber-300"
                    defaultOpen
                    action={
                      <button
                        type="button"
                        onClick={handleExportReportJson}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-bold text-cyan-200 transition-colors hover:bg-cyan-500/18"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Esporta report
                      </button>
                    }
                  >
                    <div>
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-app-fg-muted">
                            <th className="pb-2 pr-3 font-semibold">Tipo anomalia</th>
                            <th className="pb-2 pr-3 font-semibold">Gravità</th>
                            <th className="pb-2 pr-3 font-semibold">Conteggio</th>
                            <th className="pb-2 pr-3 font-semibold">Incidenza</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-app-line-10">
                          {report.anomalie_riepilogo.map((a) => (
                            <tr key={a.tipo} className="text-app-fg hover:bg-white/[0.02]">
                              <td className="py-2 pr-3"><TipoAnomaliaBadge tipo={a.tipo} /></td>
                              <td className="py-2 pr-3"><GravitaBadge gravita={a.gravita} /></td>
                              <td className="py-2 pr-3 font-semibold tabular-nums">{a.conteggio}</td>
                              <td className="py-2 pr-3 text-app-fg-muted">
                                {report.total > 0 ? ((a.conteggio / report.total) * 100).toFixed(1) : '0'}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CollapsibleSection>
                )}

                {/* Distribuzione per gravità */}
                <CollapsibleSection
                  title="Anomalie per gravità"
                  count={showStats.anomalie.totali}
                  countColor="text-amber-300"
                  defaultOpen
                >
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {(['alta', 'media', 'bassa'] as const).map((g) => {
                      const cfg = GRAVITA_CONFIG[g]
                      const count = showStats.anomalie.per_gravita[g] ?? 0
                      const pct = showStats.anomalie.totali > 0 ? ((count / showStats.anomalie.totali) * 100).toFixed(1) : '0'
                      return (
                        <div key={g} className={`rounded-lg border ${cfg.border} ${cfg.bg} p-4`}>
                          <p className={`text-[10px] font-bold uppercase tracking-widest ${cfg.color}`}>
                            {cfg.label}
                          </p>
                          <p className={`mt-2 text-2xl font-bold ${cfg.color}`}>{count}</p>
                          <p className="mt-0.5 text-xs text-app-fg-muted">{pct}% del totale anomalie</p>
                        </div>
                      )
                    })}
                  </div>
                </CollapsibleSection>

                {/* Distribuzione per tipo documento */}
                {showStats.distribuzione_tipo && Object.keys(showStats.distribuzione_tipo).length > 0 && (
                  <CollapsibleSection
                    title="Distribuzione per tipo documento"
                    count={Object.keys(showStats.distribuzione_tipo).length}
                    countColor="text-sky-300"
                  >
                    <div>
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-app-fg-muted">
                            <th className="pb-2 pr-3 font-semibold">Tipo</th>
                            <th className="pb-2 pr-3 font-semibold">Conteggio</th>
                            <th className="pb-2 pr-3 font-semibold">Incidenza</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-app-line-10">
                          {Object.entries(showStats.distribuzione_tipo)
                            .sort(([, a], [, b]) => b - a)
                            .map(([tipo, count]) => (
                              <tr key={tipo} className="text-app-fg hover:bg-white/[0.02]">
                                <td className="py-2 pr-3 font-medium capitalize">{tipo}</td>
                                <td className="py-2 pr-3 font-semibold tabular-nums">{count}</td>
                                <td className="py-2 pr-3 text-app-fg-muted">
                                  {showStats.totale > 0 ? ((count / showStats.totale) * 100).toFixed(1) : '0'}%
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </CollapsibleSection>
                )}

                {/* Distribuzione per sede */}
                {showStats.distribuzione_sedi && Object.keys(showStats.distribuzione_sedi).length > 0 && (
                  <CollapsibleSection
                    title="Distribuzione per sede"
                    count={Object.keys(showStats.distribuzione_sedi).length}
                    countColor="text-indigo-300"
                  >
                    <div>
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-app-fg-muted">
                            <th className="pb-2 pr-3 font-semibold">Sede</th>
                            <th className="pb-2 pr-3 font-semibold">Documenti</th>
                            <th className="pb-2 pr-3 font-semibold">Incidenza</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-app-line-10">
                          {Object.entries(showStats.distribuzione_sedi)
                            .sort(([, a], [, b]) => b - a)
                            .map(([sede, count]) => (
                              <tr key={sede} className="text-app-fg hover:bg-white/[0.02]">
                                <td className="py-2 pr-3 font-medium">{sede}</td>
                                <td className="py-2 pr-3 font-semibold tabular-nums">{count}</td>
                                <td className="py-2 pr-3 text-app-fg-muted">
                                  {showStats.totale > 0 ? ((count / showStats.totale) * 100).toFixed(1) : '0'}%
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </CollapsibleSection>
                )}

                {/* Distribuzione per mese */}
                {showStats.distribuzione_mese && Object.keys(showStats.distribuzione_mese).length > 0 && (
                  <CollapsibleSection
                    title="Distribuzione temporale (per mese)"
                    count={Object.keys(showStats.distribuzione_mese).length}
                    countColor="text-teal-300"
                  >
                    <div>
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-app-fg-muted">
                            <th className="pb-2 pr-3 font-semibold">Mese</th>
                            <th className="pb-2 pr-3 font-semibold">Documenti</th>
                            <th className="pb-2 pr-3 font-semibold">Incidenza</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-app-line-10">
                          {Object.entries(showStats.distribuzione_mese)
                            .sort(([a], [b]) => a.localeCompare(b))
                            .map(([mese, count]) => (
                              <tr key={mese} className="text-app-fg hover:bg-white/[0.02]">
                                <td className="py-2 pr-3 font-medium">{mese}</td>
                                <td className="py-2 pr-3 font-semibold tabular-nums">{count}</td>
                                <td className="py-2 pr-3 text-app-fg-muted">
                                  {showStats.totale > 0 ? ((count / showStats.totale) * 100).toFixed(1) : '0'}%
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </CollapsibleSection>
                )}

                {/* Sezione Apprendimento AI */}
                {learningData && learningData.statistiche_generali.totale_azioni > 0 && (
                  <CollapsibleSection
                    title="Apprendimento dalle azioni"
                    count={learningData.statistiche_generali.totale_azioni}
                    countColor="text-emerald-300"
                    defaultOpen
                  >
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">Azioni totali</p>
                          <p className="mt-1 text-2xl font-bold text-emerald-200">{learningData.statistiche_generali.totale_azioni}</p>
                        </div>
                        <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">Accuratezza consigli</p>
                          <div className="mt-1 flex items-baseline gap-2">
                            <p className="text-2xl font-bold text-cyan-200">{learningData.statistiche_generali.accuratezza_consigli}%</p>
                            <span className="text-[10px] text-app-fg-muted">
                              ({learningData.statistiche_generali.consigli_seguiti}/{learningData.statistiche_generali.totale_con_consiglio})
                            </span>
                          </div>
                        </div>
                        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">Resetta</p>
                          <p className="mt-1 text-2xl font-bold text-amber-200">{learningData.statistiche_generali.per_azione.resetta ?? 0}</p>
                        </div>
                        <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-4">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">Scarta</p>
                          <p className="mt-1 text-2xl font-bold text-rose-200">{learningData.statistiche_generali.per_azione.scarta ?? 0}</p>
                        </div>
                      </div>

                      {learningData.pattern_anomalie_azioni.length > 0 && (
                        <div>
                          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-app-fg-muted">
                            Pattern anomalie → azioni più frequenti
                          </p>
                          <div>
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="text-app-fg-muted">
                                  <th className="pb-2 pr-3 font-semibold">Anomalie</th>
                                  <th className="pb-2 pr-3 font-semibold">Categoria</th>
                                  <th className="pb-2 pr-3 font-semibold">Gravità max</th>
                                  <th className="pb-2 pr-3 font-semibold">Azioni</th>
                                  <th className="pb-2 pr-3 font-semibold">Azione più frequente</th>
                                  <th className="pb-2 pr-3 font-semibold">Distribuzione</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-app-line-10">
                                {learningData.pattern_anomalie_azioni.slice(0, 10).map((pattern, idx) => (
                                  <tr key={idx} className="text-app-fg hover:bg-white/[0.02]">
                                    <td className="py-2 pr-3">
                                      <div className="flex flex-wrap gap-1">
                                        {pattern.anomalie_tipi.length > 0
                                          ? pattern.anomalie_tipi.map((t) => <TipoAnomaliaBadge key={t} tipo={t} />)
                                          : <span className="text-app-fg-muted">Nessuna anomalia</span>
                                        }
                                      </div>
                                    </td>
                                    <td className="py-2 pr-3">
                                      <span className="inline-block rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] font-bold text-app-fg-muted">
                                        {pattern.documento_categoria ?? '—'}
                                      </span>
                                    </td>
                                    <td className="py-2 pr-3">
                                      <GravitaBadge gravita={pattern.gravita_max} />
                                    </td>
                                    <td className="py-2 pr-3 font-semibold tabular-nums">{pattern.totale_azioni}</td>
                                    <td className="py-2 pr-3">
                                      {pattern.azione_piu_frequente && (
                                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                          pattern.azione_piu_frequente.action === 'scarta'
                                            ? 'text-rose-200 bg-rose-500/10'
                                            : pattern.azione_piu_frequente.action === 'elimina_duplicato'
                                              ? 'text-purple-200 bg-purple-500/10'
                                              : 'text-amber-200 bg-amber-500/10'
                                        }`}>
                                          {pattern.azione_piu_frequente.action === 'scarta' ? 'Scarta' :
                                           pattern.azione_piu_frequente.action === 'elimina_duplicato' ? 'Elimina duplicato' : 'Resetta'}
                                          {' '}({pattern.azione_piu_frequente.percentuale}%)
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-2 pr-3">
                                      <div className="flex items-center gap-2">
                                        {pattern.azioni.slice(0, 3).map((a) => (
                                          <span key={a.action} className="text-[10px] text-app-fg-muted">
                                            {a.action === 'scarta' ? 'S' : a.action === 'elimina_duplicato' ? 'D' : 'R'}:{a.count}
                                          </span>
                                        ))}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      <p className="text-[10px] text-app-fg-muted italic">
                        I consigli vengono adattati in base alle azioni reali degli operatori.
                        I pattern mostrano le scelte più comuni per ogni combinazione di anomalie.
                        Più azioni vengono registrate, più i consigli diventano accurati.
                      </p>
                    </div>
                  </CollapsibleSection>
                )}
              </div>
            )}

            {/* === TAB: ELENCO DOCUMENTI === */}
            {activeTab === 'elenco' && (
              <div className="mt-6 space-y-4">
                {/* Filtri */}
                <div className="app-card p-4 overflow-visible">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">Ricerca testo</label>
                      <input
                        type="text"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder="Mittente, nome file, oggetto..."
                        className="w-full rounded-lg border border-app-soft-border bg-black/30 px-3 py-2 text-xs text-app-fg outline-none transition-colors placeholder:text-app-fg-muted/50 focus:border-cyan-500/50"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">Da data</label>
                      <input
                        type="date"
                        value={filtroFromDate}
                        onChange={(e) => { setFiltroFromDate(e.target.value); setPage(1) }}
                        className="w-full rounded-lg border border-app-soft-border bg-black/30 px-3 py-2 text-xs text-app-fg outline-none transition-colors focus:border-cyan-500/50"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">A data</label>
                      <input
                        type="date"
                        value={filtroToDate}
                        onChange={(e) => { setFiltroToDate(e.target.value); setPage(1) }}
                        className="w-full rounded-lg border border-app-soft-border bg-black/30 px-3 py-2 text-xs text-app-fg outline-none transition-colors focus:border-cyan-500/50"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">Solo anomalie</label>
                      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-app-soft-border bg-black/30 px-3 py-2 text-xs text-app-fg">
                        <input
                          type="checkbox"
                          checked={filtroAnomalieOnly}
                          onChange={(e) => { setFiltroAnomalieOnly(e.target.checked); setPage(1) }}
                          className="rounded border-app-soft-border bg-black/30 text-cyan-500 focus:ring-cyan-500/30"
                        />
                        <span>Mostra solo documenti con anomalie</span>
                      </label>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="relative" ref={batchCategoriaRef}>
                        <button
                          ref={batchCategoriaBtnRef}
                          type="button"
                          onClick={() => setBatchCategoriaOpen(!batchCategoriaOpen)}
                          disabled={batchCategoriaUpdating}
                          className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3.5 py-2 text-[11px] font-bold text-app-fg-muted transition-colors hover:bg-white/[0.08] disabled:opacity-40"
                        >
                          {batchCategoriaUpdating ? '…' : 'Categoria'}
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {batchCategoriaOpen && (
                          <div className="absolute bottom-full left-0 mb-1.5 rounded-lg border border-app-line-28 app-workspace-surface-elevated shadow-[0_16px_40px_-8px_rgba(0,0,0,0.55)] ring-1 ring-inset ring-app-line-15 py-1 min-w-[160px]">
                            {CATEGORIE_DISPONIBILI.map((cat) => (
                              <button
                                key={cat}
                                type="button"
                                onClick={() => void handleBatchCategoriaChange(cat)}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-medium text-app-fg-muted transition-colors hover:bg-app-line-10 hover:text-app-fg"
                              >
                                {cat}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => { setFiltroSearch(searchInput); loadData() }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-bold text-cyan-200 transition-colors hover:bg-cyan-500/18"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        Applica filtri
                      </button>
                      <button
                        type="button"
                        onClick={resetFilters}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-app-soft-border bg-white/[0.03] px-3 py-1.5 text-[11px] font-bold text-app-fg-muted transition-colors hover:bg-white/[0.06]"
                      >
                        Azzera filtri
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={handleExportJson}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-bold text-cyan-200 transition-colors hover:bg-cyan-500/18"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Esporta JSON
                    </button>
                  </div>
                </div>

                {/* Bulk action bar */}
                {selectedDocs.size > 0 && (
                  <div className="flex items-center justify-between gap-4 rounded-lg border border-cyan-500/30 bg-cyan-900/40 px-4 py-3 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-cyan-100">
                        {selectedDocs.size} documento{selectedDocs.size !== 1 ? 'i' : ''} selezionat{selectedDocs.size !== 1 ? 'i' : 'o'}
                      </span>
                      <button
                        type="button"
                        onClick={clearSelection}
                        className="text-[11px] text-app-fg-muted underline decoration-app-fg-muted/30 underline-offset-2 hover:text-app-fg"
                      >
                        Annulla selezione
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmAction({ mode: 'batch', action: 'scarta', count: selectedDocs.size })}
                        disabled={actionLoading}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/35 bg-rose-500/10 px-3.5 py-2 text-[11px] font-bold text-rose-200 transition-colors hover:bg-rose-500/18 disabled:opacity-40"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Scarta selezionati
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmAction({ mode: 'batch', action: 'resetta', count: selectedDocs.size })}
                        disabled={actionLoading}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3.5 py-2 text-[11px] font-bold text-amber-200 transition-colors hover:bg-amber-500/18 disabled:opacity-40"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Resetta selezionati
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmAction({ mode: 'batch', action: 'elimina_duplicato', count: selectedDocs.size })}
                        disabled={actionLoading}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/35 bg-purple-500/10 px-3.5 py-2 text-[11px] font-bold text-purple-200 transition-colors hover:bg-purple-500/18 disabled:opacity-40"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M23 1l-6 6m0 0l6 6m-6-6H1" />
                        </svg>
                        Elimina duplicati
                      </button>
                    </div>
                  </div>
                )}

                {/* Tabella documenti */}
                <div className="app-card overflow-x-auto">
                  <div>
                    {data && data.data.length === 0 ? (
                      <div className="p-8 text-center">
                        <p className="text-sm text-app-fg-muted">Nessun documento trovato con i filtri selezionati.</p>
                      </div>
                    ) : (
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-app-line-10 text-app-fg-muted">
                            <th className="sticky top-0 bg-app-bg px-2 py-2.5 pr-1 w-10">
                              <input
                                type="checkbox"
                                checked={data?.data ? data.data.length > 0 && data.data.every((d) => selectedDocs.has(d.id)) : false}
                                onChange={toggleSelectAll}
                                className="rounded border-app-soft-border bg-black/30 text-cyan-500 focus:ring-cyan-500/30"
                              />
                            </th>
                            <th className="sticky top-0 bg-app-bg px-3 py-2.5 pr-3 font-semibold">Fornitore</th>
                            <th className="sticky top-0 bg-app-bg px-3 py-2.5 pr-3 font-semibold">File</th>
                            <th className="sticky top-0 bg-app-bg px-3 py-2.5 pr-3 font-semibold">Data doc.</th>
                            <th className="sticky top-0 bg-app-bg px-3 py-2.5 pr-3 font-semibold">Tipo</th>
                            <th className="sticky top-0 bg-app-bg px-3 py-2.5 pr-3 font-semibold">Riferimento</th>
                            <th className="sticky top-0 bg-app-bg px-3 py-2.5 pr-3 font-semibold">Anomalie</th>
                            <th className="sticky top-0 bg-app-bg px-3 py-2.5 pr-3 font-semibold">Giorni</th>
                            <th className="sticky top-0 bg-app-bg px-3 py-2.5 pr-3 font-semibold">Creato il</th>
                            <th className="sticky top-0 bg-app-bg px-3 py-2.5 pr-3 font-semibold">Azioni</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-app-line-10">
                          {data?.data.map((doc) => {
                            const anomalieAlta = doc.anomalie.filter((a) => a.gravita === 'alta').length
                            const anomalieMedia = doc.anomalie.filter((a) => a.gravita === 'media').length
                            const pendingKind = doc.metadata
                              ? (doc.metadata.pending_kind as string) ?? null
                              : null
                            return (
                              <tr key={doc.id} className={`text-app-fg hover:bg-white/[0.02] ${selectedDocs.has(doc.id) ? 'bg-cyan-500/5' : ''}`}>
                                <td className="px-2 py-2.5 pr-1">
                                  <input
                                    type="checkbox"
                                    checked={selectedDocs.has(doc.id)}
                                    onChange={() => toggleSelectDoc(doc.id)}
                                    className="rounded border-app-soft-border bg-black/30 text-cyan-500 focus:ring-cyan-500/30"
                                  />
                                </td>
                                <td className="px-3 py-2.5 pr-3 max-w-[160px]">
                                  <p className="truncate font-medium" title={doc.fornitore?.nome ?? ''}>
                                    {doc.fornitore?.nome ?? '—'}
                                  </p>
                                  {doc.mittente ? (
                                    <p className="truncate text-[10px] text-app-fg-muted" title={doc.mittente}>{doc.mittente}</p>
                                  ) : null}
                                </td>
                                <td className="px-3 py-2.5 pr-3 max-w-[180px]">
                                  {doc.file_name ? (
                                    doc.file_url ? (
                                      <OpenDocumentInAppButton
                                        documentoId={doc.id}
                                        fileUrl={doc.file_url}
                                        title={doc.file_name}
                                        anomalie={doc.anomalie}
                                        categoria={determinaCategoriaDocumento(doc)}
                                        onCategoriaChange={handleCategoriaChange}
                                        viewerActions={[
                                          { action: 'scarta', label: 'Scarta', onClick: () => setConfirmAction({ mode: 'single', docId: doc.id, action: 'scarta', docName: doc.file_name ?? doc.id.substring(0, 8) }) },
                                          { action: 'resetta', label: 'Resetta', onClick: () => setConfirmAction({ mode: 'single', docId: doc.id, action: 'resetta', docName: doc.file_name ?? doc.id.substring(0, 8) }) },
                                          ...(doc.anomalie.some((a) => a.tipo === 'documento_duplicato')
                                            ? [{ action: 'elimina_duplicato' as const, label: 'Elimina duplicato' as const, onClick: () => setConfirmAction({ mode: 'single', docId: doc.id, action: 'elimina_duplicato', docName: doc.file_name ?? doc.id.substring(0, 8) }) }]
                                            : []),
                                        ]}
                                        className="truncate text-cyan-300 underline decoration-cyan-500/35 underline-offset-2 hover:text-cyan-200"
                                      >
                                        {doc.file_name}
                                      </OpenDocumentInAppButton>
                                    ) : (
                                      <span className="truncate text-rose-300" title={doc.file_name}>{doc.file_name}</span>
                                    )
                                  ) : (
                                    <span className="text-app-fg-muted">—</span>
                                  )}
                                </td>
                                <td className="px-3 py-2.5 pr-3 tabular-nums">
                                  {doc.data_documento ? formatDate(doc.data_documento, locale) : '—'}
                                </td>
                                <td className="px-3 py-2.5 pr-3">
                                  {pendingKind ? (
                                    <span className="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px] capitalize">
                                      {pendingKind}
                                    </span>
                                  ) : (
                                    <span className="text-app-fg-muted">—</span>
                                  )}
                                </td>
                                <td className="px-3 py-2.5 pr-3 max-w-[140px]">
                                  {doc.fattura ? (
                                    <span className="text-emerald-200" title={`Fattura ${doc.fattura.numero_fattura}`}>
                                      Fatt. {doc.fattura.numero_fattura}
                                    </span>
                                  ) : doc.bolla ? (
                                    <span className="text-sky-200" title={`Bolla ${doc.bolla.numero_bolla}`}>
                                      Bolla {doc.bolla.numero_bolla}
                                    </span>
                                  ) : (
                                    <span className="text-app-fg-muted">—</span>
                                  )}
                                </td>
                                <td className="px-3 py-2.5 pr-3">
                                  <div className="flex items-center gap-1">
                                    {anomalieAlta > 0 && (
                                      <span className="inline-flex items-center justify-center rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-bold text-rose-300">
                                        {anomalieAlta}🔴
                                      </span>
                                    )}
                                    {anomalieMedia > 0 && (
                                      <span className="inline-flex items-center justify-center rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                                        {anomalieMedia}🟡
                                      </span>
                                    )}
                                    {doc.anomalie.length === 0 && (
                                      <span className="text-emerald-300">✓</span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 pr-3 tabular-nums">
                                  <span className={doc.giorni_da_associazione > 180 ? 'text-amber-200' : 'text-app-fg-muted'}>
                                    {doc.giorni_da_associazione}g
                                  </span>
                                </td>
                                <td className="px-3 py-2.5 pr-3 text-app-fg-muted">
                                  {doc.created_at ? formatDate(doc.created_at, locale) : '—'}
                                </td>
                                <td className="px-3 py-2.5 pr-3">
                                  <div className="flex items-center gap-1">
                                    <CategoriaDropdown
                                      categoria={determinaCategoriaDocumento(doc)}
                                      documentoId={doc.id}
                                      onCategoriaChange={handleCategoriaChange}
                                    />
                                    <AzioneConsigliataBadge
                                      anomalie={doc.anomalie}
                                      learningData={learningData}
                                      categoria={determinaCategoriaDocumento(doc)}
                                      onClick={() => {
                                        const consiglio = analizzaAzioneConsigliata(doc.anomalie, learningData, determinaCategoriaDocumento(doc))
                                        if (!consiglio) return
                                        setConfirmAction({ mode: 'single', docId: doc.id, action: consiglio.action, docName: doc.file_name ?? doc.id.substring(0, 8) })
                                      }}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setConfirmAction({ mode: 'single', docId: doc.id, action: 'scarta', docName: doc.file_name ?? doc.id.substring(0, 8) })}
                                      disabled={actionLoading}
                                      title="Scarta: Rimuove l'associazione e marca come scartato. Usa solo se il documento è irrecuperabile (es. file mancante, duplicato errato)."
                                      className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/8 px-2 py-1 text-[10px] font-bold text-rose-200 transition-colors hover:bg-rose-500/15 disabled:opacity-40"
                                    >
                                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                      Scarta
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmAction({ mode: 'single', docId: doc.id, action: 'resetta', docName: doc.file_name ?? doc.id.substring(0, 8) })}
                                      disabled={actionLoading}
                                      title="Resetta: Riporta a 'da associare' per rielaborare. Usa se l'associazione è sbagliata o mancano dati, ma il documento è valido."
                                      className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/8 px-2 py-1 text-[10px] font-bold text-amber-200 transition-colors hover:bg-amber-500/15 disabled:opacity-40"
                                    >
                                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                      </svg>
                                      Resetta
                                    </button>
                                    {doc.anomalie.some((a) => a.tipo === 'documento_duplicato') && (
                                      <button
                                        type="button"
                                        onClick={() => setConfirmAction({ mode: 'single', docId: doc.id, action: 'elimina_duplicato', docName: doc.file_name ?? doc.id.substring(0, 8) })}
                                        disabled={actionLoading}
                                        title="Duplicato: Marca come scartato (duplicato). Usa solo se il documento è identico a un altro già presente."
                                        className="inline-flex items-center gap-1 rounded-md border border-purple-500/30 bg-purple-500/8 px-2 py-1 text-[10px] font-bold text-purple-200 transition-colors hover:bg-purple-500/15 disabled:opacity-40"
                                      >
                                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M23 1l-6 6m0 0l6 6m-6-6H1" />
                                        </svg>
                                        Duplicato
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* Paginazione */}
                  {data && data.total > data.limit && (
                    <div className="flex items-center justify-between border-t border-app-line-10 px-4 py-3">
                      <p className="text-[11px] text-app-fg-muted">
                        Mostrati {(data.page - 1) * data.limit + 1}-{Math.min(data.page * data.limit, data.total)} di {data.total}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={page <= 1}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          className="inline-flex items-center gap-1 rounded-md border border-app-soft-border bg-white/[0.03] px-2.5 py-1 text-[11px] font-bold text-app-fg transition-colors hover:bg-white/[0.06] disabled:opacity-30"
                        >
                          ← Prec.
                        </button>
                        <span className="text-[11px] text-app-fg-muted">Pag. {data.page}</span>
                        <button
                          type="button"
                          disabled={data.page * data.limit >= data.total}
                          onClick={() => setPage((p) => p + 1)}
                          className="inline-flex items-center gap-1 rounded-md border border-app-soft-border bg-white/[0.03] px-2.5 py-1 text-[11px] font-bold text-app-fg transition-colors hover:bg-white/[0.06] disabled:opacity-30"
                        >
                          Succ. →
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Select page size */}
                  {data && data.total > 10 && (
                    <div className="flex items-center justify-end border-t border-app-line-10 px-4 py-2">
                      <label className="flex items-center gap-2 text-[11px] text-app-fg-muted">
                        Righe per pagina:
                        <select
                          value={pageSize}
                          onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
                          className="rounded border border-app-soft-border bg-black/30 px-2 py-1 text-[11px] text-app-fg outline-none"
                        >
                          <option value={10}>10</option>
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                          <option value={200}>200</option>
                        </select>
                      </label>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* === TAB: ANOMALIE === */}
            {activeTab === 'anomalie' && (
              <div className="mt-6 space-y-4">
                {/* Filtri per anomalie */}
                <div className="app-card p-4 overflow-visible">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">Ricerca</label>
                      <input
                        type="text"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder="Cerca per fornitore o file..."
                        className="w-full rounded-lg border border-app-soft-border bg-black/30 px-3 py-2 text-xs text-app-fg outline-none transition-colors placeholder:text-app-fg-muted/50 focus:border-cyan-500/50"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">Da data</label>
                      <input
                        type="date"
                        value={filtroFromDate}
                        onChange={(e) => { setFiltroFromDate(e.target.value); setPage(1) }}
                        className="w-full rounded-lg border border-app-soft-border bg-black/30 px-3 py-2 text-xs text-app-fg outline-none transition-colors focus:border-cyan-500/50"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">A data</label>
                      <input
                        type="date"
                        value={filtroToDate}
                        onChange={(e) => { setFiltroToDate(e.target.value); setPage(1) }}
                        className="w-full rounded-lg border border-app-soft-border bg-black/30 px-3 py-2 text-xs text-app-fg outline-none transition-colors focus:border-cyan-500/50"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => { setFiltroSearch(searchInput); loadData() }}
                        className="w-full rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-3 py-2 text-xs font-bold text-cyan-200 transition-colors hover:bg-cyan-500/18"
                      >
                        Applica filtri
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="relative" ref={batchCategoriaRef}>
                        <button
                          ref={batchCategoriaBtnRef}
                          type="button"
                          onClick={() => setBatchCategoriaOpen(!batchCategoriaOpen)}
                          disabled={batchCategoriaUpdating}
                          className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3.5 py-2 text-[11px] font-bold text-app-fg-muted transition-colors hover:bg-white/[0.08] disabled:opacity-40"
                        >
                          {batchCategoriaUpdating ? '…' : 'Categoria'}
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {batchCategoriaOpen && (
                          <div className="absolute bottom-full left-0 mb-1.5 rounded-lg border border-app-line-28 app-workspace-surface-elevated shadow-[0_16px_40px_-8px_rgba(0,0,0,0.55)] ring-1 ring-inset ring-app-line-15 py-1 min-w-[160px]">
                            {CATEGORIE_DISPONIBILI.map((cat) => (
                              <button
                                key={cat}
                                type="button"
                                onClick={() => void handleBatchCategoriaChange(cat)}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-medium text-app-fg-muted transition-colors hover:bg-app-line-10 hover:text-app-fg"
                              >
                                {cat}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bulk action bar (Anomalie) */}
                {selectedDocs.size > 0 && (
                  <div className="flex items-center justify-between gap-4 rounded-lg border border-cyan-500/30 bg-cyan-900/40 px-4 py-3 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-cyan-100">
                        {selectedDocs.size} documento{selectedDocs.size !== 1 ? 'i' : ''} selezionat{selectedDocs.size !== 1 ? 'i' : 'o'}
                      </span>
                      <button
                        type="button"
                        onClick={clearSelection}
                        className="text-[11px] text-app-fg-muted underline decoration-app-fg-muted/30 underline-offset-2 hover:text-app-fg"
                      >
                        Annulla selezione
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmAction({ mode: 'batch', action: 'scarta', count: selectedDocs.size })}
                        disabled={actionLoading}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/35 bg-rose-500/10 px-3.5 py-2 text-[11px] font-bold text-rose-200 transition-colors hover:bg-rose-500/18 disabled:opacity-40"
                      >
                        Scarta selezionati
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmAction({ mode: 'batch', action: 'resetta', count: selectedDocs.size })}
                        disabled={actionLoading}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3.5 py-2 text-[11px] font-bold text-amber-200 transition-colors hover:bg-amber-500/18 disabled:opacity-40"
                      >
                        Resetta selezionati
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmAction({ mode: 'batch', action: 'elimina_duplicato', count: selectedDocs.size })}
                        disabled={actionLoading}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/35 bg-purple-500/10 px-3.5 py-2 text-[11px] font-bold text-purple-200 transition-colors hover:bg-purple-500/18 disabled:opacity-40"
                      >
                        Elimina duplicati
                      </button>
                    </div>
                  </div>
                )}

                {/* Lista anomalie */}
                {data?.data.filter((d) => d.anomalie.length > 0).length === 0 ? (
                  <div className="app-card overflow-hidden p-8 text-center">
                    <p className="text-sm text-emerald-200/90">Nessuna anomalia rilevata. Tutti i documenti associati sono OK.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data?.data
                      .filter((d) => d.anomalie.length > 0)
                      .slice(0, 100)
                      .map((doc) => (
                        <div key={doc.id} className={`app-card overflow-hidden ${selectedDocs.has(doc.id) ? 'ring-1 ring-cyan-500/40' : ''}`}>
                          <div className="flex items-start justify-between gap-4 border-b border-app-line-10 p-4">
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                              <div className="mt-1 shrink-0">
                                <input
                                  type="checkbox"
                                  checked={selectedDocs.has(doc.id)}
                                  onChange={() => toggleSelectDoc(doc.id)}
                                  className="rounded border-app-soft-border bg-black/30 text-cyan-500 focus:ring-cyan-500/30"
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-app-fg">
                                  {doc.fornitore?.nome ?? 'Fornitore sconosciuto'}
                                </p>
                                <p className="mt-0.5 truncate text-[11px] text-app-fg-muted">
                                  {doc.file_name ?? 'Nessun file'} · {doc.mittente ?? 'mittente sconosciuto'}
                                </p>
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <CategoriaDropdown
                                categoria={determinaCategoriaDocumento(doc)}
                                documentoId={doc.id}
                                onCategoriaChange={handleCategoriaChange}
                              />
                              <AzioneConsigliataBadge
                                anomalie={doc.anomalie}
                                learningData={learningData}
                                categoria={determinaCategoriaDocumento(doc)}
                                onClick={() => {
                                  const consiglio = analizzaAzioneConsigliata(doc.anomalie, learningData, determinaCategoriaDocumento(doc))
                                  if (!consiglio) return
                                  void handleAction(doc.id, consiglio.action)
                                }}
                              />
                              <span className="text-[11px] text-app-fg-muted">
                                {doc.giorni_da_associazione}g
                              </span>
                              <button
                                type="button"
                                onClick={() => setConfirmAction({ mode: 'single', docId: doc.id, action: 'scarta', docName: doc.file_name ?? doc.id.substring(0, 8) })}
                                disabled={actionLoading}
                                title="Scarta: Rimuove l'associazione e marca come scartato. Usa solo se il documento è irrecuperabile (es. file mancante, duplicato errato)."
                                className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/8 px-2 py-1 text-[10px] font-bold text-rose-200 transition-colors hover:bg-rose-500/15 disabled:opacity-40"
                              >
                                Scarta
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmAction({ mode: 'single', docId: doc.id, action: 'resetta', docName: doc.file_name ?? doc.id.substring(0, 8) })}
                                disabled={actionLoading}
                                title="Resetta: Riporta a 'da associare' per rielaborare. Usa se l'associazione è sbagliata o mancano dati, ma il documento è valido."
                                className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/8 px-2 py-1 text-[10px] font-bold text-amber-200 transition-colors hover:bg-amber-500/15 disabled:opacity-40"
                              >
                                Resetta
                              </button>
                              {doc.anomalie.some((a) => a.tipo === 'documento_duplicato') && (
                                <button
                                  type="button"
                                  onClick={() => setConfirmAction({ mode: 'single', docId: doc.id, action: 'elimina_duplicato', docName: doc.file_name ?? doc.id.substring(0, 8) })}
                                  disabled={actionLoading}
                                  title="Duplicato: Marca come scartato (duplicato). Usa solo se il documento è identico a un altro già presente."
                                  className="inline-flex items-center gap-1 rounded-md border border-purple-500/30 bg-purple-500/8 px-2 py-1 text-[10px] font-bold text-purple-200 transition-colors hover:bg-purple-500/15 disabled:opacity-40"
                                >
                                  Duplicato
                                </button>
                              )}
                              {doc.file_url ? (
                                <OpenDocumentInAppButton
                                  documentoId={doc.id}
                                  fileUrl={doc.file_url}
                                  anomalie={doc.anomalie}
                                  categoria={determinaCategoriaDocumento(doc)}
                                  onCategoriaChange={handleCategoriaChange}
                                  viewerActions={[
                                    { action: 'scarta', label: 'Scarta', onClick: () => setConfirmAction({ mode: 'single', docId: doc.id, action: 'scarta', docName: doc.file_name ?? doc.id.substring(0, 8) }) },
                                    { action: 'resetta', label: 'Resetta', onClick: () => setConfirmAction({ mode: 'single', docId: doc.id, action: 'resetta', docName: doc.file_name ?? doc.id.substring(0, 8) }) },
                                    ...(doc.anomalie.some((a) => a.tipo === 'documento_duplicato')
                                      ? [{ action: 'elimina_duplicato' as const, label: 'Elimina duplicato' as const, onClick: () => setConfirmAction({ mode: 'single', docId: doc.id, action: 'elimina_duplicato', docName: doc.file_name ?? doc.id.substring(0, 8) }) }]
                                      : []),
                                  ]}
                                  className="inline-flex items-center gap-1 rounded-md border border-cyan-500/30 bg-cyan-500/8 px-2 py-1 text-[10px] font-bold text-cyan-200 transition-colors hover:bg-cyan-500/15"
                                >
                                  Apri
                                </OpenDocumentInAppButton>
                              ) : null}
                            </div>
                          </div>
                          <div className="space-y-2 p-4">
                            {doc.anomalie.map((a) => {
                              const cfg = GRAVITA_CONFIG[a.gravita] ?? GRAVITA_CONFIG.bassa
                              return (
                                <div key={a.id} className={`flex items-start gap-3 rounded-lg border ${cfg.border} ${cfg.bg} p-3`}>
                                  <div className="mt-0.5 shrink-0">
                                    <GravitaBadge gravita={a.gravita} />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <TipoAnomaliaBadge tipo={a.tipo} />
                                      {a.riferimento_id && (
                                        <span className="text-[10px] text-app-fg-muted">
                                          Documento correlato: {a.riferimento_id.substring(0, 8)}...
                                        </span>
                                      )}
                                    </div>
                                    <p className="mt-1 text-[11px] leading-relaxed text-app-fg">{a.descrizione}</p>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    {data && data.data.filter((d) => d.anomalie.length > 0).length > 100 && (
                      <div className="text-center">
                        <p className="text-xs text-app-fg-muted">
                          Mostrate le prime 100 anomalie. Utilizza i filtri per restringere la ricerca.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        ) : null}

        {/* Action feedback banner */}
        {actionFeedback && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-900/90 px-5 py-3 text-sm text-emerald-100 shadow-lg backdrop-blur-sm">
            <svg className="h-5 w-5 shrink-0 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{actionFeedback}</span>
            <button
              type="button"
              onClick={() => setActionFeedback(null)}
              className="ml-2 rounded-md p-1 text-emerald-200/70 transition-colors hover:bg-emerald-800/50 hover:text-emerald-100"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Confirmation modal */}
        {confirmAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="mx-4 w-full max-w-md rounded-xl border border-app-soft-border bg-app-surface p-6 shadow-2xl">
              <h3 className="text-base font-bold text-app-fg">
                {confirmAction.mode === 'batch' ? (
                  <>
                    {confirmAction.action === 'scarta' && `Scartare ${confirmAction.count} documenti?`}
                    {confirmAction.action === 'elimina_duplicato' && `Eliminare ${confirmAction.count} duplicati?`}
                    {confirmAction.action === 'resetta' && `Riassegnare ${confirmAction.count} documenti?`}
                  </>
                ) : (
                  <>
                    {confirmAction.action === 'scarta' && 'Scartare il documento?'}
                    {confirmAction.action === 'elimina_duplicato' && 'Eliminare il duplicato?'}
                    {confirmAction.action === 'resetta' && 'Riassegnare a "da associare"?'}
                  </>
                )}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-app-fg-muted">
                {confirmAction.mode === 'batch' ? (
                  <>
                    {confirmAction.action === 'scarta' && (
                      <><strong>{confirmAction.count} documenti</strong> verranno marcati come <strong>scartati</strong> e le associazioni con fattura/bolla verranno rimosse. Questa operazione non è reversibile automaticamente.</>
                    )}
                    {confirmAction.action === 'elimina_duplicato' && (
                      <><strong>{confirmAction.count} documenti</strong> verranno marcati come <strong>scartati (duplicati)</strong>. Questa operazione non è reversibile automaticamente.</>
                    )}
                    {confirmAction.action === 'resetta' && (
                      <><strong>{confirmAction.count} documenti</strong> verranno riportati allo stato <strong>da associare</strong>, eliminando le associazioni correnti. Potranno essere riprocessati manualmente.</>
                    )}
                  </>
                ) : (
                  <>
                    {confirmAction.action === 'scarta' && (
                      <>Il documento <strong>{confirmAction.docName}</strong> verrà marcato come <strong>scartato</strong> e l'associazione con fattura/bolla verrà rimossa. Questa azione non è reversibile automaticamente.</>
                    )}
                    {confirmAction.action === 'elimina_duplicato' && (
                      <>Il documento <strong>{confirmAction.docName}</strong> verrà marcato come <strong>scartato (duplicato)</strong>. Questa azione non è reversibile automaticamente.</>
                    )}
                    {confirmAction.action === 'resetta' && (
                      <>Il documento <strong>{confirmAction.docName}</strong> verrà riportato allo stato <strong>da associare</strong>, eliminando l'associazione corrente. Potrà essere riprocessato manualmente.</>
                    )}
                  </>
                )}
              </p>
              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmAction(null)}
                  disabled={actionLoading}
                  className="rounded-lg border border-app-soft-border bg-white/[0.03] px-4 py-2 text-xs font-bold text-app-fg transition-colors hover:bg-white/[0.06] disabled:opacity-50"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirmAction.mode === 'batch') {
                      void handleBatchAction(confirmAction.action)
                    } else {
                      void handleAction(confirmAction.docId, confirmAction.action)
                    }
                  }}
                  disabled={actionLoading}
                  className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-bold transition-colors disabled:opacity-50 ${
                    confirmAction.action === 'resetta'
                      ? 'border-amber-500/45 bg-amber-500/12 text-amber-100 hover:bg-amber-500/18'
                      : confirmAction.action === 'elimina_duplicato'
                        ? 'border-purple-500/45 bg-purple-500/12 text-purple-100 hover:bg-purple-500/18'
                        : 'border-rose-500/45 bg-rose-500/12 text-rose-100 hover:bg-rose-500/18'
                  }`}
                >
                  {actionLoading ? (
                    <>Attendi...</>
                  ) : (
                    <>
                      {confirmAction.mode === 'batch' ? (
                        <>
                          {confirmAction.action === 'scarta' && `Scarta ${confirmAction.count} documenti`}
                          {confirmAction.action === 'elimina_duplicato' && `Elimina ${confirmAction.count} duplicati`}
                          {confirmAction.action === 'resetta' && `Riassegna ${confirmAction.count} documenti`}
                        </>
                      ) : (
                        <>
                          {confirmAction.action === 'scarta' && 'Scarta'}
                          {confirmAction.action === 'elimina_duplicato' && 'Elimina duplicato'}
                          {confirmAction.action === 'resetta' && 'Riassegna'}
                        </>
                      )}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Auto-resolve confirmation modal */}
        {autoResolveConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="mx-4 w-full max-w-md rounded-xl border border-app-soft-border bg-app-surface p-6 shadow-2xl">
              <h3 className="text-base font-bold text-app-fg">Auto-risolvere tutti i documenti?</h3>
              <p className="mt-2 text-sm leading-relaxed text-app-fg-muted">
                <strong>{showStats?.totale_con_anomalie ?? 0} documenti</strong> con anomalie verranno elaborati automaticamente:
              </p>
              <ul className="mt-3 space-y-1.5 text-sm text-app-fg-muted">
                <li className="flex items-center gap-2">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <strong>Categoria già imparata dall'AI</strong> → categoria corretta applicata automaticamente
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-400" />
                  <strong>File non trovato su storage</strong> → scartati (certi al 100%)
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-400" />
                  <strong>File_url non presente</strong> → scartati
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                  <strong>Altri (fornitore/riferimento mancante)</strong> → riportati a "da associare"
                </li>
              </ul>
              <p className="mt-3 text-xs text-app-fg-muted italic">
                L'operazione non è reversibile automaticamente.
              </p>
              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setAutoResolveConfirm(false)}
                  disabled={autoResolving}
                  className="rounded-lg border border-app-soft-border bg-white/[0.03] px-4 py-2 text-xs font-bold text-app-fg transition-colors hover:bg-white/[0.06] disabled:opacity-50"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={handleAutoResolve}
                  disabled={autoResolving}
                  className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-purple-500 disabled:opacity-50"
                >
                  {autoResolving ? 'Elaborazione in corso...' : `Auto-risolvi ${showStats?.totale_con_anomalie ?? 0} documenti`}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
