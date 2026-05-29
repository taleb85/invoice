'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useToast } from '@/lib/toast-context'
import {
  AlertCircle,
  Brain,
  Calendar,
  CheckCircle,
  ChevronRight,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  ScanLine,
  Search,
  X,
  Zap,
} from 'lucide-react'
import { GlyphCheck } from '@/components/ui/glyph-icons'
import { OpenDocumentInAppButton } from '@/components/OpenDocumentInAppButton'
import { INITIALIZE_COMMANDS } from '@/lib/command-system/init'
import type { CodaItem, AiSuggestion, CommandId, Command } from '@/lib/command-system/types'
import {
  tuttiComandi,
  getComando,
  comandiApplicabili,
} from '@/lib/command-system/registry'
import { suggerisciAzione, registraConfermaApprendimento, registraEsecuzioneDiretta } from '@/lib/action-learning/engine'
import { formattaPriorita, labelPendingKind } from '@/lib/command-system/utils'
import { useDocumentActions } from '@/lib/document-actions-context'
import { useManualDeliverySede } from '@/lib/use-effective-sede-id'
import { useT } from '@/lib/use-t'
import { useLocale } from '@/lib/locale-context'
import { formatDate, formatDateTime } from '@/lib/locale'
import AuditAndFixAllCard from '@/components/admin/audit-and-fix-all-card'
import AssociaFornitoreDialog from './_dialogs/associa-fornitore-dialog'
import AggiornaCategoriaDialog from './_dialogs/aggiorna-categoria-dialog'
import RifiutaFatturaDialog from './_dialogs/rifiuta-fattura-dialog'
import AssegnaFatturaDialog from './_dialogs/assegna-fattura-dialog'
import StatementGruppoCoda from './statement-gruppo-coda'
import { buildCodaDisplayEntries } from '@/lib/centro-controllo-coda-grouping'
import { interpolateTemplate } from '@/lib/interpolate-template'

INITIALIZE_COMMANDS()

interface Props {
  sedeId: string | null
}

type FiltroOrigine = 'tutti' | 'documento_da_processare' | 'riga_statement' | 'fattura' | 'errore_sincronizzazione' | 'bolla_aperta'

