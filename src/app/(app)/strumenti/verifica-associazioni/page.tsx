'use client'

import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocale } from '@/lib/locale-context'
import { useMe } from '@/lib/me-context'
import { useActiveOperator } from '@/lib/active-operator-context'
import { canAccessCentroOperazioniPage } from '@/lib/effective-operator-ui'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import { AppPageHeaderTitleWithDashboardShortcut } from '@/components/AppPageHeaderDashboardShortcut'
import { BackButton } from '@/components/BackButton'
import { OpenDocumentInAppButton } from '@/components/OpenDocumentInAppButton'
import { CategoriaDropdown } from '@/components/CategoriaDropdown'
import { formatDate } from '@/lib/locale'
import type { Translations } from '@/lib/translations'
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

type GravitaConfig = { label: string; color: string; bg: string; border: string }

function buildGravitaConfig(t: Translations): Record<string, GravitaConfig> {
  const v = t.strumentiVerificaAssociazioni
  return {
    alta: { label: v.gravitaAlta, color: 'text-rose-200', bg: 'bg-rose-500/10', border: 'border-rose-500/30' },
    media: { label: v.gravitaMedia, color: 'text-amber-200', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
    bassa: { label: v.gravitaBassa, color: 'text-sky-200', bg: 'bg-sky-500/10', border: 'border-sky-500/30' },
  }
}

function buildTipoAnomaliaLabel(t: Translations): Record<string, string> {
  const v = t.strumentiVerificaAssociazioni
  return {
    file_mancante: v.tipoFileMancante,
    fornitore_mancante: v.tipoFornitoreMancante,
    data_mancante: v.tipoDataMancante,
    riferimento_assente: v.tipoRiferimentoAssente,
    riferimento_inesistente: v.tipoRiferimentoInesistente,
    documento_duplicato: v.tipoDocumentoDuplicato,
    sede_mancante: v.tipoSedeMancante,
    metadati_incompleti: v.tipoMetadatiIncompleti,
    associazione_vecchia: v.tipoAssociazioneVecchia,
  }
}

function GravitaBadge({ gravita, gravitaConfig }: { gravita: string; gravitaConfig: Record<string, GravitaConfig> }) {
  const cfg = gravitaConfig[gravita] ?? gravitaConfig.bassa
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${cfg.color} ${cfg.bg}`}>
      {cfg.label}
    </span>
  )
}

function TipoAnomaliaBadge({ tipo, tipoLabel }: { tipo: string; tipoLabel: Record<string, string> }) {
  return (
    <span className="inline-block rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px] text-app-fg-muted">
      {tipoLabel[tipo] ?? tipo}
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

type AzioneConfig = { label: string; color: string; border: string; bg: string }

function buildAzioneConfig(t: Translations): Record<string, AzioneConfig> {
  const v = t.strumentiVerificaAssociazioni
  return {
    elimina_duplicato: { label: v.actionEliminaDuplicato, color: 'text-purple-200', border: 'border-purple-500/30', bg: 'bg-purple-500/10' },
    resetta: { label: v.actionResetta, color: 'text-amber-200', border: 'border-amber-500/30', bg: 'bg-amber-500/10' },
    scarta: { label: v.actionScarta, color: 'text-rose-200', border: 'border-rose-500/30', bg: 'bg-rose-500/10' },
  }
}

function analizzaAzioneConsigliata(
  anomalie: Anomalia[],
  t: Translations,
  azioneConfig: Record<string, AzioneConfig>,
  learningData?: LearningResponse | null,
  categoria?: string,
): AzioneConsigliata | null {
  if (anomalie.length === 0) return null
  const v = t.strumentiVerificaAssociazioni

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
        const config = azioneConfig[action] ?? azioneConfig.resetta

        return {
          action,
          label: config.label,
          descrizione: v.descLearningPattern
            .replace('{percent}', String(pattern.azione_piu_frequente.percentuale))
            .replace('{label}', config.label)
            .replace('{total}', String(pattern.totale_azioni)),
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
      label: v.actionEliminaDuplicato,
      descrizione: v.descDuplicate,
      color: 'text-purple-200',
      border: 'border-purple-500/30',
      bg: 'bg-purple-500/10',
    }
  }

  if (tipi.has('riferimento_inesistente') || tipi.has('riferimento_assente')) {
    return {
      action: 'resetta',
      label: v.actionResetta,
      descrizione: tipi.has('riferimento_inesistente') ? v.descRefInexistent : v.descRefMissing,
      color: 'text-amber-200',
      border: 'border-amber-500/30',
      bg: 'bg-amber-500/10',
    }
  }

  if (tipi.has('file_mancante')) {
    return {
      action: 'scarta',
      label: v.actionScarta,
      descrizione: v.descFileMissing,
      color: 'text-rose-200',
      border: 'border-rose-500/30',
      bg: 'bg-rose-500/10',
    }
  }

  if (tipi.has('fornitore_mancante') || tipi.has('sede_mancante')) {
    return {
      action: 'resetta',
      label: v.actionResetta,
      descrizione: v.descMissingMetadata,
      color: 'text-amber-200',
      border: 'border-amber-500/30',
      bg: 'bg-amber-500/10',
    }
  }

  if (tipi.has('associazione_vecchia')) {
    return {
      action: 'resetta',
      label: v.actionResetta,
      descrizione: v.descAssociazioneVecchia,
      color: 'text-amber-200',
      border: 'border-amber-500/30',
      bg: 'bg-amber-500/10',
    }
  }

  return {
    action: 'resetta',
    label: v.actionResetta,
    descrizione: v.descGenericAnomalies,
    color: 'text-amber-200',
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/10',
  }
}

function AzioneConsigliataBadge({
  anomalie,
  learningData,
  categoria,
  onClick,
  t,
  azioneConfig,
}: {
  anomalie: Anomalia[]
  learningData?: LearningResponse | null
  categoria?: string
  onClick: () => void
  t: Translations
  azioneConfig: Record<string, AzioneConfig>
}) {
  const consiglio = analizzaAzioneConsigliata(anomalie, t, azioneConfig, learningData, categoria)
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
        {consiglio.daApprendimento ? `${consiglio.percentualeOperatori}${t.strumentiVerificaAssociazioni.operatorsAbbrev}` : t.strumentiVerificaAssociazioni.consigliato}
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

export default function VerificaAssociazioniPage() {
  const { t, locale } = useLocale()
  const v = t.strumentiVerificaAssociazioni
  const GRAVITA_CONFIG = useMemo(() => buildGravitaConfig(t), [t])
  const TIPO_ANOMALIA_LABEL = useMemo(() => buildTipoAnomaliaLabel(t), [t])
  const AZIONE_CONFIG = useMemo(() => buildAzioneConfig(t), [t])
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
      setError(e instanceof Error ? e.message : t.common.networkError)
    } finally {
      setLoading(false)
    }
  }, [buildUrl, t])

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
      setActionFeedback(result.message ?? v.feedbackOpComplete)
      await loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : t.common.networkError)
    } finally {
      setActionLoading(false)
      setConfirmAction(null)
    }
  }, [loadData, t, v])

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
      setActionFeedback(result.message ?? v.feedbackBatchOpComplete)
      setSelectedDocs(new Set())
      await loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : t.common.networkError)
    } finally {
      setActionLoading(false)
      setConfirmAction(null)
    }
  }, [confirmAction, selectedDocs, loadData, t, v])

  const handleCategoriaChange = useCallback(() => {
    void loadData()
  }, [loadData])

  const clearSelection = useCallback(() => {
    setSelectedDocs(new Set())
  }, [])

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
  }, [selectedDocs, loadData, clearSelection])

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
        setActionFeedback(data.error || v.feedbackAutoResolveError)
      }
      await loadData()
    } catch (e) {
      setActionFeedback(v.feedbackError.replace('{msg}', e instanceof Error ? e.message : t.strumentiCentroControllo.requestFailed))
    } finally {
      setAutoResolving(false)
    }
  }, [loadData, t, v])

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
              <h1 className={APP_PAGE_HEADER_STRIP_H1_CLASS}>{v.pageTitle}</h1>
              <p className={`${APP_PAGE_HEADER_STRIP_SUBTITLE_CLASS} !max-w-none`}>{v.accessDeniedTitle}</p>
            </AppPageHeaderTitleWithDashboardShortcut>
          </AppPageHeaderStrip>
          <div className="mt-6 app-card overflow-hidden p-6">
            <p className="m-0 text-sm leading-relaxed text-app-fg-muted">
              {v.accessDenied}
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
            <h1 className={APP_PAGE_HEADER_STRIP_H1_CLASS}>{v.pageTitle}</h1>
            <p className={`${APP_PAGE_HEADER_STRIP_SUBTITLE_CLASS} !max-w-none`}>
              {v.subtitle.replace('{total}', String(data?.total ?? '...'))}
            </p>
          </AppPageHeaderTitleWithDashboardShortcut>
        </AppPageHeaderStrip>

        {/* Tab Navigation */}
        <div className="mt-3 flex gap-1 rounded-lg border border-app-soft-border bg-black/20 p-1">
          {([
            { key: 'dashboard', label: v.tabDashboard },
            { key: 'elenco', label: v.tabElenco },
            { key: 'anomalie', label: v.tabAnomalie },
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
              {v.retry}
            </button>
          </div>
        ) : showStats ? (
          <>
            {/* === TAB: DASHBOARD === */}
            {activeTab === 'dashboard' && (
              <div className="mt-6 space-y-6">
                {/* KPI Cards */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  <StatCard label={v.statTotali} value={showStats.totale} color="text-white" />
                  <StatCard
                    label={v.statOk}
                    value={showStats.totale_ok}
                    color={showStats.totale_ok === showStats.totale ? 'text-emerald-300' : 'text-emerald-300'}
                    note={v.statOkNote.replace('{percent}', showStats.totale > 0 ? ((showStats.totale_ok / showStats.totale) * 100).toFixed(1) : '0')}
                  />
                  <StatCard
                    label={v.statConAnomalie}
                    value={showStats.totale_con_anomalie}
                    color={showStats.totale_con_anomalie > 0 ? 'text-rose-300' : 'text-emerald-300'}
                    note={v.statConAnomalieNote.replace('{percent}', showStats.totale > 0 ? ((showStats.totale_con_anomalie / showStats.totale) * 100).toFixed(1) : '0')}
                  />
                  <StatCard
                    label={v.statAnomalieTotali}
                    value={showStats.anomalie.totali}
                    color={showStats.anomalie.totali > 0 ? 'text-amber-300' : 'text-emerald-300'}
                  />
                  <StatCard
                    label={v.statAnomalieAlta}
                    value={showStats.anomalie.per_gravita.alta ?? 0}
                    color={showStats.anomalie.per_gravita.alta ? 'text-rose-300' : 'text-emerald-300'}
                  />
                  <StatCard
                    label={v.statDuplicati}
                    value={showStats.anomalie.per_tipo.documento_duplicato ?? 0}
                    color={showStats.anomalie.per_tipo.documento_duplicato ? 'text-rose-300' : 'text-emerald-300'}
                  />
                </div>

                {/* Auto-resolve banner */}
                {showStats.totale_con_anomalie > 0 && (
                  <div className="flex items-center justify-between rounded-lg border border-rose-500/30 bg-rose-900/30 px-5 py-4">
                    <div>
                      <p className="text-sm font-bold text-rose-200">
                        {v.autoResolveDocsWithAnomalies.replace('{n}', String(showStats.totale_con_anomalie))}
                      </p>
                      <p className="mt-0.5 text-xs text-rose-300/80">
                        {v.autoResolveAnomalieTotali
                          .replace('{anomalie}', String(showStats.anomalie.totali))
                          .replace('{alta}', String(showStats.anomalie.per_gravita.alta ?? 0))}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAutoResolveConfirm(true)}
                      disabled={autoResolving}
                      className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-purple-500 disabled:opacity-50"
                    >
                      {autoResolving ? (
                        <>{v.autoResolveBtnAnalizzo}</>
                      ) : (
                        <>
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          {v.autoResolveBtn}
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Distribuzione per tipo anomalia */}
                {report?.anomalie_riepilogo && report.anomalie_riepilogo.length > 0 && (
                  <CollapsibleSection
                    title={v.sectionDistribAnomalieTipo}
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
                        {v.sectionDistribAnomalieTipoExportBtn}
                      </button>
                    }
                  >
                    <div className="rounded-lg border border-app-line-22">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-app-fg-muted">
                            <th className="pb-2 pr-3 font-semibold">{v.colTipoAnomalia}</th>
                            <th className="pb-2 pr-3 font-semibold">{v.colGravita}</th>
                            <th className="pb-2 pr-3 font-semibold">{v.colConteggio}</th>
                            <th className="pb-2 pr-3 font-semibold">{v.colIncidenza}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-app-line-10">
                          {report.anomalie_riepilogo.map((a) => (
                            <tr key={a.tipo} className="text-app-fg hover:bg-white/[0.02]">
                              <td className="py-2 pr-3"><TipoAnomaliaBadge tipo={a.tipo} tipoLabel={TIPO_ANOMALIA_LABEL} /></td>
                              <td className="py-2 pr-3"><GravitaBadge gravita={a.gravita} gravitaConfig={GRAVITA_CONFIG} /></td>
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
                  title={v.sectionDistribAnomalieGravita}
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
                          <p className="mt-0.5 text-xs text-app-fg-muted">{v.gravitaTotalNote.replace('{percent}', pct)}</p>
                        </div>
                      )
                    })}
                  </div>
                </CollapsibleSection>

                {/* Distribuzione per tipo documento */}
                {showStats.distribuzione_tipo && Object.keys(showStats.distribuzione_tipo).length > 0 && (
                  <CollapsibleSection
                    title={v.sectionDistribTipoDoc}
                    count={Object.keys(showStats.distribuzione_tipo).length}
                    countColor="text-sky-300"
                  >
                    <div className="rounded-lg border border-app-line-22">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-app-fg-muted">
                            <th className="pb-2 pr-3 font-semibold">{v.colTipo}</th>
                            <th className="pb-2 pr-3 font-semibold">{v.colConteggio}</th>
                            <th className="pb-2 pr-3 font-semibold">{v.colIncidenza}</th>
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
                    title={v.sectionDistribSedi}
                    count={Object.keys(showStats.distribuzione_sedi).length}
                    countColor="text-indigo-300"
                  >
                    <div className="rounded-lg border border-app-line-22">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-app-fg-muted">
                            <th className="pb-2 pr-3 font-semibold">{v.colSede}</th>
                            <th className="pb-2 pr-3 font-semibold">{v.colDocumenti}</th>
                            <th className="pb-2 pr-3 font-semibold">{v.colIncidenza}</th>
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
                    title={v.sectionDistribMese}
                    count={Object.keys(showStats.distribuzione_mese).length}
                    countColor="text-teal-300"
                  >
                    <div className="rounded-lg border border-app-line-22">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-app-fg-muted">
                            <th className="pb-2 pr-3 font-semibold">{v.colMese}</th>
                            <th className="pb-2 pr-3 font-semibold">{v.colDocumenti}</th>
                            <th className="pb-2 pr-3 font-semibold">{v.colIncidenza}</th>
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
                    title={v.sectionApprendimentoAzioni}
                    count={learningData.statistiche_generali.totale_azioni}
                    countColor="text-emerald-300"
                    defaultOpen
                  >
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">{v.learningTotaleAzioni}</p>
                          <p className="mt-1 text-2xl font-bold text-emerald-200">{learningData.statistiche_generali.totale_azioni}</p>
                        </div>
                        <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">{v.learningAccuratezza}</p>
                          <div className="mt-1 flex items-baseline gap-2">
                            <p className="text-2xl font-bold text-cyan-200">{learningData.statistiche_generali.accuratezza_consigli}%</p>
                            <span className="text-[10px] text-app-fg-muted">
                              ({learningData.statistiche_generali.consigli_seguiti}/{learningData.statistiche_generali.totale_con_consiglio})
                            </span>
                          </div>
                        </div>
                        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">{v.learningResetta}</p>
                          <p className="mt-1 text-2xl font-bold text-amber-200">{learningData.statistiche_generali.per_azione.resetta ?? 0}</p>
                        </div>
                        <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-4">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">{v.learningScarta}</p>
                          <p className="mt-1 text-2xl font-bold text-rose-200">{learningData.statistiche_generali.per_azione.scarta ?? 0}</p>
                        </div>
                      </div>

                      {learningData.pattern_anomalie_azioni.length > 0 && (
                        <div>
                          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-app-fg-muted">
                            {v.learningPatternTitle}
                          </p>
                          <div className="rounded-lg border border-app-line-22">
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="text-app-fg-muted">
                                  <th className="pb-2 pr-3 font-semibold">{v.colAzioni}</th>
                                  <th className="pb-2 pr-3 font-semibold">{v.colCategoria}</th>
                                  <th className="pb-2 pr-3 font-semibold">{v.colGravitaMax}</th>
                                  <th className="pb-2 pr-3 font-semibold">{v.colAzioni}</th>
                                  <th className="pb-2 pr-3 font-semibold">{v.colAzionePiuFrequente}</th>
                                  <th className="pb-2 pr-3 font-semibold">{v.colDistribuzione}</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-app-line-10">
                                {learningData.pattern_anomalie_azioni.slice(0, 10).map((pattern, idx) => (
                                  <tr key={idx} className="text-app-fg hover:bg-white/[0.02]">
                                    <td className="py-2 pr-3">
                                      <div className="flex flex-wrap gap-1">
                                        {pattern.anomalie_tipi.length > 0
                                          ? pattern.anomalie_tipi.map((tipoCode) => <TipoAnomaliaBadge key={tipoCode} tipo={tipoCode} tipoLabel={TIPO_ANOMALIA_LABEL} />)
                                          : <span className="text-app-fg-muted">{v.learningEmpty}</span>
                                        }
                                      </div>
                                    </td>
                                    <td className="py-2 pr-3">
                                      <span className="inline-block rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] font-bold text-app-fg-muted">
                                        {pattern.documento_categoria ?? '—'}
                                      </span>
                                    </td>
                                    <td className="py-2 pr-3">
                                      <GravitaBadge gravita={pattern.gravita_max} gravitaConfig={GRAVITA_CONFIG} />
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
                                          {pattern.azione_piu_frequente.action === 'scarta'
                                            ? v.actionScarta
                                            : pattern.azione_piu_frequente.action === 'elimina_duplicato'
                                              ? v.actionEliminaDuplicato
                                              : v.actionResetta}
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
                        {v.learningFooter}
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
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">{v.filterSearchLabel}</label>
                      <input
                        type="text"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder={v.filterSearchPlaceholder}
                        className="w-full rounded-lg border border-app-soft-border bg-black/30 px-3 py-2 text-xs text-app-fg outline-none transition-colors placeholder:text-app-fg-muted/50 focus:border-cyan-500/50"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">{v.filterFromDate}</label>
                      <input
                        type="date"
                        value={filtroFromDate}
                        onChange={(e) => { setFiltroFromDate(e.target.value); setPage(1) }}
                        className="w-full rounded-lg border border-app-soft-border bg-black/30 px-3 py-2 text-xs text-app-fg outline-none transition-colors focus:border-cyan-500/50"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">{v.filterToDate}</label>
                      <input
                        type="date"
                        value={filtroToDate}
                        onChange={(e) => { setFiltroToDate(e.target.value); setPage(1) }}
                        className="w-full rounded-lg border border-app-soft-border bg-black/30 px-3 py-2 text-xs text-app-fg outline-none transition-colors focus:border-cyan-500/50"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">{v.filterAnomalieOnlyLabel}</label>
                      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-app-soft-border bg-black/30 px-3 py-2 text-xs text-app-fg">
                        <input
                          type="checkbox"
                          checked={filtroAnomalieOnly}
                          onChange={(e) => { setFiltroAnomalieOnly(e.target.checked); setPage(1) }}
                          className="rounded border-app-soft-border bg-black/30 text-cyan-500 focus:ring-cyan-500/30"
                        />
                        <span>{v.filterAnomalieOnlyText}</span>
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
                          {batchCategoriaUpdating ? '…' : v.filterCategoryBtn}
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
                        {v.filterApplyBtn}
                      </button>
                      <button
                        type="button"
                        onClick={resetFilters}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-app-soft-border bg-white/[0.03] px-3 py-1.5 text-[11px] font-bold text-app-fg-muted transition-colors hover:bg-white/[0.06]"
                      >
                        {v.filterResetBtn}
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
                      {v.filterExportBtn}
                    </button>
                  </div>
                </div>

                {/* Bulk action bar */}
                {selectedDocs.size > 0 && (
                  <div className="flex items-center justify-between gap-4 rounded-lg border border-cyan-500/30 bg-cyan-900/40 px-4 py-3 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-cyan-100">
                        {v.bulkSelected.replace('{n}', String(selectedDocs.size))}
                      </span>
                      <button
                        type="button"
                        onClick={clearSelection}
                        className="text-[11px] text-app-fg-muted underline decoration-app-fg-muted/30 underline-offset-2 hover:text-app-fg"
                      >
                        {v.bulkSelectedClear}
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
                        {v.bulkScartaBtn}
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
                        {v.bulkResettaBtn}
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
                        {v.bulkEliminaDuplicatiBtn}
                      </button>
                    </div>
                  </div>
                )}

                {/* Tabella documenti */}
                <div className="app-card overflow-x-auto">
                  <div className="rounded-lg border border-app-line-22">
                    {data && data.data.length === 0 ? (
                      <div className="p-8 text-center">
                        <p className="text-sm text-app-fg-muted">{v.elencoEmptyHint}</p>
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
                            <th className="sticky top-0 bg-app-bg px-1.5 py-1.5 pr-1.5 font-semibold">{v.elencoColFornitore}</th>
                            <th className="sticky top-0 bg-app-bg px-1.5 py-1.5 pr-1.5 font-semibold">{v.elencoColFile}</th>
                            <th className="sticky top-0 bg-app-bg px-1.5 py-1.5 pr-1.5 font-semibold">{v.elencoColDataDoc}</th>
                            <th className="sticky top-0 bg-app-bg px-1.5 py-1.5 pr-1.5 font-semibold">{v.elencoColTipo}</th>
                            <th className="sticky top-0 bg-app-bg px-1.5 py-1.5 pr-1.5 font-semibold">{v.elencoColRiferimento}</th>
                            <th className="sticky top-0 bg-app-bg px-1.5 py-1.5 pr-1.5 font-semibold">{v.elencoColAnomalie}</th>
                            <th className="sticky top-0 bg-app-bg px-1.5 py-1.5 pr-1.5 font-semibold">{v.elencoColGiorni}</th>
                            <th className="sticky top-0 bg-app-bg px-1.5 py-1.5 pr-1.5 font-semibold">{v.elencoColCreatoIl}</th>
                            <th className="sticky top-0 bg-app-bg px-1.5 py-1.5 pr-1.5 font-semibold">{v.elencoColAzioni}</th>
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
                                <td className="px-2 py-1.5 pr-1">
                                  <input
                                    type="checkbox"
                                    checked={selectedDocs.has(doc.id)}
                                    onChange={() => toggleSelectDoc(doc.id)}
                                    className="rounded border-app-soft-border bg-black/30 text-cyan-500 focus:ring-cyan-500/30"
                                  />
                                </td>
                                <td className="px-1.5 py-1.5 pr-1.5 max-w-[160px]">
                                  <p className="truncate font-medium" title={doc.fornitore?.nome ?? ''}>
                                    {doc.fornitore?.nome ?? '—'}
                                  </p>
                                  {doc.mittente ? (
                                    <p className="truncate text-[10px] text-app-fg-muted" title={doc.mittente}>{doc.mittente}</p>
                                  ) : null}
                                </td>
                                <td className="px-1.5 py-1.5 pr-1.5 max-w-[180px]">
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
                                          { action: 'scarta', label: v.btnLabelScarta, onClick: () => setConfirmAction({ mode: 'single', docId: doc.id, action: 'scarta', docName: doc.file_name ?? doc.id.substring(0, 8) }) },
                                          { action: 'resetta', label: v.btnLabelResetta, onClick: () => setConfirmAction({ mode: 'single', docId: doc.id, action: 'resetta', docName: doc.file_name ?? doc.id.substring(0, 8) }) },
                                          ...(doc.anomalie.some((a) => a.tipo === 'documento_duplicato')
                                            ? [{ action: 'elimina_duplicato' as const, label: v.actionEliminaDuplicato, onClick: () => setConfirmAction({ mode: 'single', docId: doc.id, action: 'elimina_duplicato', docName: doc.file_name ?? doc.id.substring(0, 8) }) }]
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
                                <td className="px-1.5 py-1.5 pr-1.5 tabular-nums">
                                  {doc.data_documento ? formatDate(doc.data_documento, locale) : '—'}
                                </td>
                                <td className="px-1.5 py-1.5 pr-1.5">
                                  {pendingKind ? (
                                    <span className="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px] capitalize">
                                      {pendingKind}
                                    </span>
                                  ) : (
                                    <span className="text-app-fg-muted">—</span>
                                  )}
                                </td>
                                <td className="px-1.5 py-1.5 pr-1.5 max-w-[140px]">
                                  {doc.fattura ? (
                                    <span className="text-emerald-200" title={v.fattRefShort.replace('{num}', doc.fattura.numero_fattura)}>
                                      {v.fattRefShort.replace('{num}', doc.fattura.numero_fattura)}
                                    </span>
                                  ) : doc.bolla ? (
                                    <span className="text-sky-200" title={v.bollaRefShort.replace('{num}', doc.bolla.numero_bolla)}>
                                      {v.bollaRefShort.replace('{num}', doc.bolla.numero_bolla)}
                                    </span>
                                  ) : (
                                    <span className="text-app-fg-muted">—</span>
                                  )}
                                </td>
                                <td className="px-1.5 py-1.5 pr-1.5">
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
                                <td className="px-1.5 py-1.5 pr-1.5 tabular-nums">
                                  <span className={doc.giorni_da_associazione > 180 ? 'text-amber-200' : 'text-app-fg-muted'}>
                                    {doc.giorni_da_associazione}{v.daysSuffix}
                                  </span>
                                </td>
                                <td className="px-1.5 py-1.5 pr-1.5 text-app-fg-muted">
                                  {doc.created_at ? formatDate(doc.created_at, locale) : '—'}
                                </td>
                                <td className="px-1.5 py-1.5 pr-1.5">
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
                                      t={t}
                                      azioneConfig={AZIONE_CONFIG}
                                      onClick={() => {
                                        const consiglio = analizzaAzioneConsigliata(doc.anomalie, t, AZIONE_CONFIG, learningData, determinaCategoriaDocumento(doc))
                                        if (!consiglio) return
                                        setConfirmAction({ mode: 'single', docId: doc.id, action: consiglio.action, docName: doc.file_name ?? doc.id.substring(0, 8) })
                                      }}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setConfirmAction({ mode: 'single', docId: doc.id, action: 'scarta', docName: doc.file_name ?? doc.id.substring(0, 8) })}
                                      disabled={actionLoading}
                                      title={v.btnTooltipScarta}
                                      className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/8 px-2 py-1 text-[10px] font-bold text-rose-200 transition-colors hover:bg-rose-500/15 disabled:opacity-40"
                                    >
                                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                      {v.btnLabelScarta}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmAction({ mode: 'single', docId: doc.id, action: 'resetta', docName: doc.file_name ?? doc.id.substring(0, 8) })}
                                      disabled={actionLoading}
                                      title={v.btnTooltipResetta}
                                      className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/8 px-2 py-1 text-[10px] font-bold text-amber-200 transition-colors hover:bg-amber-500/15 disabled:opacity-40"
                                    >
                                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                      </svg>
                                      {v.btnLabelResetta}
                                    </button>
                                    {doc.anomalie.some((a) => a.tipo === 'documento_duplicato') && (
                                      <button
                                        type="button"
                                        onClick={() => setConfirmAction({ mode: 'single', docId: doc.id, action: 'elimina_duplicato', docName: doc.file_name ?? doc.id.substring(0, 8) })}
                                        disabled={actionLoading}
                                        title={v.btnTooltipDuplicato}
                                        className="inline-flex items-center gap-1 rounded-md border border-purple-500/30 bg-purple-500/8 px-2 py-1 text-[10px] font-bold text-purple-200 transition-colors hover:bg-purple-500/15 disabled:opacity-40"
                                      >
                                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M23 1l-6 6m0 0l6 6m-6-6H1" />
                                        </svg>
                                        {v.btnLabelDuplicato}
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
                        {v.paginationShown
                          .replace('{from}', String((data.page - 1) * data.limit + 1))
                          .replace('{to}', String(Math.min(data.page * data.limit, data.total)))
                          .replace('{total}', String(data.total))}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={page <= 1}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          className="inline-flex items-center gap-1 rounded-md border border-app-soft-border bg-white/[0.03] px-2.5 py-1 text-[11px] font-bold text-app-fg transition-colors hover:bg-white/[0.06] disabled:opacity-30"
                        >
                          {v.paginationPrev}
                        </button>
                        <span className="text-[11px] text-app-fg-muted">{v.paginationPage.replace('{n}', String(data.page))}</span>
                        <button
                          type="button"
                          disabled={data.page * data.limit >= data.total}
                          onClick={() => setPage((p) => p + 1)}
                          className="inline-flex items-center gap-1 rounded-md border border-app-soft-border bg-white/[0.03] px-2.5 py-1 text-[11px] font-bold text-app-fg transition-colors hover:bg-white/[0.06] disabled:opacity-30"
                        >
                          {v.paginationNext}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Select page size */}
                  {data && data.total > 10 && (
                    <div className="flex items-center justify-end border-t border-app-line-10 px-4 py-2">
                      <label className="flex items-center gap-2 text-[11px] text-app-fg-muted">
                        {v.rowsPerPage}
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
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">{v.anomalieFiltersSearchLabel}</label>
                      <input
                        type="text"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder={v.anomalieFiltersSearchPlaceholder}
                        className="w-full rounded-lg border border-app-soft-border bg-black/30 px-3 py-2 text-xs text-app-fg outline-none transition-colors placeholder:text-app-fg-muted/50 focus:border-cyan-500/50"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">{v.filterFromDate}</label>
                      <input
                        type="date"
                        value={filtroFromDate}
                        onChange={(e) => { setFiltroFromDate(e.target.value); setPage(1) }}
                        className="w-full rounded-lg border border-app-soft-border bg-black/30 px-3 py-2 text-xs text-app-fg outline-none transition-colors focus:border-cyan-500/50"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">{v.filterToDate}</label>
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
                        {v.filterApplyBtn}
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
                          {batchCategoriaUpdating ? '…' : v.filterCategoryBtn}
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
                        {v.bulkSelected.replace('{n}', String(selectedDocs.size))}
                      </span>
                      <button
                        type="button"
                        onClick={clearSelection}
                        className="text-[11px] text-app-fg-muted underline decoration-app-fg-muted/30 underline-offset-2 hover:text-app-fg"
                      >
                        {v.bulkSelectedClear}
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmAction({ mode: 'batch', action: 'scarta', count: selectedDocs.size })}
                        disabled={actionLoading}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/35 bg-rose-500/10 px-3.5 py-2 text-[11px] font-bold text-rose-200 transition-colors hover:bg-rose-500/18 disabled:opacity-40"
                      >
                        {v.bulkScartaBtn}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmAction({ mode: 'batch', action: 'resetta', count: selectedDocs.size })}
                        disabled={actionLoading}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3.5 py-2 text-[11px] font-bold text-amber-200 transition-colors hover:bg-amber-500/18 disabled:opacity-40"
                      >
                        {v.bulkResettaBtn}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmAction({ mode: 'batch', action: 'elimina_duplicato', count: selectedDocs.size })}
                        disabled={actionLoading}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/35 bg-purple-500/10 px-3.5 py-2 text-[11px] font-bold text-purple-200 transition-colors hover:bg-purple-500/18 disabled:opacity-40"
                      >
                        {v.bulkEliminaDuplicatiBtn}
                      </button>
                    </div>
                  </div>
                )}

                {/* Lista anomalie */}
                {data?.data.filter((d) => d.anomalie.length > 0).length === 0 ? (
                  <div className="app-card overflow-hidden p-8 text-center">
                    <p className="text-sm text-emerald-200/90">{v.anomalieEmpty}</p>
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
                                  {doc.fornitore?.nome ?? v.anomaliaFornitoreUnknown}
                                </p>
                                <p className="mt-0.5 truncate text-[11px] text-app-fg-muted">
                                  {doc.file_name ?? v.anomaliaFileUnknown} · {doc.mittente ?? v.anomaliaSenderUnknown}
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
                                t={t}
                                azioneConfig={AZIONE_CONFIG}
                                onClick={() => {
                                  const consiglio = analizzaAzioneConsigliata(doc.anomalie, t, AZIONE_CONFIG, learningData, determinaCategoriaDocumento(doc))
                                  if (!consiglio) return
                                  void handleAction(doc.id, consiglio.action)
                                }}
                              />
                              <span className="text-[11px] text-app-fg-muted">
                                {doc.giorni_da_associazione}{v.daysSuffix}
                              </span>
                              <button
                                type="button"
                                onClick={() => setConfirmAction({ mode: 'single', docId: doc.id, action: 'scarta', docName: doc.file_name ?? doc.id.substring(0, 8) })}
                                disabled={actionLoading}
                                title={v.btnTooltipScarta}
                                className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/8 px-2 py-1 text-[10px] font-bold text-rose-200 transition-colors hover:bg-rose-500/15 disabled:opacity-40"
                              >
                                {v.btnLabelScarta}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmAction({ mode: 'single', docId: doc.id, action: 'resetta', docName: doc.file_name ?? doc.id.substring(0, 8) })}
                                disabled={actionLoading}
                                title={v.btnTooltipResetta}
                                className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/8 px-2 py-1 text-[10px] font-bold text-amber-200 transition-colors hover:bg-amber-500/15 disabled:opacity-40"
                              >
                                {v.btnLabelResetta}
                              </button>
                              {doc.anomalie.some((a) => a.tipo === 'documento_duplicato') && (
                                <button
                                  type="button"
                                  onClick={() => setConfirmAction({ mode: 'single', docId: doc.id, action: 'elimina_duplicato', docName: doc.file_name ?? doc.id.substring(0, 8) })}
                                  disabled={actionLoading}
                                  title={v.btnTooltipDuplicato}
                                  className="inline-flex items-center gap-1 rounded-md border border-purple-500/30 bg-purple-500/8 px-2 py-1 text-[10px] font-bold text-purple-200 transition-colors hover:bg-purple-500/15 disabled:opacity-40"
                                >
                                  {v.btnLabelDuplicato}
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
                                    { action: 'scarta', label: v.btnLabelScarta, onClick: () => setConfirmAction({ mode: 'single', docId: doc.id, action: 'scarta', docName: doc.file_name ?? doc.id.substring(0, 8) }) },
                                    { action: 'resetta', label: v.btnLabelResetta, onClick: () => setConfirmAction({ mode: 'single', docId: doc.id, action: 'resetta', docName: doc.file_name ?? doc.id.substring(0, 8) }) },
                                    ...(doc.anomalie.some((a) => a.tipo === 'documento_duplicato')
                                      ? [{ action: 'elimina_duplicato' as const, label: v.actionEliminaDuplicato, onClick: () => setConfirmAction({ mode: 'single', docId: doc.id, action: 'elimina_duplicato', docName: doc.file_name ?? doc.id.substring(0, 8) }) }]
                                      : []),
                                  ]}
                                  className="inline-flex items-center gap-1 rounded-md border border-cyan-500/30 bg-cyan-500/8 px-2 py-1 text-[10px] font-bold text-cyan-200 transition-colors hover:bg-cyan-500/15"
                                >
                                  {v.anomalieOpenBtn}
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
                                    <GravitaBadge gravita={a.gravita} gravitaConfig={GRAVITA_CONFIG} />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <TipoAnomaliaBadge tipo={a.tipo} tipoLabel={TIPO_ANOMALIA_LABEL} />
                                      {a.riferimento_id && (
                                        <span className="text-[10px] text-app-fg-muted">
                                          {v.anomaliaCorrelatedDoc.replace('{id}', a.riferimento_id.substring(0, 8))}
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
                          {v.anomalieMaxShown}
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
                    {confirmAction.action === 'scarta' && v.confirmTitleBatchScarta.replace('{n}', String(confirmAction.count))}
                    {confirmAction.action === 'elimina_duplicato' && v.confirmTitleBatchElimina.replace('{n}', String(confirmAction.count))}
                    {confirmAction.action === 'resetta' && v.confirmTitleBatchResetta.replace('{n}', String(confirmAction.count))}
                  </>
                ) : (
                  <>
                    {confirmAction.action === 'scarta' && v.confirmTitleSingleScarta}
                    {confirmAction.action === 'elimina_duplicato' && v.confirmTitleSingleElimina}
                    {confirmAction.action === 'resetta' && v.confirmTitleSingleResetta}
                  </>
                )}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-app-fg-muted">
                {confirmAction.mode === 'batch' ? (
                  <>
                    {confirmAction.action === 'scarta' && v.confirmDescBatchScarta.replace('{n}', String(confirmAction.count))}
                    {confirmAction.action === 'elimina_duplicato' && v.confirmDescBatchElimina.replace('{n}', String(confirmAction.count))}
                    {confirmAction.action === 'resetta' && v.confirmDescBatchResetta.replace('{n}', String(confirmAction.count))}
                  </>
                ) : (
                  <>
                    {confirmAction.action === 'scarta' && v.confirmDescSingleScarta.replace('{name}', confirmAction.docName)}
                    {confirmAction.action === 'elimina_duplicato' && v.confirmDescSingleElimina.replace('{name}', confirmAction.docName)}
                    {confirmAction.action === 'resetta' && v.confirmDescSingleResetta.replace('{name}', confirmAction.docName)}
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
                  {v.confirmCancelBtn}
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
                    <>{v.confirmAttendi}</>
                  ) : (
                    <>
                      {confirmAction.mode === 'batch' ? (
                        <>
                          {confirmAction.action === 'scarta' && v.confirmBtnBatchScarta.replace('{n}', String(confirmAction.count))}
                          {confirmAction.action === 'elimina_duplicato' && v.confirmBtnBatchElimina.replace('{n}', String(confirmAction.count))}
                          {confirmAction.action === 'resetta' && v.confirmBtnBatchResetta.replace('{n}', String(confirmAction.count))}
                        </>
                      ) : (
                        <>
                          {confirmAction.action === 'scarta' && v.confirmBtnSingleScarta}
                          {confirmAction.action === 'elimina_duplicato' && v.confirmBtnSingleElimina}
                          {confirmAction.action === 'resetta' && v.confirmBtnSingleResetta}
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
              <h3 className="text-base font-bold text-app-fg">{v.autoResolveTitle}</h3>
              <p className="mt-2 text-sm leading-relaxed text-app-fg-muted">
                {v.autoResolveBodyIntro.replace('{n}', String(showStats?.totale_con_anomalie ?? 0))}
              </p>
              <ul className="mt-3 space-y-1.5 text-sm text-app-fg-muted">
                <li className="flex items-center gap-2">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {v.autoResolveBodyAi}
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-400" />
                  {v.autoResolveBodyFileMissing}
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-400" />
                  {v.autoResolveBodyNoUrl}
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                  {v.autoResolveBodyOther}
                </li>
              </ul>
              <p className="mt-3 text-xs text-app-fg-muted italic">
                {v.autoResolveBodyFooter}
              </p>
              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setAutoResolveConfirm(false)}
                  disabled={autoResolving}
                  className="rounded-lg border border-app-soft-border bg-white/[0.03] px-4 py-2 text-xs font-bold text-app-fg transition-colors hover:bg-white/[0.06] disabled:opacity-50"
                >
                  {v.autoResolveCancelBtn}
                </button>
                <button
                  type="button"
                  onClick={handleAutoResolve}
                  disabled={autoResolving}
                  className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-purple-500 disabled:opacity-50"
                >
                  {autoResolving ? v.autoResolveConfirmBtnLoading : v.autoResolveConfirmBtn.replace('{n}', String(showStats?.totale_con_anomalie ?? 0))}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
