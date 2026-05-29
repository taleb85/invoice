'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Sparkles, Trash2, Zap } from 'lucide-react'
import { useMe } from '@/lib/me-context'
import { useActiveOperator } from '@/lib/active-operator-context'
import { effectiveIsAdminSedeUi, effectiveIsMasterAdminPlane } from '@/lib/effective-operator-ui'
import { useManualDeliverySede } from '@/lib/use-effective-sede-id'

/**
 * Card "Audit & Fix di tutti i documenti" per il Centro Controllo.
 *
 * Lancia in loop l'endpoint `/api/admin/audit-and-fix-all` finché non restano
 * più candidati. Due modalità:
 *   - "Veloce" (deterministica): rilegge metadata OCR già presenti, usa la
 *     catena di qualità 2/3 per correggere fornitore + tipo + data e propaga
 *     a fatture/bolle. Gratis, ~50 docs/secondo.
 *   - "Approfondito" (AI Gemini): scarica i file, riclassifica con Vision,
 *     prova match fornitore per ragione sociale. Lento, costoso.
 *
 * Idempotente: i documenti già auditati vengono skippati ai cicli successivi.
 */

type Phase = 'deterministic' | 'ai' | 'completo' | 'full_rescan' | 'cleanup_misclassified'

type AuditPendingCounts = {
  total: number
  pass1_remaining: number
  pass2_remaining: number
  completo_remaining: number
  completo_done: number
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
  const [phase, setPhase] = useState<Phase | null>(null)
  const [totals, setTotals] = useState<Totals>(EMPTY_TOTALS)
  const [recentChanges, setRecentChanges] = useState<AuditChange[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [lastRunForced, setLastRunForced] = useState(false)
  const [rescanStage, setRescanStage] = useState<'documents' | 'statements' | null>(null)
  const abortRef = useRef(false)

  // Cleanup state separato — dry-run preview prima della cancellazione vera
  const [cleanupBusy, setCleanupBusy] = useState(false)
  const [cleanupPreview, setCleanupPreview] = useState<CleanupAction[] | null>(null)
  const [cleanupApplied, setCleanupApplied] = useState<{
    count: number
    errors: number
  } | null>(null)
  const [cleanupError, setCleanupError] = useState<string | null>(null)
  const [pendingCounts, setPendingCounts] = useState<AuditPendingCounts | null>(null)

  const refreshPendingCounts = useCallback(async () => {
    try {
      const qs = sedeCtx.effectiveSedeId
        ? `?sede_id=${encodeURIComponent(sedeCtx.effectiveSedeId)}`
        : ''
      const res = await fetch(`/api/admin/audit-and-fix-all${qs}`, { credentials: 'include' })
      const json = (await res.json()) as AuditPendingCounts & { ok?: boolean }
      if (res.ok && json.ok !== false) {
        setPendingCounts({
          total: json.total,
          pass1_remaining: json.pass1_remaining,
          pass2_remaining: json.pass2_remaining,
          completo_remaining: json.completo_remaining,
          completo_done: json.completo_done,
        })
      }
    } catch {
      // non bloccare la card se lo status fallisce
    }
  }, [sedeCtx.effectiveSedeId])

  useEffect(() => {
    void refreshPendingCounts()
  }, [refreshPendingCounts])

  const runOneBatch = useCallback(
    async (
      currentPhase: Phase,
      opts?: {
        dryRun?: boolean
        force?: boolean
        afterId?: string | null
        statementAfterId?: string | null
      },
    ): Promise<BatchResult> => {
      const res = await fetch('/api/admin/audit-and-fix-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          phase: currentPhase,
          ...(sedeCtx.effectiveSedeId ? { sede_id: sedeCtx.effectiveSedeId } : {}),
          ...(opts?.dryRun ? { dry_run: true } : {}),
          ...(opts?.force ? { force: true } : {}),
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

  const runPhase = useCallback(
    async (currentPhase: Phase, opts?: { force?: boolean }): Promise<Totals> => {
      setPhase(currentPhase)
      let runningTotals: Totals = { ...EMPTY_TOTALS }
      setTotals(runningTotals)
      setRecentChanges([])
      setRescanStage(null)

      const HARD_LIMIT =
        currentPhase === 'deterministic' ? 200 : currentPhase === 'full_rescan' ? 2000 : 700
      let consecutiveErrors = 0
      let afterId: string | null | undefined
      let statementAfterId: string | null | undefined
      let scanStage: 'documents' | 'statements' = 'documents'

      for (let i = 0; i < HARD_LIMIT; i++) {
        if (abortRef.current) break
        let result: BatchResult
        try {
          result = await runOneBatch(currentPhase, {
            force: opts?.force ?? currentPhase === 'full_rescan',
            afterId:
              currentPhase === 'full_rescan' && scanStage === 'statements'
                ? undefined
                : afterId,
            statementAfterId:
              currentPhase === 'full_rescan' ? statementAfterId : undefined,
          })
          consecutiveErrors = 0
        } catch (e) {
          consecutiveErrors++
          runningTotals = {
            ...runningTotals,
            errors: runningTotals.errors + 1,
          }
          setTotals(runningTotals)
          if (consecutiveErrors >= 3) {
            setErrorMsg(e instanceof Error ? e.message : 'Errore di rete persistente')
            break
          }
          continue
        }

        runningTotals = {
          iterations: runningTotals.iterations + 1,
          checked: runningTotals.checked + result.checked,
          fornitore_fixed: runningTotals.fornitore_fixed + result.fornitore_fixed,
          tipo_fixed: runningTotals.tipo_fixed + result.tipo_fixed,
          flagged_for_review: runningTotals.flagged_for_review + result.flagged_for_review,
          unchanged: runningTotals.unchanged + result.unchanged,
          errors: runningTotals.errors + result.errors,
          remaining: result.remaining_estimate,
          initialRemaining:
            runningTotals.initialRemaining ?? result.remaining_estimate,
        }
        setTotals(runningTotals)

        if (result.changes.length > 0) {
          setRecentChanges((prev) => [...result.changes.slice(0, 3), ...prev].slice(0, 8))
        }

        if (result.rescan_stage) {
          scanStage = result.rescan_stage
          setRescanStage(result.rescan_stage)
        }

        if (currentPhase === 'full_rescan') {
          if (scanStage === 'documents') {
            afterId = result.next_after_id ?? undefined
          } else {
            statementAfterId = result.next_after_id ?? undefined
          }
        } else {
          afterId = result.next_after_id ?? undefined
        }

        if (!result.has_more) break
      }

      return runningTotals
    },
    [runOneBatch],
  )

  const handleStart = useCallback(
    async (
      mode:
        | 'deterministic'
        | 'deterministic_force'
        | 'with_ai'
        | 'ai_only'
        | 'full_rescan',
    ) => {
      const force = mode === 'deterministic_force'
      const confirmMsg =
        mode === 'full_rescan'
          ? 'Riesaminare TUTTI i documenti della sede dal primo all\'ultimo (ordine ID), rileggendo ogni PDF con Gemini e spostando al fornitore corretto? Operazione lunga e consuma quota AI.'
          : mode === 'deterministic_force'
            ? 'Rieseguire la passata veloce su TUTTI i documenti in coda (anche già auditati)? Usa solo i metadata OCR salvati — non rilegge i PDF.'
            : mode === 'deterministic'
              ? 'Avvia ricontrollo veloce sui documenti in coda non ancora auditati? Corregge fornitore + tipo dove la catena di qualità è certa (2/3 segnali). Non rilegge i PDF.'
              : mode === 'ai_only'
                ? 'Avvia SOLO la passata AI Gemini sui documenti con file non ancora analizzati dall\'AI? Scarica e riclassifica ogni PDF: lento e consuma quota Gemini.'
                : 'Avvia «Completo + AI» sui documenti in coda non ancora completati? Per ogni documento: passata veloce sui metadata + Gemini Vision sul PDF. Salta i documenti già marcati completi.'
      if (!confirm(confirmMsg)) return

      abortRef.current = false
      setBusy(true)
      setErrorMsg(null)
      setDone(false)
      setLastRunForced(force || mode === 'full_rescan')
      setRecentChanges([])
      setTotals(EMPTY_TOTALS)

      try {
        if (mode === 'deterministic' || mode === 'deterministic_force') {
          await runPhase('deterministic', { force })
        } else if (mode === 'with_ai') {
          await runPhase('completo')
        } else if (mode === 'full_rescan') {
          await runPhase('full_rescan')
        }
        if (!abortRef.current && mode === 'ai_only') {
          await runPhase('ai')
        }
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : 'Errore di rete')
      } finally {
        setBusy(false)
        setDone(true)
        setPhase(null)
        void refreshPendingCounts()
      }
    },
    [runPhase, refreshPendingCounts],
  )

  const handleStop = useCallback(() => {
    abortRef.current = true
  }, [])

  const handleCleanupPreview = useCallback(async () => {
    setCleanupBusy(true)
    setCleanupError(null)
    setCleanupPreview(null)
    setCleanupApplied(null)
    try {
      // Carica TUTTI i candidati in dry-run (con batch grosso per fare meno round-trip).
      const all: CleanupAction[] = []
      const HARD_LIMIT = 50
      let lastRemaining = 0
      for (let i = 0; i < HARD_LIMIT; i++) {
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
        lastRemaining = json.remaining_estimate
        if (!json.has_more) break
      }
      setCleanupPreview(all)
      void lastRemaining
    } catch (e) {
      setCleanupError(e instanceof Error ? e.message : 'Errore di rete')
    } finally {
      setCleanupBusy(false)
    }
  }, [sedeCtx.effectiveSedeId])

  const handleCleanupApply = useCallback(async () => {
    if (!cleanupPreview || cleanupPreview.length === 0) return
    if (!confirm(`Cancellare definitivamente ${cleanupPreview.length} bolle/fatture create per errore da Order Confirmation? I file resteranno accessibili nello storage, ma le righe DB verranno rimosse.`)) {
      return
    }
    setCleanupBusy(true)
    setCleanupError(null)
    let applied = 0
    let errors = 0
    try {
      const HARD_LIMIT = 50
      for (let i = 0; i < HARD_LIMIT; i++) {
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
            Ricontrolla TUTTI i documenti (fornitore + tipologia)
            <span className="ml-2 rounded-full bg-cyan-500/15 px-1.5 py-0.5 text-[9px] font-bold text-cyan-200">
              comando unico
            </span>
          </h3>
          <p className="mt-1 text-xs text-app-fg-muted">
            Solo righe in <strong className="font-medium text-app-fg">documenti da processare</strong>{' '}
            (qualsiasi tipo: fattura, bolla, ordine, estratto, listino, …).
            <strong className="font-medium text-app-fg"> Veloce</strong> usa solo metadata OCR salvati — non
            apre i PDF.             <strong className="font-medium text-app-fg">Riscan tutti (1→N)</strong> rilegge ogni documento
            in ordine (dal primo all&apos;ultimo), riassegna il fornitore e propaga a fatture/bolle/estratti collegati.
            <strong className="font-medium text-app-fg"> Completo + AI (nuovi)</strong> processa solo i documenti
            non ancora marcati <code className="text-[10px]">audit_completo_at</code>.
            {pendingCounts ? (
              <>
                {' '}
                Checkpoint:{' '}
                <strong className="font-medium text-app-fg">{pendingCounts.completo_done}</strong> completati,{' '}
                <strong className="font-medium text-app-fg">{pendingCounts.completo_remaining}</strong> in
                attesa «Completo + AI».
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
          onClick={() => handleStart('deterministic')}
          className="touch-manipulation rounded-lg border border-emerald-500/40 bg-emerald-500/8 px-3 py-1.5 text-xs font-semibold text-emerald-200/95 transition-colors hover:bg-emerald-500/15 disabled:opacity-50"
        >
          <Zap className="-mt-0.5 mr-1 inline-block h-3.5 w-3.5" />
          Veloce (gratis)
        </button>
        <button
          type="button"
          disabled={busy || cleanupBusy}
          onClick={() => handleStart('deterministic_force')}
          title="Ricalcola anche documenti già auditati in passata veloce (sempre senza rileggere il PDF)"
          className="touch-manipulation rounded-lg border border-app-line-25 bg-app-line-10 px-3 py-1.5 text-xs font-semibold text-app-fg-muted transition-colors hover:bg-app-line-15 disabled:opacity-50"
        >
          Riesegui (forza)
        </button>
        <button
          type="button"
          disabled={busy || cleanupBusy}
          onClick={() => handleStart('full_rescan')}
          title="Rilegge tutti i documenti in ordine e riassegna il fornitore corretto"
          className="touch-manipulation rounded-lg border border-cyan-500/45 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition-colors hover:bg-cyan-500/18 disabled:opacity-50"
        >
          <Sparkles className="-mt-0.5 mr-1 inline-block h-3.5 w-3.5" />
          Riscan tutti (1→N)
          {pendingCounts && pendingCounts.total > 0 ? (
            <span className="ml-1 rounded-full bg-cyan-500/25 px-1.5 py-0.5 text-[9px] font-bold">
              {pendingCounts.total}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          disabled={busy || cleanupBusy}
          onClick={() => handleStart('with_ai')}
          title={
            pendingCounts
              ? `${pendingCounts.completo_remaining} documenti in attesa di Completo + AI`
              : 'Passata veloce + Gemini Vision, con checkpoint incrementale'
          }
          className="touch-manipulation rounded-lg border border-purple-500/40 bg-purple-500/8 px-3 py-1.5 text-xs font-semibold text-purple-200/95 transition-colors hover:bg-purple-500/15 disabled:opacity-50"
        >
          <Sparkles className="-mt-0.5 mr-1 inline-block h-3.5 w-3.5" />
          Completo + AI (nuovi)
          {pendingCounts && pendingCounts.completo_remaining > 0 ? (
            <span className="ml-1 rounded-full bg-purple-500/25 px-1.5 py-0.5 text-[9px] font-bold">
              {pendingCounts.completo_remaining}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          disabled={busy || cleanupBusy}
          onClick={() => handleStart('ai_only')}
          className="touch-manipulation rounded-lg border border-app-line-25 bg-app-line-10 px-3 py-1.5 text-xs font-semibold text-app-fg-muted transition-colors hover:bg-app-line-15 disabled:opacity-50"
          title="Salta la passata veloce e fai solo Gemini Vision"
        >
          Solo AI
        </button>
      </div>

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
            onClick={handleCleanupPreview}
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
              onClick={handleCleanupApply}
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
              {phase === 'deterministic'
                ? 'Passata veloce in corso…'
                : phase === 'full_rescan'
                  ? rescanStage === 'statements'
                    ? 'Riscan tutti: correzione estratti in archivio…'
                    : 'Riscan tutti: documenti 1→N (metadata + Gemini)…'
                  : phase === 'completo'
                    ? 'Completo + AI in corso (metadata + Gemini)…'
                    : phase === 'ai'
                      ? 'Passata AI Gemini in corso…'
                      : 'Avvio…'}
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
          {done && totals.checked === 0 && !lastRunForced ? (
            <p className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/95">
              Nessun documento da processare in passata veloce: la coda risulta già auditata.
              Questo strumento non rilegge i PDF né corregge direttamente le fatture in archivio.
              Per OCR sul file usa <strong>Completo + AI</strong>, <strong>Fix date OCR</strong> (sotto) o
              <strong> Rileggi documento</strong> sulla riga fattura. Per ricalcolare solo da metadata:{' '}
              <strong>Riesegui (forza)</strong>.
            </p>
          ) : null}
          {done &&
          lastRunForced &&
          totals.checked > 0 &&
          totals.fornitore_fixed === 0 &&
          totals.tipo_fixed === 0 ? (
            <p className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/95">
              Passata completata su {totals.checked} documenti: fornitore e tipo erano già coerenti con i
              metadata OCR salvati (o il documento era già marcato <code className="text-[10px]">audit_completo_at</code>).
              Questa modalità <strong>non rilegge i PDF</strong> e non corregge fatture/listino scollegati dalla coda.
              Per inoltri «Statement from …» già associati usa <strong>Riesegui (forza)</strong> o un secondo giro
              <strong> Completo + AI</strong>. Per date OCR o numeri sbagliati: <strong>Fix date OCR</strong> o{' '}
              <strong>Rileggi documento</strong>.
            </p>
          ) : null}
          <div className="rounded-lg border border-app-line-25 bg-app-line-10 px-4 py-3 text-xs">
            <p className="font-medium text-app-fg">
              {done ? 'Audit completato' : 'Riepilogo passata'}: visti{' '}
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
                      {ch.tipo_before !== ch.tipo_after ? (
                        <span className="ml-1 text-emerald-300">
                          tipo: {ch.tipo_before ?? '—'} → {ch.tipo_after ?? '—'}
                        </span>
                      ) : null}
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