// ─── Sezione wrapper ─────────────────────────────────────────────────────────
function SectionCard({ title, badge, action, children, className }: {
  title: string
  badge?: string | number | null
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`app-card overflow-hidden ${className ?? ''}`}>
      <div className="flex items-center justify-between gap-2 border-b border-app-line-15 px-4 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold text-app-fg-muted uppercase tracking-wide truncate">{title}</span>
          {badge != null && (
            <span className="inline-flex items-center rounded-full bg-purple-500/15 px-2 py-0.5 text-[10px] font-bold text-purple-300 shrink-0">
              {badge}
            </span>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

const AUTO_RISOLVI_PHASES = [
  'Carico gli estratti conto…',
  'Chiudo falsi allarmi con fattura già presente…',
  'Verifico importi riga per riga…',
  'Ricalcolo il triple-check sui casi aperti…',
  'Aggiorno il conteggio anomalie…',
] as const

export default function CentroControlloClient({ sedeId }: Props) {
  const { showToast } = useToast()
  const t = useT()
  const { effectiveSedeId } = useManualDeliverySede()
  const { openActions } = useDocumentActions()

  // ── Coda documenti ───────────────────────────────────────────────────────
  const [items, setItems] = useState<CodaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtroOrigine, setFiltroOrigine] = useState<FiltroOrigine>('tutti')
  const [codaPage, setCodaPage] = useState(1)
  const [codaPageSize, setCodaPageSize] = useState(25)
  const [codaTotal, setCodaTotal] = useState(0)
  const [codaConteggi, setCodaConteggi] = useState({
    tutti: 0,
    documenti_da_processare: 0,
    fattura: 0,
    errore_sincronizzazione: 0,
    bolla_aperta: 0,
    riga_statement: 0,
  })
  const [suggerimenti, setSuggerimenti] = useState<Map<string, AiSuggestion>>(new Map())
  const [eseguendoId, setEseguendoId] = useState<string | null>(null)
  const [resolvingStatementId, setResolvingStatementId] = useState<string | null>(null)
  const [cmdPaletteAperta, setCmdPaletteAperta] = useState(false)
  const [ricercaCmd, setRicercaCmd] = useState('')

  // ── Statement ────────────────────────────────────────────────────────────
  const [stmtAnomalieOpen, setStmtAnomalieOpen] = useState(false)
  const [stmtPendingOpen, setStmtPendingOpen] = useState(false)
  const [statementStats, setStatementStats] = useState<{
    total: number
    con_anomalie: number
    anomalie_totali: number
    righe_anomale: number
    fattura_mancante_count?: number
    pending_count: number
    pending_list: Array<{
      id: string
      file_name: string | null
      email_subject: string | null
      created_at: string
      fornitore_nome: string | null
    }>
    recenti: Array<{
      id: string
      file_url: string | null
      email_subject: string | null
      status: string
      total_rows: number
      missing_rows: number
      created_at: string
      fornitore_nome: string | null
    }>
  } | null>(null)
  const [processingStatements, setProcessingStatements] = useState(false)
  const [processStmtResult, setProcessStmtResult] = useState<{
    processed: number
    skipped: number
    errors: string[]
    message: string
  } | null>(null)

  // ── Reprocess triple-check ────────────────────────────────────────────────
  const [reprocessingChecks, setReprocessingChecks] = useState(false)
  const [reprocessChecksResult, setReprocessChecksResult] = useState<string | null>(null)
  const [autoResolving, setAutoResolving] = useState(false)
  const [autoRisolviElapsed, setAutoRisolviElapsed] = useState(0)
  const [autoRisolviOffset, setAutoRisolviOffset] = useState(0)
  const [autoRisolviTotal, setAutoRisolviTotal] = useState<number | null>(null)
  const [autoRisolviResults, setAutoRisolviResults] = useState<Array<{
    fornitoreId: string | null
    fornitoreNome: string | null
    righeOk: number
    righeAnomale: number
  }>>([])
  const [autoRisolviSummary, setAutoRisolviSummary] = useState<{
    fastFixed: number
    falseErrorsOk: number
    remainingAnomalies: number
    resolved: number
  } | null>(null)
  const autoRisolviTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoRisolviRanRef = useRef(false)

  // ── Pipeline AI (Analisi → Ricerca email → Associazione) ────────────────
  type PipelinePhase = 'idle' | 'analisi' | 'ricerca' | 'associazione' | 'done'
  type PipelineFornitore = {
    fornitoreId: string
    fornitoreNome: string | null
    // Fase 1 — Analisi
    analisi?: {
      fatturaMancante: number
      bolleMancanti: number
      erroreImporto: number
      rekkiDiscordanza: number
      total: number
      hasEmail: boolean
    }
    // Fase 2 — Ricerca email
    ricerca?: { imported: number; ok: boolean; error?: string }
    // Fase 3 — Associazione
    assoc?: { resolved: number; remaining: number }
  }
  const [pipelinePhase, setPipelinePhase] = useState<PipelinePhase>('idle')
  const [pipelineActive, setPipelineActive] = useState(false)
  const [pipelineElapsed, setPipelineElapsed] = useState(0)
  const [pipelineFornitori, setPipelineFornitori] = useState<PipelineFornitore[]>([])
  const [pipelineCurrentFornitore, setPipelineCurrentFornitore] = useState<string | null>(null)
  const [pipelineFastFixed, setPipelineFastFixed] = useState(0)
  const [pipelineSummary, setPipelineSummary] = useState<{
    totalFornitori: number
    totalResolved: number
    remaining: number
  } | null>(null)
  const pipelineTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── AI cerca fatture mancanti ────────────────────────────────────────────
  type AiScanChunkResult = {
    fornitoreId: string
    fornitoreNome: string | null
    fattureMancanti: number
    ricevuti: number
    bozzeCreate: number
    attachmentsProcessed: number
    ok: boolean
    error?: string
  }
  const [aiScanActive, setAiScanActive] = useState(false)
  const [aiScanOffset, setAiScanOffset] = useState(0)
  const [aiScanTotal, setAiScanTotal] = useState<number | null>(null)
  const [aiScanResults, setAiScanResults] = useState<AiScanChunkResult[]>([])
  const [aiScanSummary, setAiScanSummary] = useState<{
    initialAnomalies: number
    remainingAnomalies: number
    resolved: number
    fornitoriFailed: string[]
  } | null>(null)
  const [aiScanElapsed, setAiScanElapsed] = useState(0)
  const aiScanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Monitoraggio sistema ─────────────────────────────────────────────────
  const [sysMonitor, setSysMonitor] = useState<{
    lastCleanupAt: string | null
    lastCleanupProcessed: number | null
    lastCleanupScanned: number | null
    lastCycleErrors: string[]
    documentsAutoProcessedToday: number
    scopeSedeId: string | null
  } | null>(null)
  const [sysMonitorLoading, setSysMonitorLoading] = useState(false)
  const [forceCleanupLoading, setForceCleanupLoading] = useState(false)

  // ── Sync storica ─────────────────────────────────────────────────────────
  const [historicSyncLoading, setHistoricSyncLoading] = useState(false)
  const [historicSyncError, setHistoricSyncError] = useState<string | null>(null)
  const [historicSyncResult, setHistoricSyncResult] = useState<string | null>(null)
  const [historicProgressLine, setHistoricProgressLine] = useState<string | null>(null)

  // ── Duplicati ────────────────────────────────────────────────────────────

  type DialogType = 'associa' | 'categoria' | 'rifiuta_fattura' | 'assegna_fattura'
  const [dialogAperto, setDialogAperto] = useState<{
    tipo: DialogType
    item: CodaItem
    commandId: CommandId
  } | null>(null)

  // ── Caricamento coda ─────────────────────────────────────────────────────
  const caricaCoda = useCallback(async (pageOverride?: number) => {
    const page = pageOverride ?? codaPage
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (sedeId) params.set('sede_id', sedeId)
      if (filtroOrigine !== 'tutti') params.set('origine', filtroOrigine)
      params.set('limit', String(codaPageSize))
      params.set('offset', String((page - 1) * codaPageSize))
      const res = await fetch(`/api/centro-controllo/coda?${params}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Errore ${res.status}`)
      }
      const data = await res.json() as {
        items?: CodaItem[]
        total?: number
        conteggi?: {
          totale: number
          documenti_da_processare: number
          fatture_pending: number
          errori_sincronizzazione: number
          bolle_aperte: number
          righe_statement: number
        }
      }
      const queueItems = data.items || []
      const total = data.total ?? queueItems.length
      const maxPage = Math.max(1, Math.ceil(total / codaPageSize))
      if (page > maxPage) {
        if (pageOverride == null) setCodaPage(maxPage)
        return
      }
      if (pageOverride != null) setCodaPage(pageOverride)
      setItems(queueItems)
      setCodaTotal(total)
      if (data.conteggi) {
        setCodaConteggi({
          tutti: data.conteggi.totale,
          documenti_da_processare: data.conteggi.documenti_da_processare,
          fattura: data.conteggi.fatture_pending,
          errore_sincronizzazione: data.conteggi.errori_sincronizzazione,
          bolla_aperta: data.conteggi.bolle_aperte,
          riga_statement: data.conteggi.righe_statement,
        })
      }

      const suggMap = new Map<string, AiSuggestion>()
      for (const item of queueItems) {
        const sugg = await suggerisciAzione(item)
        if (!sugg) continue
        suggMap.set(item.id, sugg)
      }
      setSuggerimenti(suggMap)

      let autoResolved = 0
      for (const item of queueItems) {
        const sugg = suggMap.get(item.id)
        if (!sugg?.autoEsegui || sugg.azione_id !== 'statement.segna_come_ok') continue
        const cmd = getComando(sugg.azione_id)
        if (!cmd) continue
        const result = await cmd.esegui({ item, sedeId })
        if (result.success) {
          await registraConfermaApprendimento(item, sugg.azione_id, true)
          autoResolved++
        }
      }
      if (autoResolved > 0) {
        showToast(`AI: ${autoResolved} righe estratto conto verificate automaticamente`, 'success')
        const reloadRes = await fetch(`/api/centro-controllo/coda?${params}`)
        if (reloadRes.ok) {
          const reloadData = await reloadRes.json()
          setItems(reloadData.items || [])
          setCodaTotal(reloadData.total ?? 0)
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t.strumentiCentroControllo.queueLoadError)
    } finally {
      setLoading(false)
    }
  }, [sedeId, filtroOrigine, codaPage, codaPageSize, showToast])

  // ── Caricamento statement ───────────────────────────────────────────────
  const caricaStatement = useCallback(async () => {
    if (!sedeId) return
    try {
      const res = await fetch(`/api/statements/recent?sede_id=${encodeURIComponent(sedeId)}`)
      if (res.ok) {
        const data = await res.json()
        setStatementStats(data)
      }
    } catch { /* non-critical */ }
  }, [sedeId])

  // ── AI cerca fatture mancanti ────────────────────────────────────────────
  const handleAiCercaFattureMancanti = useCallback(async () => {
    if (!sedeId) return
    setAiScanActive(true)
    setAiScanOffset(0)
    setAiScanTotal(null)
    setAiScanResults([])
    setAiScanSummary(null)
    setAiScanElapsed(0)
    const startMs = Date.now()
    if (aiScanTimerRef.current) clearInterval(aiScanTimerRef.current)
    aiScanTimerRef.current = setInterval(() => {
      setAiScanElapsed(Math.floor((Date.now() - startMs) / 1000))
    }, 1000)
    try {
      let currentOffset = 0
      for (;;) {
        const res = await fetch('/api/centro-controllo/ai-cerca-fatture-mancanti', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sede_id: sedeId, offset: currentOffset, chunk_size: 3 }),
        })
        const data = await res.json() as {
          done: boolean
          offset: number
          total: number
          results: AiScanChunkResult[]
          summary?: {
            initialAnomalies: number
            remainingAnomalies: number
            resolved: number
            fornitoriFailed: string[]
          }
          error?: string
        }
        if (!res.ok) {
          showToast(data.error ?? `Errore ${res.status}`, 'error')
          break
        }
        currentOffset = data.offset
        setAiScanOffset(currentOffset)
        setAiScanTotal(data.total)
        setAiScanResults((prev) => [...prev, ...data.results])
        if (data.done) {
          if (data.summary) setAiScanSummary(data.summary)
          await Promise.all([caricaCoda(1), caricaStatement()])
          break
        }
        await new Promise((r) => setTimeout(r, 1500))
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : t.common.networkError, 'error')
    } finally {
      if (aiScanTimerRef.current) { clearInterval(aiScanTimerRef.current); aiScanTimerRef.current = null }
      setAiScanActive(false)
    }
  }, [sedeId, caricaCoda, caricaStatement, showToast])

  // ── Pipeline AI (Analisi → Ricerca email → Associazione) ────────────────
  const handlePipeline = useCallback(async () => {
    if (!sedeId) return

    setPipelinePhase('idle')
    setPipelineActive(true)
    setPipelineFornitori([])
    setPipelineCurrentFornitore(null)
    setPipelineSummary(null)
    setPipelineFastFixed(0)
    setPipelineElapsed(0)

    pipelineTimerRef.current = setInterval(() => setPipelineElapsed((s) => s + 1), 1000)
    const stop = () => {
      if (pipelineTimerRef.current) { clearInterval(pipelineTimerRef.current); pipelineTimerRef.current = null }
    }

    try {
      /* ── Fase 1: Analisi ──────────────────────────────────────────── */
      setPipelinePhase('analisi')
      const analysiMap = new Map<string, PipelineFornitore>()
      let analisiOffset = 0
      let analisiDone = false

      while (!analisiDone) {
        const res = await fetch('/api/centro-controllo/analisi-anomalie', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sede_id: sedeId, offset: analisiOffset, chunk_size: 8 }),
        })
        if (!res.ok) throw new Error(`Analisi HTTP ${res.status}`)
        const data = await res.json() as {
          done: boolean; offset: number; total: number
          results: { fornitoreId: string; fornitoreNome: string | null; fatturaMancante: number; bolleMancanti: number; erroreImporto: number; rekkiDiscordanza: number; pending: number; total: number; hasEmail: boolean }[]
        }

        for (const r of data.results) {
          const entry: PipelineFornitore = {
            fornitoreId: r.fornitoreId,
            fornitoreNome: r.fornitoreNome,
            analisi: {
              fatturaMancante: r.fatturaMancante,
              bolleMancanti: r.bolleMancanti,
              erroreImporto: r.erroreImporto,
              rekkiDiscordanza: r.rekkiDiscordanza,
              total: r.total,
              hasEmail: r.hasEmail,
            },
          }
          analysiMap.set(r.fornitoreId, entry)
          setPipelineCurrentFornitore(r.fornitoreNome)
          setPipelineFornitori([...analysiMap.values()])
        }

        analisiDone = data.done
        analisiOffset = data.offset
      }

      /* ── Fase 2: Ricerca email ────────────────────────────────────── */
      setPipelinePhase('ricerca')
      const emailFornitori = [...analysiMap.values()].filter(
        (f) => (f.analisi?.fatturaMancante ?? 0) > 0 && f.analisi?.hasEmail,
      )

      if (emailFornitori.length > 0) {
        let emailOffset = 0
        let emailDone = false
        while (!emailDone) {
          const res = await fetch('/api/centro-controllo/ai-cerca-fatture-mancanti', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sede_id: sedeId, offset: emailOffset, chunk_size: 2 }),
          })
          if (!res.ok) throw new Error(`Ricerca email HTTP ${res.status}`)
          const data = await res.json() as {
            done: boolean; offset: number; total: number
            results: { fornitoreId: string; fornitoreNome: string | null; ok: boolean; bozzeCreate: number; error?: string }[]
          }

          for (const r of data.results) {
            const entry = analysiMap.get(r.fornitoreId)
            if (entry) {
              entry.ricerca = { imported: r.bozzeCreate, ok: r.ok, error: r.error }
              setPipelineCurrentFornitore(r.fornitoreNome)
              setPipelineFornitori([...analysiMap.values()])
            }
          }

          emailDone = data.done
          emailOffset = data.offset
        }
      }

      /* ── Fase 3: Associazione (triple-check + chiudi risolte) ─────── */
      setPipelinePhase('associazione')
      let assocOffset = 0
      let assocDone = false
      let totalResolved = 0
      let fastFixed = 0
      let remainingAnomalies = 0

      while (!assocDone) {
        const res = await fetch('/api/centro-controllo/auto-risolvi-per-fornitore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sede_id: sedeId, offset: assocOffset, chunk_size: 4 }),
        })
        if (!res.ok) throw new Error(`Associazione HTTP ${res.status}`)
        const data = await res.json() as {
          done: boolean; offset: number; total: number
          fastFixed?: number
          results: { fornitoreId: string | null; fornitoreNome: string | null; statementsProcessed: number; righeOk: number; righeAnomale: number }[]
          falseErrorsOk?: number
          remainingAnomalies?: number
        }

        if (data.fastFixed) fastFixed += data.fastFixed
        if (data.remainingAnomalies != null) remainingAnomalies = data.remainingAnomalies

        for (const r of data.results) {
          totalResolved += r.righeOk
          const entry = analysiMap.get(r.fornitoreId ?? '')
          if (entry) {
            entry.assoc = { resolved: r.righeOk, remaining: r.righeAnomale }
            setPipelineCurrentFornitore(r.fornitoreNome)
            setPipelineFornitori([...analysiMap.values()])
          }
        }

        assocDone = data.done
        assocOffset = data.offset
      }

      setPipelineFastFixed(fastFixed)
      setPipelineSummary({
        totalFornitori: analysiMap.size,
        totalResolved: totalResolved + fastFixed,
        remaining: remainingAnomalies,
      })
      setPipelinePhase('done')
      await caricaStatement()
      await caricaCoda()
    } catch (err) {
      showToast(err instanceof Error ? err.message : t.strumentiCentroControllo.pipelineError, 'error')
      setPipelinePhase('idle')
    } finally {
      stop()
      setPipelineActive(false)
      setPipelineCurrentFornitore(null)
    }
  }, [sedeId, caricaCoda, caricaStatement, showToast])

  // ── Elaborazione statement ──────────────────────────────────────────────
  const handleProcessaStatement = async () => {
    if (!sedeId) return
    setProcessingStatements(true)
    setProcessStmtResult(null)
    try {
      const res = await fetch('/api/process-pending-statements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sede_id: sedeId }),
      })
      const data = await res.json()
      if (res.ok) {
        setProcessStmtResult({
          processed: data.processed ?? 0,
          skipped: data.skipped ?? 0,
          errors: data.errors ?? [],
          message: data.message ?? 'Operazione completata.',
        })
      } else {
        setProcessStmtResult({
          processed: 0,
          skipped: 0,
          errors: [data.error || data.message || `Errore ${res.status}`],
          message: 'Errore durante l\'elaborazione.',
        })
      }
      await caricaStatement()
    } catch (e) {
      setProcessStmtResult({
        processed: 0,
        skipped: 0,
        errors: [e instanceof Error ? e.message : t.strumentiCentroControllo.requestFailed],
        message: 'Errore di rete.',
      })
    } finally {
      setProcessingStatements(false)
    }
  }

  // ── Auto-risolvi statement (triple-check per fornitore) ──────────────────
  const handleAutoRisolvi = useCallback(async (silent = false) => {
    if (!sedeId) return
    setAutoResolving(true)
    setAutoRisolviElapsed(0)
    setAutoRisolviOffset(0)
    setAutoRisolviTotal(null)
    setAutoRisolviResults([])
    setAutoRisolviSummary(null)
    const startMs = Date.now()
    if (autoRisolviTimerRef.current) clearInterval(autoRisolviTimerRef.current)
    autoRisolviTimerRef.current = setInterval(() => {
      setAutoRisolviElapsed(Math.floor((Date.now() - startMs) / 1000))
    }, 1000)
    try {
      let currentOffset = 0
      for (;;) {
        const res = await fetch('/api/centro-controllo/auto-risolvi-per-fornitore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sede_id: sedeId, offset: currentOffset, chunk_size: 4 }),
        })
        const data = await res.json() as {
          done: boolean
          offset: number
          total: number
          fastFixed?: number
          results: Array<{ fornitoreId: string | null; fornitoreNome: string | null; righeOk: number; righeAnomale: number }>
          falseErrorsOk?: number
          initialAnomalies?: number
          remainingAnomalies?: number
          error?: string
        }
        if (!res.ok) {
          if (!silent) showToast(data.error ?? `Errore ${res.status}`, 'error')
          break
        }
        currentOffset = data.offset
        setAutoRisolviOffset(currentOffset)
        setAutoRisolviTotal(data.total)
        setAutoRisolviResults((prev) => [...prev, ...data.results])
        if (data.done) {
          const resolved = Math.max(0, (data.initialAnomalies ?? 0) - (data.remainingAnomalies ?? 0))
          setAutoRisolviSummary({
            fastFixed: data.fastFixed ?? 0,
            falseErrorsOk: data.falseErrorsOk ?? 0,
            remainingAnomalies: data.remainingAnomalies ?? 0,
            resolved,
          })
          if (!silent && resolved > 0) {
            showToast(`✓ ${resolved} anomalie risolte`, 'success')
          }
          await Promise.all([caricaCoda(1), caricaStatement()])
          break
        }
        await new Promise((r) => setTimeout(r, 500))
      }
    } catch (e) {
      if (!silent) showToast(e instanceof Error ? e.message : t.common.networkError, 'error')
    } finally {
      if (autoRisolviTimerRef.current) { clearInterval(autoRisolviTimerRef.current); autoRisolviTimerRef.current = null }
      setAutoResolving(false)
    }
  }, [sedeId, caricaCoda, caricaStatement, showToast])

  // ── Reprocess triple-check su statement esistenti ─────────────────────
  const handleReprocessChecks = async () => {
    if (!sedeId) return
    setReprocessingChecks(true)
    setReprocessChecksResult(null)
    try {
      const res = await fetch('/api/reprocess-statement-checks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sede_id: sedeId, limit: 500 }),
      })
      const data = await res.json()
      if (res.ok) {
        setReprocessChecksResult(data.message)
        await caricaStatement()
      } else {
        setReprocessChecksResult(data.error || t.common.error)
      }
    } catch (e) {
      setReprocessChecksResult(e instanceof Error ? e.message : t.strumentiCentroControllo.requestFailed)
    } finally {
      setReprocessingChecks(false)
    }
  }

  // ── Monitoraggio sistema ────────────────────────────────────────────────
  const caricaMonitoraggio = useCallback(async () => {
    setSysMonitorLoading(true)
    try {
      const params = new URLSearchParams()
      if (sedeId) params.set('sede_id', sedeId)
      const res = await fetch(`/api/centro-operazioni/dashboard?${params}`, { cache: 'no-store' })
      if (res.ok) {
        const j = await res.json()
        setSysMonitor(j)
      } else {
        const j = await res.json().catch(() => ({}))
        setSysMonitor(null)
        if (res.status !== 403) {
          showToast((j as { error?: string }).error || `Errore monitoraggio (${res.status})`, 'error')
        }
      }
    } catch {
      setSysMonitor(null)
    } finally {
      setSysMonitorLoading(false)
    }
  }, [sedeId, showToast])

  const handleForceCleanup = async () => {
    setForceCleanupLoading(true)
    try {
      const res = await fetch('/api/centro-operazioni/force-cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sedeId ? { sede_id: sedeId } : {}),
      })
      const j = await res.json()
      if (res.ok) {
        showToast(`Cleanup: ${j.processed ?? 0} processati, ${j.scanned ?? 0} esaminati`, 'success')
        await Promise.all([caricaMonitoraggio(), caricaCoda()])
      } else {
        showToast(j.error || t.strumentiCentroControllo.cleanupError, 'error')
      }
    } catch (e) {
      showToast(`${t.common.error}: ${e instanceof Error ? e.message : t.strumentiCentroControllo.requestFailed}`, 'error')
    } finally {
      setForceCleanupLoading(false)
    }
  }

  // ── Sync storica ────────────────────────────────────────────────────────
  const handleHistoricSync = async () => {
    setHistoricSyncLoading(true)
    setHistoricSyncError(null)
    setHistoricSyncResult(null)
    setHistoricProgressLine(null)
    let cumulativeRicevuti = 0
    try {
      for (;;) {
        const res = await fetch('/api/scan-emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'historical',
            client_locale: typeof navigator !== 'undefined' && typeof navigator.language === 'string'
              ? navigator.language : undefined,
            ...(effectiveSedeId ? { user_sede_id: effectiveSedeId } : {}),
          }),
        })
        const j = await res.json() as { error?: string; done?: boolean; ricevuti?: number; progressLabel?: string }
        if (!res.ok) {
          setHistoricSyncError(j.error ?? `HTTP ${res.status}`)
          return
        }
        if (typeof j.done !== 'boolean') {
          setHistoricSyncError(t.strumentiCentroControllo.invalidHistoricSyncResponse)
          return
        }
        const r = typeof j.ricevuti === 'number' && Number.isFinite(j.ricevuti) ? j.ricevuti : 0
        cumulativeRicevuti += r
        const label = typeof j.progressLabel === 'string' ? j.progressLabel : ''
        if (!j.done && label) {
          setHistoricProgressLine(t.strumentiCentroControllo.historicProgressLabel.replace('{label}', label))
        } else {
          setHistoricProgressLine(null)
        }
        if (j.done === true) break
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }
      setHistoricProgressLine(null)
      setHistoricSyncResult(
        `${t.strumentiCentroControllo.historicCompletedTitle}\n${t.strumentiCentroControllo.historicCompletedDocs.replace(
          '{n}',
          String(cumulativeRicevuti),
        )}`,
      )
    } catch (e) {
      setHistoricSyncError(e instanceof Error ? e.message : t.strumentiCentroControllo.networkError)
    } finally {
      setHistoricSyncLoading(false)
    }
  }

  // ── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    caricaStatement()
    caricaMonitoraggio()
  }, [caricaStatement, caricaMonitoraggio])

  useEffect(() => {
    void caricaCoda()
  }, [caricaCoda])

  useEffect(() => {
    if (!sedeId || autoRisolviRanRef.current) return
    autoRisolviRanRef.current = true
    void handleAutoRisolvi(true)
  }, [sedeId, handleAutoRisolvi])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCmdPaletteAperta((v) => !v)
      }
      if (e.key === 'Escape') {
        setCmdPaletteAperta(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const cambiaFiltroOrigine = (filtro: FiltroOrigine) => {
    setFiltroOrigine(filtro)
    setCodaPage(1)
  }

  const codaPageCount = Math.max(1, Math.ceil(codaTotal / codaPageSize))
  const codaRangeFrom = codaTotal === 0 ? 0 : (codaPage - 1) * codaPageSize + 1
  const codaRangeTo = codaTotal === 0 ? 0 : Math.min(codaPage * codaPageSize, codaTotal)

  const conteggi = codaConteggi

  const codaDisplayEntries = useMemo(() => buildCodaDisplayEntries(items), [items])

  const handleResolveStatement = useCallback(
    async (statementId: string, fornitoreId: string, groupItems: CodaItem[]) => {
      if (!sedeId) return
      setResolvingStatementId(statementId)
      try {
        const fatturaMancante = groupItems.filter((i) => i.stato_origine === 'fattura_mancante').length
        const res = await fetch('/api/centro-controllo/pipeline-per-fornitore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sede_id: sedeId,
            fornitore_id: fornitoreId,
            statement_id: statementId,
            fattura_mancante_count: fatturaMancante,
            skip_email_scan: false,
          }),
        })
        const data = await res.json() as {
          error?: string
          assoc?: { resolved?: number; remaining?: number }
          ricerca?: { imported?: number; ok?: boolean; error?: string } | null
        }
        if (!res.ok) {
          showToast(data.error ?? t.strumentiCentroControllo.queueStatementGroupResolveError, 'error')
          return
        }
        const resolved = data.assoc?.resolved ?? 0
        const remaining = data.assoc?.remaining ?? 0
        const imported = data.ricerca?.imported ?? 0

        const tc = t.strumentiCentroControllo
        if (remaining === 0 && resolved > 0) {
          showToast(
            interpolateTemplate(
              tc.queueStatementGroupResolveAllDone,
              { n: resolved },
              `${resolved} rows resolved`,
            ),
            'success',
          )
        } else if (remaining > 0) {
          let msg = interpolateTemplate(
            tc.queueStatementGroupResolvePartial,
            { resolved, remaining },
            `Done: ${resolved} resolved, ${remaining} still in queue`,
          )
          if (imported > 0) {
            msg += ` ${interpolateTemplate(
              tc.queueStatementGroupResolveImported,
              { n: imported },
              `Imported ${imported} from email`,
            )}`
          }
          showToast(msg, 'info')
        } else if (resolved === 0 && remaining === 0) {
          showToast(tc.statementPipelineNoResolvable ?? 'No rows to resolve', 'info')
        }

        if (data.ricerca?.error) {
          showToast(data.ricerca.error, 'error')
        }

        await caricaCoda()
        return { remaining }
      } catch (e) {
        showToast(
          e instanceof Error ? e.message : t.strumentiCentroControllo.queueStatementGroupResolveError,
          'error',
        )
      } finally {
        setResolvingStatementId(null)
      }
    },
    [sedeId, caricaCoda, showToast, t],
  )

  const eseguiComando = async (item: CodaItem, commandId: CommandId) => {
    const dialogCommands: Record<string, DialogType> = {
      'documento.associa': 'associa',
      'documento.aggiorna_categoria': 'categoria',
      'fattura.rifiuta': 'rifiuta_fattura',
      'statement.assegna_fattura': 'assegna_fattura',
      'statement.associa_fornitore': 'associa',
    }
    const dialogTipo = dialogCommands[commandId]
    if (dialogTipo) {
      setDialogAperto({ tipo: dialogTipo, item, commandId })
      return
    }

    setEseguendoId(`${item.id}_${commandId}`)
    try {
      const cmd = getComando(commandId)
      if (!cmd) {
        showToast('Comando non trovato: ' + commandId, 'error')
        return
      }
      const result = await cmd.esegui({ item, sedeId })
      if (result.success) {
        await registraEsecuzioneDiretta(item, commandId)
        showToast(result.message || t.appShellActions.operazioneCompletata, 'success')
        caricaCoda()
      } else {
        showToast(result.error || t.common.unknownError, 'error')
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : t.common.unknownError, 'error')
    } finally {
      setEseguendoId(null)
    }
  }

  const confermaSuggerimento = async (item: CodaItem, commandId: CommandId) => {
    const ok = await registraConfermaApprendimento(item, commandId, true)
    if (ok) {
      await eseguiComando(item, commandId)
    }
  }

  const rifiutaSuggerimento = async (item: CodaItem, commandId: CommandId) => {
    await registraConfermaApprendimento(item, commandId, false)
    setSuggerimenti((prev) => {
      const next = new Map(prev)
      next.delete(item.id)
      return next
    })
  }

  const handleDialogSuccess = async (message: string, itemId?: string) => {
    const pending = dialogAperto
    const isError = message.toLowerCase().startsWith('errore')
    setDialogAperto(null)

    if (isError) {
      showToast(message, 'error')
      return
    }

    if (pending) {
      await registraEsecuzioneDiretta(pending.item, pending.commandId)
    }
    showToast(message, 'success')
    if (itemId) {
      setItems((prev) => prev.filter((i) => i.id !== itemId))
    }
    caricaCoda()
  }

  function formatAgo(iso: string | null): string {
    if (!iso) return '—'
    const d = new Date(iso).getTime()
    if (Number.isNaN(d)) return '—'
    const m = Math.max(0, Math.floor((Date.now() - d) / 60000))
    if (m < 1) return t.strumentiCentroControllo.timeLessThanMinute
    if (m === 1) return t.strumentiCentroControllo.timeOneMinute
    if (m < 60) return t.strumentiCentroControllo.timeMinutes.replace('{n}', String(m))
    const h = Math.floor(m / 60)
    if (h === 1) return t.strumentiCentroControllo.timeAboutOneHour
    if (h < 48) return t.strumentiCentroControllo.timeAboutHours.replace('{n}', String(h))
    const dd = Math.floor(h / 24)
    return t.strumentiCentroControllo.timeAboutDays.replace('{n}', String(dd))
  }

  return (
    <div className="space-y-6 pb-6">
      {/* ── Stat cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          label={t.strumentiCentroControllo.statTotal}
          valore={conteggi.tutti}
          icona={<AlertCircle className="w-5 h-5" />}
          colore="text-app-fg-muted"
          attivo={filtroOrigine === 'tutti'}
          onClick={() => cambiaFiltroOrigine('tutti')}
        />
        <StatCard
          label={t.strumentiCentroControllo.statDocuments}
          valore={conteggi.documenti_da_processare}
          icona={<FileText className="w-5 h-5" />}
          colore="text-sky-400"
          attivo={filtroOrigine === 'documento_da_processare'}
          onClick={() => cambiaFiltroOrigine('documento_da_processare')}
        />
        <StatCard
          label={t.strumentiCentroControllo.statInvoices}
          valore={conteggi.fattura}
          icona={<CheckCircle className="w-5 h-5" />}
          colore="text-emerald-400"
          attivo={filtroOrigine === 'fattura'}
          onClick={() => cambiaFiltroOrigine('fattura')}
        />
        <StatCard
          label={t.strumentiCentroControllo.statOpenNotes}
          valore={conteggi.bolla_aperta}
          icona={<ExternalLink className="w-5 h-5" />}
          colore="text-amber-400"
          attivo={filtroOrigine === 'bolla_aperta'}
          onClick={() => cambiaFiltroOrigine('bolla_aperta')}
        />
        <StatCard
          label={t.strumentiCentroControllo.statStatement}
          valore={conteggi.riga_statement}
          icona={<FileText className="w-5 h-5" />}
          colore="text-purple-400"
          attivo={filtroOrigine === 'riga_statement'}
          onClick={() => cambiaFiltroOrigine('riga_statement')}
        />
        <StatCard
          label={t.strumentiCentroControllo.statSyncErrors}
          valore={conteggi.errore_sincronizzazione}
          icona={<X className="w-5 h-5" />}
          colore="text-rose-400"
          attivo={filtroOrigine === 'errore_sincronizzazione'}
          onClick={() => cambiaFiltroOrigine('errore_sincronizzazione')}
        />
      </div>

      {/* ── Layout 2-colonne ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr] xl:gap-8">

        {/* ════════════════════════════════════════════════════════════════════
            COLONNA 1: MONITORAGGIO & STATO
           ════════════════════════════════════════════════════════════════════ */}
        <div className="flex min-w-0 flex-col gap-6">
          <SectionCard
            title={t.strumentiCentroControllo.sectionMonitoring}
            badge={sysMonitor?.documentsAutoProcessedToday != null ? `${sysMonitor.documentsAutoProcessedToday} ${t.strumentiCentroControllo.badgeToday}` : null}
            action={
              <button
                type="button"
                onClick={caricaMonitoraggio}
                disabled={sysMonitorLoading}
                className="inline-flex items-center gap-1 rounded-lg bg-app-line-15 px-2 py-1 text-[11px] font-medium text-app-fg-muted transition-colors hover:bg-app-line-25 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${sysMonitorLoading ? 'animate-spin' : ''}`} />
              </button>
            }
          >
            {sysMonitorLoading && !sysMonitor ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-4 h-4 animate-spin text-app-fg-muted" />
              </div>
            ) : sysMonitor ? (
              <div className="divide-y divide-app-line-10">
                <div className="px-4 py-2.5 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-app-fg-muted">{t.strumentiCentroControllo.monLastCleanup}</span>
                    <span className="font-medium text-app-fg text-right">{formatAgo(sysMonitor.lastCleanupAt)}</span>
                  </div>
                  {sysMonitor.lastCleanupAt && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-app-fg-muted">{t.strumentiCentroControllo.monExactDate}</span>
                      <span className="text-app-fg-muted/70">{new Date(sysMonitor.lastCleanupAt).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-app-fg-muted">{t.strumentiCentroControllo.monLastCycle}</span>
                    <span className="font-medium text-app-fg">
                      {sysMonitor.lastCleanupProcessed != null ? `${sysMonitor.lastCleanupProcessed} ${t.strumentiCentroControllo.monProcessed}` : '—'}
                      {sysMonitor.lastCleanupScanned != null ? ` / ${sysMonitor.lastCleanupScanned} ${t.strumentiCentroControllo.monScanned}` : ''}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-app-fg-muted">{t.strumentiCentroControllo.monAutoProcessedToday}</span>
                    <span className="font-medium text-emerald-400">{sysMonitor.documentsAutoProcessedToday}</span>
                  </div>
                </div>
                {sysMonitor.lastCycleErrors.length > 0 && (
                  <div className="px-4 py-2 text-[11px] text-rose-300/70 space-y-0.5 max-h-20 overflow-y-auto">
                    <p className="font-medium text-rose-300 mb-1">{t.strumentiCentroControllo.monLastCycleErrors}</p>
                    {sysMonitor.lastCycleErrors.map((e, i) => (
                      <p key={i} className="truncate">{e}</p>
                    ))}
                  </div>
                )}
                <div className="px-4 py-2.5">
                  <button
                    type="button"
                    onClick={handleForceCleanup}
                    disabled={forceCleanupLoading}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-200 transition-colors hover:bg-cyan-500/18 disabled:opacity-50"
                  >
                    {forceCleanupLoading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Zap className="w-3 h-3" />
                    )}
                    {t.strumentiCentroControllo.monForceCleanup}
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-4 py-4 text-xs text-app-fg-muted text-center">{t.strumentiCentroControllo.monNoData}</div>
            )}
          </SectionCard>

          {/* ── Coda documenti ── */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-app-fg-muted" />
              <span className="ml-2 text-sm text-app-fg-muted">{t.strumentiCentroControllo.queueLoading}</span>
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-950/30 border border-rose-800/40 rounded-lg text-rose-300 text-sm">
              {error}
              <button onClick={() => caricaCoda()} className="ml-2 underline hover:no-underline">{t.strumentiCentroControllo.queueRetry}</button>
            </div>
          )}

          {!loading && !error && codaTotal === 0 && (
            <SectionCard title={t.strumentiCentroControllo.queueTitle}>
              <div className="text-center py-8 text-app-fg-muted">
                <CheckCircle className="w-10 h-10 mx-auto mb-2 text-white/[0.12]" />
                <p className="text-sm font-medium">{t.strumentiCentroControllo.queueEmpty}</p>
                <p className="text-xs">{t.strumentiCentroControllo.queueEmptyHint}</p>
              </div>
            </SectionCard>
          )}

          {!loading && !error && codaTotal > 0 && (
            <SectionCard title={t.strumentiCentroControllo.queueTitle} badge={codaTotal}>
              <div className="max-h-[min(70vh,42rem)] overflow-y-auto overscroll-contain divide-y divide-app-line-10">
                {codaDisplayEntries.map((entry) =>
                  entry.type === 'statement_group' ? (
                    <StatementGruppoCoda
                      key={`stmt-${entry.statementId}`}
                      statementId={entry.statementId}
                      items={entry.items}
                      sedeId={sedeId}
                      suggerimenti={suggerimenti}
                      eseguendoId={eseguendoId}
                      resolving={resolvingStatementId === entry.statementId}
                      onEsegui={eseguiComando}
                      onConfermaSuggerimento={confermaSuggerimento}
                      onRifiutaSuggerimento={rifiutaSuggerimento}
                      onApriAzioni={(item) => openActions(item)}
                      onResolveStatement={handleResolveStatement}
                      RigaDocumento={RigaDocumento}
                    />
                  ) : (
                    <RigaDocumento
                      key={entry.item.id}
                      item={entry.item}
                      sedeId={sedeId}
                      suggerimento={suggerimenti.get(entry.item.id) ?? null}
                      eseguendoId={eseguendoId}
                      onEsegui={eseguiComando}
                      onConfermaSuggerimento={confermaSuggerimento}
                      onRifiutaSuggerimento={rifiutaSuggerimento}
                      onApriAzioni={(item) => openActions(item)}
                    />
                  ),
                )}
              </div>
              <div className="flex flex-col gap-3 border-t border-app-line-10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[11px] text-app-fg-muted">
                  {t.strumentiCentroControllo.queueShowing
                    .replace('{from}', String(codaRangeFrom))
                    .replace('{to}', String(codaRangeTo))
                    .replace('{total}', String(codaTotal))}
                  {filtroOrigine !== 'tutti' ? ` ${t.strumentiCentroControllo.queueFilterActive}` : ''}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1.5 text-[11px] text-app-fg-muted">
                    {t.strumentiCentroControllo.queuePerPage}
                    <select
                      value={codaPageSize}
                      onChange={(e) => {
                        setCodaPageSize(Number(e.target.value))
                        setCodaPage(1)
                      }}
                      className="rounded-md border border-app-line-25 bg-black/20 px-2 py-1 text-[11px] text-app-fg"
                    >
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={codaPage <= 1 || loading}
                    onClick={() => setCodaPage((p) => Math.max(1, p - 1))}
                    className="rounded-md border border-app-line-25 px-2.5 py-1 text-[11px] font-semibold text-app-fg transition-colors hover:bg-white/5 disabled:opacity-40"
                  >
                    {t.strumentiCentroControllo.queuePrev}
                  </button>
                  <span className="text-[11px] tabular-nums text-app-fg-muted">
                    {codaPage} / {codaPageCount}
                  </span>
                  <button
                    type="button"
                    disabled={codaPage >= codaPageCount || loading}
                    onClick={() => setCodaPage((p) => Math.min(codaPageCount, p + 1))}
                    className="rounded-md border border-app-line-25 px-2.5 py-1 text-[11px] font-semibold text-app-fg transition-colors hover:bg-white/5 disabled:opacity-40"
                  >
                    {t.strumentiCentroControllo.queueNext}
                  </button>
                </div>
              </div>
            </SectionCard>
          )}
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            COLONNA 2: STRUMENTI OPERATIVI
           ════════════════════════════════════════════════════════════════════ */}
        <div className="flex min-w-0 flex-col gap-6">
          {/* ── Statement ── */}
          {statementStats && (
            <SectionCard
              title={t.strumentiCentroControllo.statStatement}
              badge={statementStats.total}
              action={
                <a
                  href="/statements/da-processare"
                  className="inline-flex items-center gap-1 rounded-lg bg-app-line-15 px-2.5 py-1 text-[11px] font-medium text-app-fg-muted transition-colors hover:bg-app-line-25"
                >
                  <ExternalLink className="w-3 h-3" />
                  {t.strumentiCentroControllo.statementSeeAll}
                </a>
              }
            >
              <div className="divide-y divide-app-line-10">
                <div className="px-4 py-3">
                  {statementStats.pending_count === 0 ? (
                    <div className="space-y-2">
                      {(statementStats.righe_anomale ?? 0) > 0 || statementStats.con_anomalie > 0 ? (
                        <>
                          <div className="flex items-center gap-2 text-xs text-amber-200/90">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                            <span>
                              <strong className="font-semibold text-app-fg">{statementStats.righe_anomale ?? statementStats.anomalie_totali}</strong>
                              {' '}{t.strumentiCentroControllo.statementRowsWithAnomalies}
                              {statementStats.con_anomalie > 0 ? (
                                <span className="text-app-fg-muted"> · {statementStats.con_anomalie} {t.strumentiCentroControllo.statementsWord}</span>
                              ) : null}
                            </span>
                          </div>

                          {/* ── Automazione notturna attiva ── */}
                          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] px-3 py-2">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                              <svg className="h-3 w-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </span>
                            <p className="text-[11px] text-emerald-300/90">
                              <span className="font-semibold">{t.strumentiCentroControllo.statementAutoActive}</span>
                              <span className="text-app-fg-muted"> · {t.strumentiCentroControllo.statementAutoActiveDesc}</span>
                            </p>
                          </div>

                          {/* Opzioni avanzate: pipeline manuale + ricalcolo */}
                          <details className="group">
                            <summary className="cursor-pointer list-none text-[10px] text-app-fg-muted/60 hover:text-app-fg-muted transition-colors select-none flex items-center gap-1">
                              <svg className="w-2.5 h-2.5 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                              {t.strumentiCentroControllo.statementAdvancedOptions}
                            </summary>
                            <div className="mt-2 space-y-2 rounded-lg border border-app-line-20 bg-white/[0.025] px-3 py-2.5">
                              {/* Pipeline manuale */}
                              {(() => {
                                const isRunning = pipelineActive
                                const isDone = pipelinePhase === 'done'
                                return (
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                      <p className="text-[11px] font-semibold text-app-fg">{t.strumentiCentroControllo.statementPipelineTitle}</p>
                                      <p className="mt-0.5 text-[11px] leading-relaxed text-app-fg-muted">
                                        {t.strumentiCentroControllo.statementPipelineDesc}
                                      </p>
                                      {isRunning && pipelineCurrentFornitore && (
                                        <p className="mt-1 text-[10px] text-purple-200/70 truncate">
                                          <Loader2 className="w-2.5 h-2.5 animate-spin inline mr-1" />
                                          {t.strumentiCentroControllo.statementPipelineCurrent.replace('{name}', pipelineCurrentFornitore)}
                                        </p>
                                      )}
                                      {isDone && pipelineSummary && (
                                        <p className={`mt-1 text-[11px] ${pipelineSummary.totalResolved > 0 ? 'text-emerald-300' : 'text-amber-200/80'}`}>
                                          {pipelineSummary.totalResolved > 0
                                            ? t.strumentiCentroControllo.statementPipelineResolved.replace('{n}', String(pipelineSummary.totalResolved))
                                            : t.strumentiCentroControllo.statementPipelineNoResolvable}
                                          {pipelineSummary.remaining > 0 && (
                                            <span className="text-amber-300"> · {t.strumentiCentroControllo.statementPipelineRemaining.replace('{n}', String(pipelineSummary.remaining))}</span>
                                          )}
                                        </p>
                                      )}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => void handlePipeline()}
                                      disabled={isRunning || !sedeId}
                                      className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-purple-500/40 bg-purple-500/10 px-3 py-1.5 text-[11px] font-semibold text-purple-200 transition-colors hover:bg-purple-500/18 disabled:opacity-50"
                                    >
                                      {isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : isDone ? <RefreshCw className="w-3 h-3" /> : <ScanLine className="w-3 h-3" />}
                                      {isRunning ? t.strumentiCentroControllo.statementPipelineInProgress : isDone ? t.strumentiCentroControllo.statementPipelineRerun : t.strumentiCentroControllo.statementPipelineStart}
                                    </button>
                                  </div>
                                )
                              })()}

                              <div className="border-t border-app-line-10 pt-2">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[11px] font-semibold text-app-fg">{t.strumentiCentroControllo.statementRecalcTitle}</p>
                                    <p className="mt-0.5 text-[11px] leading-relaxed text-app-fg-muted">
                                      {t.strumentiCentroControllo.statementRecalcDesc}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={handleReprocessChecks}
                                    disabled={reprocessingChecks}
                                    className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold text-amber-200 transition-colors hover:bg-amber-500/18 disabled:opacity-50"
                                  >
                                    {reprocessingChecks ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                                    {reprocessingChecks ? t.strumentiCentroControllo.statementRecalcInProgress : t.strumentiCentroControllo.statementRecalcRun}
                                  </button>
                                </div>
                                {reprocessChecksResult && (
                                  <p className="mt-1 text-[11px] leading-relaxed text-emerald-300">{reprocessChecksResult}</p>
                                )}
                              </div>
                            </div>
                          </details>
                        </>
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-app-fg-muted">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                          {t.strumentiCentroControllo.statementNoneInQueue}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleProcessaStatement}
                          disabled={processingStatements}
                          className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-purple-500 disabled:opacity-50"
                        >
                          {processingStatements ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Zap className="w-3.5 h-3.5" />
                          )}
                          {processingStatements
                            ? t.strumentiCentroControllo.statementProcessing.replace('{n}', String(statementStats.pending_list.length))
                            : t.strumentiCentroControllo.statementProcessPending}
                          {!processingStatements && statementStats.pending_count > 0 && (
                            <span className="inline-flex items-center rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-bold">
                              {statementStats.pending_count}
                            </span>
                          )}
                        </button>
                        {!processingStatements && statementStats.pending_list.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setStmtPendingOpen(!stmtPendingOpen)}
                            className="text-[11px] font-medium text-app-fg-muted underline decoration-app-line-15 underline-offset-2 hover:text-app-fg transition-colors"
                          >
                            {stmtPendingOpen ? t.strumentiCentroControllo.statementHideList : t.strumentiCentroControllo.statementSeeFiles.replace('{n}', String(statementStats.pending_list.length))}
                          </button>
                        )}
                      </div>
                      {processingStatements && (
                        <p className="text-xs text-purple-300/70 animate-pulse">
                          {t.strumentiCentroControllo.statementProcessingMsg.replace('{n}', String(statementStats.pending_list.length))}
                        </p>
                      )}
                      {stmtPendingOpen && !processingStatements && (
                        <div className="max-h-40 divide-y divide-app-line-10 overflow-y-auto rounded-lg border border-app-line-15 bg-app-line-5/50">
                          {statementStats.pending_list.slice(0, 20).map((p) => (
                            <div key={p.id} className="flex items-center gap-2 px-3 py-1.5 text-[11px]">
                              <FileText className="w-3 h-3 shrink-0 text-purple-400" />
                              <span className="truncate text-app-fg">{p.file_name ?? p.email_subject ?? '—'}</span>
                              {p.fornitore_nome && (
                                <span className="shrink-0 text-app-fg-muted">{p.fornitore_nome}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {processStmtResult && (
                  <div className="px-4 py-2.5 text-xs space-y-1">
                    <div className="flex items-center gap-4">
                      <span className="text-emerald-400 font-medium">{t.strumentiCentroControllo.statementProcessed.replace('{n}', String(processStmtResult.processed))}</span>
                      <span className="text-slate-400">{t.strumentiCentroControllo.statementSkipped.replace('{n}', String(processStmtResult.skipped))}</span>
                      {processStmtResult.errors.length > 0 && (
                        <span className="text-rose-400">{t.strumentiCentroControllo.statementErrors.replace('{n}', String(processStmtResult.errors.length))}</span>
                      )}
                    </div>
                    {processStmtResult.errors.length > 0 && (
                      <div className="max-h-20 overflow-y-auto space-y-0.5">
                        {processStmtResult.errors.map((e, i) => (
                          <p key={i} className="text-[11px] text-rose-300/70 truncate">{e}</p>
                        ))}
                      </div>
                    )}
                    <p className="text-app-fg-muted">{processStmtResult.message}</p>
                  </div>
                )}

                {statementStats.recenti.length > 0 && (
                  <>
                    <div className="px-4 py-1.5 text-[10px] font-semibold text-app-fg-muted uppercase tracking-wide bg-app-line-5">
                      {t.strumentiCentroControllo.statementRecentlyProcessed}
                    </div>
                    <div className="max-h-48 divide-y divide-app-line-10 overflow-y-auto">
                      {statementStats.recenti.slice(0, 8).map((s) => (
                        <div key={s.id} className="flex items-center gap-3 px-4 py-2 text-xs">
                          {s.missing_rows > 0 ? (
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-rose-500/20 text-[9px] font-bold text-rose-400">!</span>
                          ) : s.status === 'error' ? (
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-rose-500/20 text-[9px] font-bold text-rose-400">✗</span>
                          ) : (
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[9px] font-bold text-emerald-400">✓</span>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-app-fg">{s.fornitore_nome ?? t.strumentiCentroControllo.statementWithoutSupplier}</p>
                            <p className="truncate text-app-fg-muted">{s.email_subject ?? s.file_url?.split('/').pop() ?? '—'}</p>
                          </div>
                          <span className={`shrink-0 font-medium ${s.missing_rows > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {s.missing_rows > 0
                              ? t.strumentiCentroControllo.statementAnomaliesCount.replace('{missing}', String(s.missing_rows)).replace('{total}', String(s.total_rows))
                              : t.strumentiCentroControllo.statementRowsOk.replace('{n}', String(s.total_rows))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {statementStats.con_anomalie > 0 && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setStmtAnomalieOpen(!stmtAnomalieOpen)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-app-line-5"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-semibold ${stmtAnomalieOpen ? 'text-rose-300' : 'text-app-fg-muted'}`}>
                          {t.strumentiCentroControllo.statementWithAnomalies}
                        </span>
                        <span className="inline-flex items-center justify-center rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-300">{statementStats.con_anomalie}</span>
                        <span className="text-xs text-app-fg-muted">{t.strumentiCentroControllo.statementAnomaliesTotal.replace('{n}', String(statementStats.anomalie_totali))}</span>
                      </div>
                      <span className={`text-app-fg-muted transition-transform ${stmtAnomalieOpen ? 'rotate-180' : ''}`}>▾</span>
                    </button>
                    {stmtAnomalieOpen && (
                      <div className="border-t border-app-line-15">
                        {statementStats.recenti.filter(s => s.missing_rows > 0).slice(0, 8).map((s) => (
                          <div key={s.id} className="flex items-center gap-3 border-b border-app-line-10 px-4 py-2.5 text-xs last:border-0">
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-rose-500/20 text-[9px] font-bold text-rose-400">!</span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium text-app-fg">{s.fornitore_nome ?? t.strumentiCentroControllo.statementWithoutSupplier}</p>
                              <p className="truncate text-app-fg-muted">{s.email_subject ?? s.file_url?.split('/').pop() ?? '—'}</p>
                            </div>
                            <span className="inline-flex items-center rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-bold text-rose-300">{t.strumentiCentroControllo.statementAnomaliesCount.replace('{missing}', String(s.missing_rows)).replace('{total}', String(s.total_rows))}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          {/* ── Strumenti di Manutenzione Avanzata (collassabile) ── */}
          <details className="group">
            <summary className="flex cursor-pointer list-none select-none items-center gap-2 rounded-lg border border-app-line-25 bg-app-line-10 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-app-fg-muted transition-colors hover:bg-app-line-15 [&::-webkit-details-marker]:hidden">
              <ChevronRight className="h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-open:rotate-90" />
              {t.strumentiCentroControllo.advTools}
            </summary>
            <div className="mt-4 flex flex-col gap-4">

              <SectionCard title={t.strumentiCentroControllo.advOcrQuality}>
                <div className="px-4 py-3">
                  <AuditAndFixAllCard />
                </div>
              </SectionCard>

              <SectionCard title={t.strumentiCentroControllo.advSyncEmail}>
                <div className="divide-y divide-app-line-10">
                  <div className="px-4 py-3">
                    <p className="text-xs font-semibold text-app-fg">{t.strumentiCentroControllo.advHistoricSyncTitle}</p>
                    <p className="mt-1 text-xs text-app-fg-muted">
                      {t.strumentiCentroControllo.advHistoricSyncDesc}
                    </p>
                    <p className="mt-2 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-100/90">
                      {t.strumentiCentroControllo.advHistoricSyncWarning}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        disabled={historicSyncLoading}
                        onClick={handleHistoricSync}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/45 bg-violet-500/12 px-3 py-1.5 text-xs font-bold text-violet-100 transition-colors hover:bg-violet-500/18 disabled:opacity-50"
                      >
                        {historicSyncLoading ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Calendar className="w-3 h-3" />
                        )}
                        {t.strumentiCentroControllo.advHistoricSyncStart}
                      </button>
                      {historicSyncError && <span className="text-xs text-rose-300">{historicSyncError}</span>}
                    </div>
                    {historicProgressLine && (
                      <p className="mt-2 text-xs text-app-fg-muted">{historicProgressLine}</p>
                    )}
                    {historicSyncResult && (
                      <p className="mt-2 whitespace-pre-line text-xs text-emerald-200/90">{historicSyncResult}</p>
                    )}
                  </div>
                </div>
              </SectionCard>

              <SectionCard title={t.strumentiCentroControllo.advMaintenance}>
                <div className="divide-y divide-app-line-10">
                  <div className="px-4 py-3 flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-app-fg">{t.strumentiCentroControllo.advLearningTitle}</p>
                      <p className="text-xs text-app-fg-muted">{t.strumentiCentroControllo.advLearningDesc}</p>
                    </div>
                    <a
                      href="/strumenti/centro-controllo/apprendimento"
                      className="shrink-0 ml-3 inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-200 transition-colors hover:bg-cyan-500/18"
                    >
                      <Brain className="w-3 h-3" />
                      {t.strumentiCentroControllo.advOpenAction}
                    </a>
                  </div>
                </div>
              </SectionCard>

            </div>
          </details>
        </div>
      </div>

      {/* ── Modali e overlay ── */}

      {cmdPaletteAperta && (
        <CommandPalette
          items={items}
          ricerca={ricercaCmd}
          onRicercaChange={setRicercaCmd}
          onEsegui={(itemId, commandId) => {
            const item = items.find((i) => i.id === itemId)
            if (item) eseguiComando(item, commandId)
          }}
          onChiudi={() => {
            setCmdPaletteAperta(false)
            setRicercaCmd('')
          }}
        />
      )}

      <AssociaFornitoreDialog
        open={dialogAperto?.tipo === 'associa'}
        item={dialogAperto?.item ?? null}
        sedeId={sedeId}
        onClose={() => setDialogAperto(null)}
        onSuccess={handleDialogSuccess}
      />
      <AggiornaCategoriaDialog
        open={dialogAperto?.tipo === 'categoria'}
        item={dialogAperto?.item ?? null}
        onClose={() => setDialogAperto(null)}
        onSuccess={handleDialogSuccess}
      />
      <RifiutaFatturaDialog
        open={dialogAperto?.tipo === 'rifiuta_fattura'}
        item={dialogAperto?.item ?? null}
        onClose={() => setDialogAperto(null)}
        onSuccess={handleDialogSuccess}
      />
      <AssegnaFatturaDialog
        open={dialogAperto?.tipo === 'assegna_fattura'}
        item={dialogAperto?.item ?? null}
        sedeId={sedeId}
        onClose={() => setDialogAperto(null)}
        onSuccess={handleDialogSuccess}
      />

    </div>
  )
}

// ─── Componenti interni ─────────────────────────────────────────────────────

function StatCard({
  label,
  valore,
  icona,
  colore,
  attivo,
  onClick,
}: {
  label: string
  valore: number
  icona: React.ReactNode
  colore: string
  attivo: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`app-card overflow-hidden p-4 text-left transition-colors ${
        attivo
          ? 'ring-1 ring-sky-500/30 border-sky-600/40'
          : 'border-app-line-22 hover:border-app-line-28'
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className={colore}>{icona}</span>
        <p className="text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">{label}</p>
      </div>
      <p className={`text-2xl font-bold tabular-nums ${colore}`}>{valore}</p>
    </button>
  )
}

function RigaDocumento({
  item,
  sedeId,
  suggerimento,
  eseguendoId,
  onEsegui,
  onConfermaSuggerimento,
  onRifiutaSuggerimento,
  onApriAzioni,
  nested = false,
}: {
  item: CodaItem
  sedeId: string | null
  suggerimento: AiSuggestion | null
  eseguendoId: string | null
  onEsegui: (item: CodaItem, commandId: CommandId) => void
  onConfermaSuggerimento: (item: CodaItem, commandId: CommandId) => void
  onRifiutaSuggerimento: (item: CodaItem, commandId: CommandId) => void
  onApriAzioni?: (item: CodaItem) => void
  nested?: boolean
}) {
  const t = useT()
  const { locale, timezone } = useLocale()
  const priorita = formattaPriorita(item.priorita, {
    priorityCritical: t.strumentiCentroControllo.priorityCritical,
    priorityHigh: t.strumentiCentroControllo.priorityHigh,
    priorityMedium: t.strumentiCentroControllo.priorityMedium,
    priorityLow: t.strumentiCentroControllo.priorityLow,
  })
  const isRunning = eseguendoId?.startsWith(item.id)
  const [azioniDisponibili, setAzioniDisponibili] = useState<Command[]>([])

  // Date: `data_doc` è una calendar-date (YYYY-MM-DD) → solo giorno localizzato.
  // `data_inserimento` è un timestamp con timezone (ISO) → data + ora nel fuso utente,
  // ISO completo nel tooltip per debug/copia.
  const dataDocFormatted = item.data_doc ? formatDate(item.data_doc, locale, timezone) : null
  const inseritoFormatted = item.data_inserimento
    ? formatDateTime(item.data_inserimento, locale, timezone)
    : null

  const statementId = item.origine === 'riga_statement'
    ? (item.contesto_originale as Record<string, unknown> | null)?.statement_id as string | undefined
    : undefined

  const hasDoc = !!(
    (item.origine === 'documento_da_processare' && item.file_url) ||
    (item.origine === 'fattura' && item.file_url) ||
    (item.origine === 'bolla_aperta' && item.file_url) ||
    (item.origine === 'riga_statement' && statementId)
  )

  const erroreDettaglio = item.origine === 'errore_sincronizzazione'
    ? (item.contesto_originale as Record<string, unknown> | null)?.errore_dettaglio as string | undefined
    : undefined

  const ctx = item.contesto_originale as Record<string, unknown> | null

  const deltaImporto = item.origine === 'riga_statement'
    ? ctx?.delta_importo as number | undefined
    : undefined

  const fatturaCollegata = item.origine === 'riga_statement'
    ? ctx?.fattura_numero as string | undefined
    : undefined

  const bolleCollegate = item.origine === 'riga_statement'
    ? ctx?.bolle_json as Array<{numero_bolla?: string; importo?: number}> | undefined
    : undefined

  const importoFormattato = item.importo != null
    ? new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(item.importo)
    : null

  const ocrInfo: string[] = []
  if (item.ocr_tipo) ocrInfo.push(`OCR: ${item.ocr_tipo}`)
  if (item.ocr_ragione_sociale) ocrInfo.push(item.ocr_ragione_sociale)
  if (item.ocr_p_iva) ocrInfo.push(`P.IVA: ${item.ocr_p_iva}`)
  if (item.matched_by) ocrInfo.push(`Match: ${item.matched_by}`)

  useEffect(() => {
    comandiApplicabili({ item, sedeId }).then((cmds) => {
      setAzioniDisponibili(cmds.filter((c) => c.id !== 'documento.apri'))
    })
  }, [item, sedeId])

  const rowBody = (
      <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            {!nested && (
              <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${priorita.colore}`}>
                {priorita.label}
              </span>
            )}
            {!nested && <TipoBadge origine={item.origine} pendingKind={item.pending_kind} />}
            {!nested && item.fornitore_nome && (
              <span className="text-xs font-medium text-app-fg truncate max-w-[140px] md:max-w-[200px]" title={item.fornitore_nome}>
                {item.fornitore_nome}
              </span>
            )}
            {nested && (
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${priorita.colore}`}>
                {priorita.label}
              </span>
            )}
            {importoFormattato && (
              <span className="text-xs font-mono tabular-nums text-app-fg-muted ml-auto">{importoFormattato}</span>
            )}
          </div>

          {hasDoc ? (
            <div className="mb-0.5">
              <OpenDocumentInAppButton
                documentoId={item.origine === 'documento_da_processare' ? item.id : undefined}
                fatturaId={item.origine === 'fattura' ? item.id : undefined}
                bollaId={item.origine === 'bolla_aperta' ? item.id : undefined}
                statementId={item.origine === 'riga_statement' ? statementId : undefined}
                fileUrl={item.file_url}
                className="group inline-flex items-center gap-1 text-xs font-medium text-sky-300 transition-colors hover:text-sky-200 truncate max-w-full"
              >
                <ExternalLink className="w-3 h-3 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" />
                <span className="truncate">{item.numero_documento || item.riferimenti || item.nome_file || t.strumentiCentroControllo.openDocument}</span>
              </OpenDocumentInAppButton>
            </div>
          ) : (
            <p className="text-xs text-app-fg-muted/60 truncate mb-0.5">
              {item.numero_documento || item.riferimenti || item.nome_file || t.strumentiCentroControllo.noReference}
            </p>
          )}

          {item.nome_file && item.nome_file !== item.riferimenti && item.nome_file !== item.numero_documento && (
            <p className="text-[11px] text-app-fg-muted/50 truncate mb-0.5">{item.nome_file}</p>
          )}

          {(item.mittente || item.oggetto_mail) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mb-0.5 text-[11px] text-app-fg-muted/60">
              {item.mittente && <span>{item.mittente}</span>}
              {item.oggetto_mail && (
                <span className="truncate max-w-[300px]" title={item.oggetto_mail}>
                  «{item.oggetto_mail}»
                </span>
              )}
            </div>
          )}

          {ocrInfo.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-2 mb-0.5">
              {ocrInfo.map((info, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-app-line-15 text-app-fg-muted/70">
                  {info}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3 text-[11px] text-app-fg-muted/50">
            {dataDocFormatted && (
              <span title={item.data_doc ?? undefined}>
                {t.strumentiCentroControllo.rigaDataDocLabel}: {dataDocFormatted}
              </span>
            )}
            {inseritoFormatted && (
              <span title={item.data_inserimento ?? undefined}>
                {t.strumentiCentroControllo.rigaRicevutoLabel}: {inseritoFormatted}
              </span>
            )}
            {item.giorni_in_stato != null && (
              <span className={item.giorni_in_stato > 7 ? 'text-rose-300/70' : ''}>
                {t.strumentiCentroControllo.rigaGiorniInStato.replace('{n}', String(item.giorni_in_stato))}
              </span>
            )}
          </div>

          {erroreDettaglio && (
            <div className="mt-1 text-[11px] text-rose-300/70 truncate max-w-full" title={erroreDettaglio}>
              {erroreDettaglio}
            </div>
          )}

          {item.origine === 'riga_statement' && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
              {deltaImporto != null && (
                <span className={deltaImporto === 0 ? 'text-emerald-300/70' : 'text-rose-300/70'}>
                  Delta: {new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(deltaImporto)}
                </span>
              )}
              {fatturaCollegata && (
                <span className="text-app-fg-muted/60">Fattura: {fatturaCollegata}</span>
              )}
              {bolleCollegate && bolleCollegate.length > 0 && (
                <span className="text-app-fg-muted/60">
                  Bolle: {bolleCollegate.map(b => b.numero_bolla).filter(Boolean).join(', ') || `${bolleCollegate.length} bolla(e)`}
                </span>
              )}
              {!deltaImporto && !fatturaCollegata && (!bolleCollegate || bolleCollegate.length === 0) && (
                <span className="text-app-fg-muted/40">{t.strumentiCentroControllo.noLinkedReference}</span>
              )}
            </div>
          )}

          {suggerimento && (
            <div className="mt-2 flex flex-wrap items-center gap-2 p-2 bg-teal-950/30 border border-teal-800/40 rounded text-sm">
              <span className="text-teal-300 font-medium">Suggerimento:</span>
              <span className="text-teal-200">{suggerimento.label}</span>
              <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                suggerimento.confidenza >= 0.9 ? 'bg-teal-800/60 text-teal-200' : 'bg-amber-900/50 text-amber-200'
              }`}>
                {Math.round(suggerimento.confidenza * 100)}%
              </span>
              <span className="text-xs text-app-fg-muted">({suggerimento.totali_conferme} conferme)</span>
              <div className="ml-auto flex gap-1">
                <button
                  onClick={() => onConfermaSuggerimento(item, suggerimento.azione_id)}
                  disabled={!!isRunning}
                  className="p-1 rounded hover:bg-teal-800/60 text-teal-300 disabled:opacity-50"
                  title={t.strumentiCentroControllo.confirmSuggestion}
                >
                  <GlyphCheck className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onRifiutaSuggerimento(item, suggerimento.azione_id)}
                  className="p-1 rounded hover:bg-rose-950/60 text-rose-400"
                  title={t.strumentiCentroControllo.rejectSuggestion}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {azioniDisponibili.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-app-line-15 pt-3">
              {azioniDisponibili.map((cmd) => (
                <button
                  key={cmd.id}
                  onClick={() => onEsegui(item, cmd.id)}
                  disabled={!!isRunning}
                  className="inline-flex items-center gap-1 rounded-lg bg-app-line-15 px-3 py-1.5 text-xs font-medium text-app-fg-muted transition-colors hover:bg-app-line-25 disabled:opacity-40"
                >
                  {cmd.label}
                </button>
              ))}
              <button
                onClick={() => onApriAzioni?.(item)}
                className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/25 bg-cyan-500/5 px-3 py-1.5 text-xs font-medium text-cyan-300 transition-colors hover:bg-cyan-500/15"
              >
                Altre azioni...
              </button>
            </div>
          )}
        </div>
  )

  if (nested) {
    return (
      <div className="border-t border-app-line-10 first:border-t-0">
        <div className="flex items-start gap-3 p-3 md:gap-4 md:p-4 pl-5 md:pl-6">
          {rowBody}
        </div>
      </div>
    )
  }

  return (
    <div className="app-card overflow-hidden">
      <div className={`app-card-bar-accent ${priorita.colore.split(' ')[0].replace('text-', 'bg-')}`} aria-hidden />
      <div className="flex items-start gap-3 p-3 md:gap-4 md:p-4">
        {rowBody}
      </div>
    </div>
  )
}

function TipoBadge({ origine, pendingKind }: { origine: string; pendingKind: string }) {
  const t = useT()
  const baseClass = 'text-xs font-medium px-1.5 py-0.5 rounded'

  if (origine === 'documento_da_processare') {
    if (pendingKind === 'da_determinare') {
      return <span className={`${baseClass} bg-fuchsia-950/60 text-fuchsia-300`}>{t.strumentiCentroControllo.badgeToBeClassified}</span>
    }
    return <span className={`${baseClass} bg-sky-950/60 text-sky-300`}>{labelPendingKind(pendingKind)}</span>
  }

  if (origine === 'riga_statement') {
    return <span className={`${baseClass} bg-orange-950/60 text-orange-300`}>{t.strumentiCentroControllo.badgeStatement}</span>
  }

  if (origine === 'fattura') {
    return <span className={`${baseClass} bg-emerald-950/60 text-emerald-300`}>{t.strumentiCentroControllo.badgeFattura}</span>
  }

  if (origine === 'errore_sincronizzazione') {
    return <span className={`${baseClass} bg-rose-950/60 text-rose-300`}>{t.strumentiCentroControllo.badgeSyncError}</span>
  }

  if (origine === 'bolla_aperta') {
    return <span className={`${baseClass} bg-amber-950/60 text-amber-300`}>{t.strumentiCentroControllo.badgeOpenBolla}</span>
  }

  return <span className={`${baseClass} bg-app-line-15 text-app-fg-muted`}>{origine}</span>
}

function CommandPalette({
  items,
  ricerca,
  onRicercaChange,
  onEsegui,
  onChiudi,
}: {
  items: CodaItem[]
  ricerca: string
  onRicercaChange: (v: string) => void
  onEsegui: (itemId: string, commandId: CommandId) => void
  onChiudi: () => void
}) {
  const t = useT()
  const comandi = tuttiComandi()
  const [selectedIndex, setSelectedIndex] = useState(0)

  const risultati = useMemo(() => {
    if (!ricerca.trim()) return comandi
    const q = ricerca.toLowerCase()
    return comandi.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.descrizione.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q),
    )
  }, [comandi, ricerca])

  useEffect(() => {
    setSelectedIndex(0)
  }, [ricerca])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, risultati.length - 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
      }
      if (e.key === 'Enter' && risultati[selectedIndex] && items.length > 0) {
        const item = items[0]
        onEsegui(item.id, risultati[selectedIndex].id)
        onChiudi()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [risultati, selectedIndex, items, onEsegui, onChiudi])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onChiudi}>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative app-card overflow-hidden w-full max-w-lg border-app-line-22 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-app-line-22">
          <Search className="w-4 h-4 text-app-fg-muted" />
          <input
            autoFocus
            type="text"
            value={ricerca}
            onChange={(e) => onRicercaChange(e.target.value)}
            placeholder={t.strumentiCentroControllo.searchCommand}
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-app-fg-muted text-app-fg"
          />
          <kbd className="text-[10px] text-app-fg-muted bg-app-line-15 px-1.5 py-0.5 rounded font-mono">ESC</kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {risultati.length === 0 && (
            <p className="text-sm text-app-fg-muted text-center py-4">{t.strumentiCentroControllo.noCommandFound}</p>
          )}
          {risultati.map((cmd, i) => (
            <button
              key={cmd.id}
              className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                i === selectedIndex ? 'bg-sky-950/50 text-sky-200' : 'text-app-fg hover:bg-white/[0.04]'
              }`}
              onClick={() => {
                if (items.length > 0) {
                  onEsegui(items[0].id, cmd.id)
                  onChiudi()
                }
              }}
            >
              <span className="text-app-fg-muted text-xs font-mono w-6 text-right">
                {i + 1}
              </span>
              <div className="flex-1">
                <p className="font-medium text-inherit">{cmd.label}</p>
                <p className="text-xs text-app-fg-muted">{cmd.descrizione}</p>
              </div>
              {cmd.shortcut && (
                <kbd className="text-[10px] text-app-fg-muted bg-app-line-15 px-1.5 py-0.5 rounded font-mono">
                  {cmd.shortcut}
                </kbd>
              )}
            </button>
          ))}
        </div>

        <div className="px-4 py-2.5 border-t border-app-line-15 text-[10px] text-app-fg-muted flex items-center gap-4">
          <span>↑↓ Naviga</span>
          <span>↵ Esegui</span>
          <span>⌘K / ESC Chiudi</span>
        </div>
      </div>
    </div>
  )
}
