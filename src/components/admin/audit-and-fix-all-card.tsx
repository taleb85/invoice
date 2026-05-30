'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Sparkles, Trash2 } from 'lucide-react'
import { useMe } from '@/lib/me-context'
import { useActiveOperator } from '@/lib/active-operator-context'
import { effectiveIsAdminSedeUi, effectiveIsMasterAdminPlane } from '@/lib/effective-operator-ui'
import {
  checkpointMatchesSede,
  clearAuditFullRescanCheckpoint,
  loadAuditFullRescanCheckpoint,
  saveAuditFullRescanCheckpoint,
  type AuditFullRescanCheckpoint,
} from '@/lib/audit-full-rescan-checkpoint'
import { useManualDeliverySede } from '@/lib/use-effective-sede-id'

/**
 * Card unica Centro Controllo: riesame completo documenti (fornitore + tipologia)
 * tramite `/api/admin/audit-and-fix-all` fase `full_rescan`.
 */

type Phase = 'full_rescan' | 'cleanup_misclassified'

type AuditPendingCounts = {
  total: number
}

type AuditChange = {
  doc_id: string
  fornitore_id_before: string | null
  fornitore_id_after: string | null
  tipo_before: string | null
  tipo_after: string | null
  fattura_id: string | null
  bolla_id: string | null
  reason: string
}

type CleanupAction = {
  doc_id: string
  fornitore_nome: string | null
  oggetto_mail: string | null
  file_name: string | null
  pending_kind: string | null
  deleted_bolla_id: string | null
  deleted_fattura_id: string | null
  deleted_orphan_fattura_ids: string[]
  applied: boolean
}

type BatchResult = {
  ok: boolean
  phase: Phase
  rescan_stage?: 'documents' | 'statements'
  checked: number
  fornitore_fixed: number
  tipo_fixed: number
  flagged_for_review: number
  unchanged: number
  errors: number
  has_more: boolean
  changes: AuditChange[]
  cleanup_actions?: CleanupAction[]
  dry_run?: boolean
  remaining_estimate: number
  next_after_id?: string | null
  error?: string
}

type Totals = {
  iterations: number
  checked: number
  fornitore_fixed: number
  tipo_fixed: number
  flagged_for_review: number
  unchanged: number
  errors: number
  remaining: number
  initialRemaining: number | null
}

const EMPTY_TOTALS: Totals = {
  iterations: 0,
  checked: 0,
  fornitore_fixed: 0,
  tipo_fixed: 0,
  flagged_for_review: 0,
  unchanged: 0,
  errors: 0,
  remaining: 0,
  initialRemaining: null,
}

