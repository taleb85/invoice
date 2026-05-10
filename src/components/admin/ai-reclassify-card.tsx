'use client'

import { useState } from 'react'
import { useMe } from '@/lib/me-context'
import { useActiveOperator } from '@/lib/active-operator-context'
import { effectiveIsAdminSedeUi, effectiveIsMasterAdminPlane } from '@/lib/effective-operator-ui'
import { useManualDeliverySede } from '@/lib/use-effective-sede-id'

export default function AiReclassifyCard() {
  const { me } = useMe()
  const { activeOperator } = useActiveOperator()
  const sedeCtx = useManualDeliverySede()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ checked: number; updated: number; errors: number; results: { id: string; tipo_ai: string; old_kind: string | null; new_kind: string | null; error?: string }[] } | null>(null)

  const canReclassify = effectiveIsMasterAdminPlane(me, activeOperator) || effectiveIsAdminSedeUi(me, activeOperator)
  if (!canReclassify) return null

  const handleReclassify = async () => {
    if (!confirm('Usare Gemini AI per classificare i documenti?')) return
    setBusy(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/ai-reclassify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sede_id: sedeCtx.effectiveSedeId || undefined, limit: 5 }),
      })
      const json = await res.json()
      setResult(json)
    } catch {
      setResult({ checked: 0, updated: 0, errors: 0, results: [] })
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="app-card min-h-0 min-w-0 overflow-hidden p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-app-fg">
            Classificazione AI (Gemini)
            <span className="ml-2 rounded-full bg-purple-500/15 px-1.5 py-0.5 text-[9px] font-bold text-purple-200">Beta</span>
          </h3>
          <p className="mt-1 text-xs text-app-fg-muted">
            Gemini analizza il contenuto dei PDF e suggerisce la categoria corretta.
            Processa 5 documenti per volta (limite Vercel). Clicca più volte per processare tutti.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={handleReclassify}
          className="shrink-0 touch-manipulation rounded-lg border border-purple-500/35 bg-purple-500/8 px-3 py-1.5 text-xs font-semibold text-purple-200/95 transition-colors hover:bg-purple-500/15 disabled:opacity-50"
        >
          {busy ? 'AI sta classificando…' : 'Classifica con AI'}
        </button>
      </div>

      {busy && (
        <div className="mt-3 flex items-center gap-2 text-xs text-purple-300">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-purple-300 border-t-transparent" />
          Gemini sta analizzando i PDF…
        </div>
      )}

      {result && (
        <div className="mt-3 rounded-lg border border-app-line-25 bg-app-line-10 px-4 py-3 text-xs">
          <p className="font-medium text-app-fg">
            Analizzati: {result.checked} · Riclassificati:{' '}
            <span className={result.updated > 0 ? 'text-purple-300 font-semibold' : 'text-emerald-300'}>
              {result.updated}
            </span>
            {' · '}Errori: <span className={result.errors > 0 ? 'text-red-400' : 'text-emerald-300'}>{result.errors}</span>
          </p>
          {result.results.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-app-fg-muted hover:text-app-fg">
                Dettaglio ({result.results.length} documenti)
              </summary>
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                {result.results.map((r) => (
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
