'use client'

import { useState, useRef, useCallback } from 'react'
import { useMe } from '@/lib/me-context'
import { useActiveOperator } from '@/lib/active-operator-context'
import { effectiveIsAdminSedeUi, effectiveIsMasterAdminPlane } from '@/lib/effective-operator-ui'
import { useManualDeliverySede } from '@/lib/use-effective-sede-id'

type BatchResult = {
  checked: number
  updated: number
  errors: number
  has_more: boolean
  results: { id: string; tipo_ai: string; old_kind: string | null; new_kind: string | null; error?: string }[]
}

export default function AiReclassifyCard() {
  const { me } = useMe()
  const { activeOperator } = useActiveOperator()
  const sedeCtx = useManualDeliverySede()
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ totalChecked: number; totalUpdated: number; totalErrors: number } | null>(null)
  const [logs, setLogs] = useState<{ id: string; tipo_ai: string; old_kind: string | null; new_kind: string | null; error?: string }[]>([])
  const abortRef = useRef(false)

  const canReclassify = effectiveIsMasterAdminPlane(me, activeOperator) || effectiveIsAdminSedeUi(me, activeOperator)

  const processBatch = useCallback(async (): Promise<boolean> => {
    if (abortRef.current) return false
    try {
      const res = await fetch('/api/admin/ai-reclassify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sede_id: sedeCtx.effectiveSedeId || undefined, limit: 5 }),
      })
      const json: BatchResult = await res.json()

      setProgress((prev) => ({
        totalChecked: (prev?.totalChecked ?? 0) + json.checked,
        totalUpdated: (prev?.totalUpdated ?? 0) + json.updated,
        totalErrors: (prev?.totalErrors ?? 0) + json.errors,
      }))

      if (json.results?.length) {
        setLogs((prev) => [...prev, ...json.results])
      }

      return json.has_more ?? json.checked > 0
    } catch {
      return false
    }
  }, [sedeCtx.effectiveSedeId])

  const handleStart = async () => {
    if (!confirm('Avviare la classificazione AI completa? Gemini analizzerà TUTTI i documenti non ancora processati in batch da 5.')) return
    abortRef.current = false
    setBusy(true)
    setProgress(null)
    setLogs([])

    let hasMore = true
    while (hasMore) {
      hasMore = await processBatch()
      if (abortRef.current) break
    }

    setBusy(false)
  }

  const handleStop = () => {
    abortRef.current = true
    setBusy(false)
  }

  if (!canReclassify) return null

  return (
    <article className="app-card min-h-0 min-w-0 overflow-hidden p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-app-fg">
            Classificazione AI (Gemini)
            <span className="ml-2 rounded-full bg-purple-500/15 px-1.5 py-0.5 text-[9px] font-bold text-purple-200">Beta</span>
          </h3>
          <p className="mt-1 text-xs text-app-fg-muted">
            Gemini analizza il contenuto dei PDF e classifica automaticamente tutti i documenti non ancora processati.
            Batch da 5 documenti, in sequenza fino al completamento.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {busy && (
            <button
              type="button"
              onClick={handleStop}
              className="touch-manipulation rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 text-xs font-semibold text-red-200 transition-colors hover:bg-red-500/18"
            >
              Stop
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={handleStart}
            className="shrink-0 touch-manipulation rounded-lg border border-purple-500/35 bg-purple-500/8 px-3 py-1.5 text-xs font-semibold text-purple-200/95 transition-colors hover:bg-purple-500/15 disabled:opacity-50"
          >
            {busy ? 'Classificazione in corso…' : 'Classifica tutto con AI'}
          </button>
        </div>
      </div>

      {busy && (
        <div className="mt-3 flex items-center gap-2 text-xs text-purple-300">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-purple-300 border-t-transparent" />
          {progress
            ? `Elaborati ${progress.totalChecked} documenti · ${progress.totalUpdated} riclassificati · ${progress.totalErrors} errori`
            : 'Gemini sta analizzando i PDF…'}
        </div>
      )}

      {(progress || logs.length > 0) && !busy && (
        <div className="mt-3 rounded-lg border border-app-line-25 bg-app-line-10 px-4 py-3 text-xs">
          <p className="font-medium text-app-fg">
            {progress ? (
              <>
                Elaborati: {progress.totalChecked} · Riclassificati:{' '}
                <span className={progress.totalUpdated > 0 ? 'text-purple-300 font-semibold' : 'text-emerald-300'}>
                  {progress.totalUpdated}
                </span>
                {' · '}Errori: <span className={progress.totalErrors > 0 ? 'text-red-400' : 'text-emerald-300'}>{progress.totalErrors}</span>
                {progress.totalChecked > 0 && progress.totalUpdated === 0 && progress.totalErrors === 0 && (
                  <span className="ml-2 text-app-fg-muted">— Tutti già classificati ✓</span>
                )}
              </>
            ) : null}
          </p>
          {logs.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-app-fg-muted hover:text-app-fg">
                Dettaglio ({logs.length} documenti)
              </summary>
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                {logs.map((r) => (
                  <li key={r.id} className="truncate text-app-fg-muted">
                    <code className="text-[10px]">{r.id.slice(0, 12)}…</code>{' '}
                    <span className="text-purple-400">AI: {r.tipo_ai}</span>
                    {r.old_kind && <span className="mx-1 text-red-400">da {r.old_kind}</span>}
                    {r.new_kind && <span className="mx-1 text-emerald-300">→ {r.new_kind}</span>}
                    {r.error && <span className="text-red-400">⚠ {r.error}</span>}
                    {!r.old_kind && !r.new_kind && !r.error && <span className="text-app-fg-muted"> (invariato)</span>}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </article>
  )
}