export default function AuditAndFixAllCard() {
  const { me } = useMe()
  const { activeOperator } = useActiveOperator()
  const sedeCtx = useManualDeliverySede()

  const canRun =
    effectiveIsMasterAdminPlane(me, activeOperator) || effectiveIsAdminSedeUi(me, activeOperator)

  const [busy, setBusy] = useState(false)
  const [totals, setTotals] = useState<Totals>(EMPTY_TOTALS)
  const [recentChanges, setRecentChanges] = useState<AuditChange[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [rescanStage, setRescanStage] = useState<'documents' | 'statements' | null>(null)
  const abortRef = useRef(false)
  const rescanCursorRef = useRef<{
    scanStage: 'documents' | 'statements'
    afterId: string | null
    statementAfterId: string | null
    totals: Totals
  }>({
    scanStage: 'documents',
    afterId: null,
    statementAfterId: null,
    totals: EMPTY_TOTALS,
  })

  const [cleanupBusy, setCleanupBusy] = useState(false)
  const [cleanupPreview, setCleanupPreview] = useState<CleanupAction[] | null>(null)
  const [cleanupApplied, setCleanupApplied] = useState<{
    count: number
    errors: number
  } | null>(null)
  const [cleanupError, setCleanupError] = useState<string | null>(null)
  const [pendingTotal, setPendingTotal] = useState<number | null>(null)
  const [savedCheckpoint, setSavedCheckpoint] = useState<AuditFullRescanCheckpoint | null>(
    null,
  )

  const syncCheckpointFromStorage = useCallback(() => {
    const cp = loadAuditFullRescanCheckpoint()
    if (cp && checkpointMatchesSede(cp, sedeCtx.effectiveSedeId)) {
      setSavedCheckpoint(cp)
    } else {
      setSavedCheckpoint(null)
    }
  }, [sedeCtx.effectiveSedeId])

  useEffect(() => {
    syncCheckpointFromStorage()
  }, [syncCheckpointFromStorage])

  const refreshPendingCounts = useCallback(async () => {
    try {
      const qs = sedeCtx.effectiveSedeId
        ? `?sede_id=${encodeURIComponent(sedeCtx.effectiveSedeId)}`
        : ''
      const res = await fetch(`/api/admin/audit-and-fix-all${qs}`, { credentials: 'include' })
      const json = (await res.json()) as AuditPendingCounts & { ok?: boolean; total?: number }
      if (res.ok && json.ok !== false && typeof json.total === 'number') {
        setPendingTotal(json.total)
      }
    } catch {
      // ignore
    }
  }, [sedeCtx.effectiveSedeId])

  useEffect(() => {
    void refreshPendingCounts()
  }, [refreshPendingCounts])

  const runOneBatch = useCallback(
    async (opts?: { afterId?: string | null; statementAfterId?: string | null }) => {
      const res = await fetch('/api/admin/audit-and-fix-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          phase: 'full_rescan',
          ...(sedeCtx.effectiveSedeId ? { sede_id: sedeCtx.effectiveSedeId } : {}),
          ...(opts?.afterId ? { after_id: opts.afterId } : {}),
          ...(opts?.statementAfterId ? { statement_after_id: opts.statementAfterId } : {}),
        }),
      })
      const json = (await res.json()) as BatchResult
      if (!res.ok || json.ok === false) {
        throw new Error(json.error ?? `HTTP ${res.status}`)
      }
      return json
    },
    [sedeCtx.effectiveSedeId],
  )

  const persistCheckpoint = useCallback(
    (
      params: {
        scanStage: 'documents' | 'statements'
        afterId?: string | null
        statementAfterId?: string | null
        totals: Totals
        reason: AuditFullRescanCheckpoint['reason']
      },
    ) => {
      const cp: AuditFullRescanCheckpoint = {
        version: 1,
        sede_id: sedeCtx.effectiveSedeId?.trim() ?? null,
        scan_stage: params.scanStage,
        after_id: params.afterId?.trim() ?? null,
        statement_after_id: params.statementAfterId?.trim() ?? null,
        totals: params.totals,
        saved_at: new Date().toISOString(),
        reason: params.reason,
      }
      saveAuditFullRescanCheckpoint(cp)
      setSavedCheckpoint(cp)
    },
    [sedeCtx.effectiveSedeId],
  )

  const runRescanLoop = useCallback(
    async (resume?: AuditFullRescanCheckpoint | null) => {
      abortRef.current = false
      setBusy(true)
      setErrorMsg(null)
      setDone(false)
      let runningTotals: Totals = resume?.totals ?? { ...EMPTY_TOTALS }
      setTotals(runningTotals)

      let afterId: string | null | undefined = resume?.after_id ?? undefined
      let statementAfterId: string | null | undefined = resume?.statement_after_id ?? undefined
      let scanStage: 'documents' | 'statements' = resume?.scan_stage ?? 'documents'
      setRescanStage(scanStage)
      rescanCursorRef.current = {
        scanStage,
        afterId: afterId ?? null,
        statementAfterId: statementAfterId ?? null,
        totals: runningTotals,
      }
      let consecutiveErrors = 0
      let interrupted = false

      const writeCheckpoint = (reason: AuditFullRescanCheckpoint['reason']) => {
        rescanCursorRef.current = {
          scanStage,
          afterId: afterId ?? null,
          statementAfterId: statementAfterId ?? null,
          totals: runningTotals,
        }
        persistCheckpoint({
          ...rescanCursorRef.current,
          reason,
        })
      }

      try {
        for (let i = 0; i < 2000; i++) {
          if (abortRef.current) {
            interrupted = true
            break
          }
          let result: BatchResult
          try {
            result = await runOneBatch({
              afterId: scanStage === 'statements' ? undefined : afterId,
              statementAfterId: scanStage === 'statements' ? statementAfterId : undefined,
            })
            consecutiveErrors = 0
          } catch (e) {
            consecutiveErrors++
            runningTotals = { ...runningTotals, errors: runningTotals.errors + 1 }
            setTotals(runningTotals)
            writeCheckpoint('network')
            if (consecutiveErrors >= 3) {
              setErrorMsg(
                (e instanceof Error ? e.message : 'Errore di rete persistente') +
                  ' — progresso salvato: puoi usare «Riprendi» quando la connessione torna.',
              )
              interrupted = true
              break
            }
            continue
          }

          runningTotals = {
            iterations: runningTotals.iterations + 1,
            checked: runningTotals.checked + result.checked,
            fornitore_fixed: runningTotals.fornitore_fixed + result.fornitore_fixed,
            tipo_fixed: runningTotals.tipo_fixed + result.tipo_fixed,
            flagged_for_review:
              runningTotals.flagged_for_review + result.flagged_for_review,
            unchanged: runningTotals.unchanged + result.unchanged,
            errors: runningTotals.errors + result.errors,
            remaining: result.remaining_estimate,
            initialRemaining: runningTotals.initialRemaining ?? result.remaining_estimate,
          }
          setTotals(runningTotals)

          if (result.changes.length > 0) {
            setRecentChanges((prev) => [...result.changes.slice(0, 3), ...prev].slice(0, 8))
          }

          if (result.rescan_stage) {
            scanStage = result.rescan_stage
            setRescanStage(result.rescan_stage)
          }

          if (scanStage === 'documents') {
            afterId = result.next_after_id ?? undefined
          } else {
            statementAfterId = result.next_after_id ?? undefined
          }

          writeCheckpoint('progress')

          if (!result.has_more) break
        }
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : 'Errore di rete')
        writeCheckpoint('network')
        interrupted = true
      } finally {
        setBusy(false)
        setDone(true)
        if (interrupted) {
          writeCheckpoint(abortRef.current ? 'user_stop' : 'network')
        } else {
          clearAuditFullRescanCheckpoint()
          setSavedCheckpoint(null)
        }
        void refreshPendingCounts()
      }
    },
    [persistCheckpoint, runOneBatch, refreshPendingCounts],
  )

  const handleStartRescan = useCallback(
    async (opts?: { resume?: boolean; discardCheckpoint?: boolean }) => {
      const cp =
        !opts?.discardCheckpoint && (opts?.resume || savedCheckpoint)
          ? savedCheckpoint
          : null

      if (opts?.discardCheckpoint) {
        clearAuditFullRescanCheckpoint()
        setSavedCheckpoint(null)
      }

      if (cp && !opts?.resume) {
        const when = new Date(cp.saved_at).toLocaleString('it-IT')
        const stageLabel =
          cp.scan_stage === 'statements' ? 'estratti conto' : 'documenti in coda'
        const resumeNow = confirm(
          `Trovato un riesame interrotto (${when}): ${cp.totals.checked} documenti già elaborati, fase «${stageLabel}».\n\nOK = Riprendi da dove eri rimasto\nAnnulla = Ricomincia da zero`,
        )
        if (resumeNow) {
          await runRescanLoop(cp)
          return
        }
        clearAuditFullRescanCheckpoint()
        setSavedCheckpoint(null)
      } else if (cp && opts?.resume) {
        await runRescanLoop(cp)
        return
      }

      if (
        !confirm(
          'Riesaminare TUTTI i documenti della sede dal primo all\'ultimo, rileggendo ogni PDF con Gemini e spostando al fornitore corretto? Operazione lunga e consuma quota AI.',
        )
      ) {
        return
      }

      setRecentChanges([])
      setTotals(EMPTY_TOTALS)
      setRescanStage(null)
      await runRescanLoop(null)
    },
    [runRescanLoop, savedCheckpoint],
  )

  useEffect(() => {
    if (!busy) return
    const onOffline = () => {
      persistCheckpoint({
        ...rescanCursorRef.current,
        reason: 'offline',
      })
    }
    window.addEventListener('offline', onOffline)
    return () => window.removeEventListener('offline', onOffline)
  }, [busy, persistCheckpoint])

  const handleStop = useCallback(() => {
    abortRef.current = true
  }, [])

  const handleCleanupPreview = useCallback(async () => {
    setCleanupBusy(true)
    setCleanupError(null)
    setCleanupPreview(null)
    setCleanupApplied(null)
    try {
      const all: CleanupAction[] = []
      for (let i = 0; i < 50; i++) {
        const res = await fetch('/api/admin/audit-and-fix-all', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            phase: 'cleanup_misclassified',
            dry_run: true,
            batch_size: 100,
            ...(sedeCtx.effectiveSedeId ? { sede_id: sedeCtx.effectiveSedeId } : {}),
          }),
        })
        const json = (await res.json()) as BatchResult
        if (!res.ok || json.ok === false) {
          throw new Error(json.error ?? `HTTP ${res.status}`)
        }
        if (Array.isArray(json.cleanup_actions)) all.push(...json.cleanup_actions)
        if (!json.has_more) break
      }
      setCleanupPreview(all)
    } catch (e) {
      setCleanupError(e instanceof Error ? e.message : 'Errore di rete')
    } finally {
      setCleanupBusy(false)
    }
  }, [sedeCtx.effectiveSedeId])

  const handleCleanupApply = useCallback(async () => {
    if (!cleanupPreview || cleanupPreview.length === 0) return
    if (
      !confirm(
        `Cancellare definitivamente ${cleanupPreview.length} bolle/fatture create per errore da Order Confirmation? I file resteranno nello storage, ma le righe DB verranno rimosse.`,
      )
    ) {
      return
    }
    setCleanupBusy(true)
    setCleanupError(null)
    let applied = 0
    let errors = 0
    try {
      for (let i = 0; i < 50; i++) {
        const res = await fetch('/api/admin/audit-and-fix-all', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            phase: 'cleanup_misclassified',
            dry_run: false,
            batch_size: 50,
            ...(sedeCtx.effectiveSedeId ? { sede_id: sedeCtx.effectiveSedeId } : {}),
          }),
        })
        const json = (await res.json()) as BatchResult
        if (!res.ok || json.ok === false) {
          throw new Error(json.error ?? `HTTP ${res.status}`)
        }
        const acts = json.cleanup_actions ?? []
        applied += acts.filter((a) => a.applied).length
        errors += json.errors
        if (!json.has_more) break
      }
      setCleanupApplied({ count: applied, errors })
      setCleanupPreview(null)
    } catch (e) {
      setCleanupError(e instanceof Error ? e.message : 'Errore di rete')
    } finally {
      setCleanupBusy(false)
    }
  }, [cleanupPreview, sedeCtx.effectiveSedeId])

  if (!canRun) return null

  const pct =
    totals.initialRemaining && totals.initialRemaining > 0
      ? Math.min(100, Math.round((totals.checked / totals.initialRemaining) * 100))
      : 0

  return (
    <article className="app-card min-h-0 min-w-0 overflow-hidden p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-app-fg">
            Riesame completo documenti
            <span className="ml-2 rounded-full bg-cyan-500/15 px-1.5 py-0.5 text-[9px] font-bold text-cyan-200">
              comando unico
            </span>
          </h3>
          <p className="mt-1 text-xs text-app-fg-muted">
            Scorre tutti i documenti in coda dal <strong className="font-medium text-app-fg">primo all&apos;ultimo</strong>,
            rilegge ogni PDF con Gemini, corregge fornitore e tipologia e propaga a fatture, bolle ed estratti collegati.
            Gestisce anche inoltri «Statement from …» con fornitore errato.
            {pendingTotal != null ? (
              <>
                {' '}
                Documenti in sede: <strong className="font-medium text-app-fg">{pendingTotal}</strong>.
              </>
            ) : null}
          </p>
        </div>
        {busy ? (
          <button
            type="button"
            onClick={handleStop}
            className="shrink-0 touch-manipulation rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 text-xs font-semibold text-red-200 transition-colors hover:bg-red-500/18"
          >
            Stop
          </button>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || cleanupBusy}
          onClick={() => void handleStartRescan()}
          title="Rilegge tutti i documenti in ordine e riassegna il fornitore corretto"
          className="touch-manipulation rounded-lg border border-cyan-500/45 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition-colors hover:bg-cyan-500/18 disabled:opacity-50"
        >
          <Sparkles className="-mt-0.5 mr-1 inline-block h-3.5 w-3.5" />
          Avvia riesame completo (1→N)
          {pendingTotal != null && pendingTotal > 0 ? (
            <span className="ml-1 rounded-full bg-cyan-500/25 px-1.5 py-0.5 text-[9px] font-bold">
              {pendingTotal}
            </span>
          ) : null}
        </button>
        {savedCheckpoint && !busy ? (
          <>
            <button
              type="button"
              disabled={cleanupBusy}
              onClick={() => void handleStartRescan({ resume: true })}
              title="Riprende dal ultimo batch salvato (checkpoint locale)"
              className="touch-manipulation rounded-lg border border-emerald-500/45 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition-colors hover:bg-emerald-500/18 disabled:opacity-50"
            >
              Riprendi da checkpoint
              <span className="ml-1 rounded-full bg-emerald-500/25 px-1.5 py-0.5 text-[9px] font-bold">
                {savedCheckpoint.totals.checked}
              </span>
            </button>
            <button
              type="button"
              disabled={cleanupBusy}
              onClick={() => void handleStartRescan({ discardCheckpoint: true })}
              className="touch-manipulation rounded-lg border border-app-line-25 px-3 py-1.5 text-xs font-medium text-app-fg-muted transition-colors hover:bg-app-surface-elevated disabled:opacity-50"
            >
              Scarta checkpoint
            </button>
          </>
        ) : null}
      </div>

      {savedCheckpoint && !busy ? (
        <p className="mt-2 text-[11px] text-amber-200/90">
          Riesame interrotto il{' '}
          {new Date(savedCheckpoint.saved_at).toLocaleString('it-IT')}
          {savedCheckpoint.totals.remaining > 0
            ? ` — circa ${savedCheckpoint.totals.remaining} documenti ancora in coda.`
            : null}{' '}
          Il progresso è salvato nel browser: se perdi la connessione puoi riprendere senza ricominciare da zero.
        </p>
      ) : null}

      <div className="mt-4 border-t border-app-line-15 pt-3">
        <h4 className="text-xs font-semibold text-app-fg">
          Pulizia bolle/fatture create per errore
        </h4>
        <p className="mt-1 text-[11px] text-app-fg-muted">
          Trova bolle/fatture create automaticamente da email di tipo
          &laquo;Order Confirmation&raquo;: sono ordini, non documenti contabili.
          Mostra prima un&rsquo;anteprima, poi cancella solo se confermi.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || cleanupBusy}
            onClick={() => void handleCleanupPreview()}
            className="touch-manipulation rounded-lg border border-amber-500/40 bg-amber-500/8 px-3 py-1.5 text-xs font-semibold text-amber-200/95 transition-colors hover:bg-amber-500/15 disabled:opacity-50"
          >
            <Trash2 className="-mt-0.5 mr-1 inline-block h-3.5 w-3.5" />
            {cleanupBusy && !cleanupPreview
              ? 'Cerco candidati…'
              : 'Cerca ordini classificati come bolle/fatture'}
          </button>
          {cleanupPreview && cleanupPreview.length > 0 ? (
            <button
              type="button"
              disabled={cleanupBusy}
              onClick={() => void handleCleanupApply()}
              className="touch-manipulation rounded-lg border border-red-500/40 bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-100 transition-colors hover:bg-red-500/25 disabled:opacity-50"
            >
              {cleanupBusy
                ? 'Cancellazione in corso…'
                : `Conferma cancellazione di ${cleanupPreview.length} record`}
            </button>
          ) : null}
        </div>

        {cleanupError ? (
          <p className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            ⚠ {cleanupError}
          </p>
        ) : null}

        {cleanupApplied ? (
          <p className="mt-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
            ✓ Cancellati {cleanupApplied.count} documenti
            {cleanupApplied.errors > 0 ? ` (${cleanupApplied.errors} errori)` : ''}.
          </p>
        ) : null}

        {cleanupPreview && cleanupPreview.length === 0 && !cleanupBusy ? (
          <p className="mt-2 rounded-lg border border-app-line-25 bg-app-line-10 px-3 py-2 text-xs text-app-fg-muted">
            Nessun candidato trovato: tutto pulito.
          </p>
        ) : null}

        {cleanupPreview && cleanupPreview.length > 0 ? (
          <details className="mt-2" open>
            <summary className="cursor-pointer text-xs font-medium text-amber-200/80 hover:text-amber-200">
              {cleanupPreview.length} candidati da cancellare
            </summary>
            <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto rounded-lg border border-app-line-15 bg-app-line-5 p-2 text-[11px]">
              {cleanupPreview.map((a) => {
                const orph = a.deleted_orphan_fattura_ids?.length ?? 0
                return (
                  <li
                    key={a.doc_id}
                    className="flex items-start gap-2 truncate text-app-fg-muted"
                  >
                    <span className="text-amber-300">•</span>
                    <span className="min-w-0 flex-1">
                      <span className="font-medium text-app-fg">
                        {a.fornitore_nome ?? '?'}
                      </span>{' '}
                      <span className="text-app-fg-muted">{a.file_name ?? '—'}</span>
                      {a.deleted_bolla_id ? (
                        <span className="ml-2 text-cyan-300">bolla</span>
                      ) : null}
                      {a.deleted_fattura_id ? (
                        <span className="ml-2 text-cyan-300">fattura</span>
                      ) : null}
                      {orph > 0 ? (
                        <span className="ml-2 text-amber-300">+{orph} orfane</span>
                      ) : null}
                    </span>
                  </li>
                )
              })}
            </ul>
          </details>
        ) : null}
      </div>

      {busy ? (
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2 text-xs text-cyan-300">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
            <span>
              {rescanStage === 'statements'
                ? 'Correzione estratti in archivio…'
                : 'Documenti 1→N (metadata + Gemini)…'}
            </span>
            {totals.initialRemaining ? (
              <span className="text-app-fg-muted">
                ({totals.checked} / {totals.initialRemaining})
              </span>
            ) : null}
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-app-line-15">
            <div
              className="h-full bg-cyan-400/70 transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px] text-app-fg-muted sm:grid-cols-4">
            <Stat label="iterazioni" value={totals.iterations} />
            <Stat label="fornitore +" value={totals.fornitore_fixed} accent="emerald" />
            <Stat label="tipo +" value={totals.tipo_fixed} accent="emerald" />
            <Stat label="da rivedere" value={totals.flagged_for_review} accent="amber" />
          </div>
        </div>
      ) : null}

      {(done || totals.iterations > 0) && !busy ? (
        <div className="mt-4 space-y-3">
          {errorMsg ? (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              ⚠ {errorMsg}
            </p>
          ) : null}
          <div className="rounded-lg border border-app-line-25 bg-app-line-10 px-4 py-3 text-xs">
            <p className="font-medium text-app-fg">
              {done ? 'Riesame completato' : 'Riepilogo'}: visti{' '}
              <strong>{totals.checked}</strong> documenti,{' '}
              <span className="text-emerald-300">
                fornitore corretto su {totals.fornitore_fixed}
              </span>
              {', '}
              <span className="text-emerald-300">
                tipo corretto su {totals.tipo_fixed}
              </span>
              {totals.flagged_for_review > 0 ? (
                <>
                  {', '}
                  <span className="text-amber-300">
                    {totals.flagged_for_review} segnati da rivedere
                  </span>
                </>
              ) : null}
              {totals.errors > 0 ? (
                <>
                  {', '}
                  <span className="text-red-300">{totals.errors} errori</span>
                </>
              ) : null}
              .
            </p>
            {recentChanges.length > 0 ? (
              <details className="mt-2">
                <summary className="cursor-pointer text-app-fg-muted hover:text-app-fg">
                  Ultime modifiche ({recentChanges.length})
                </summary>
                <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                  {recentChanges.map((ch, i) => (
                    <li key={`${ch.doc_id}-${i}`} className="truncate text-app-fg-muted">
                      <code className="text-[10px]">{ch.doc_id.slice(0, 8)}…</code>{' '}
                      <span className="text-cyan-300">[{ch.reason}]</span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  )
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent?: 'emerald' | 'amber'
}) {
  const colorClass =
    accent === 'emerald'
      ? 'text-emerald-300'
      : accent === 'amber'
        ? 'text-amber-300'
        : 'text-app-fg'
  return (
    <div className="rounded-md bg-app-line-10 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wide text-app-fg-muted">{label}</div>
      <div className={`text-sm font-semibold ${colorClass}`}>{value}</div>
    </div>
  )
}
