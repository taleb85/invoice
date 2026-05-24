'use client'

import { useState } from 'react'
import { useMe } from '@/lib/me-context'
import { useActiveOperator } from '@/lib/active-operator-context'
import { effectiveIsAdminSedeUi, effectiveIsMasterAdminPlane } from '@/lib/effective-operator-ui'
import { useManualDeliverySede } from '@/lib/use-effective-sede-id'
import { useT } from '@/lib/use-t'

export type ReclassifyResultRow = {
  id: string
  from: string | null
  to: string | null
}

export default function ReclassifyPendingKindCard() {
  const { me } = useMe()
  const { activeOperator } = useActiveOperator()
  const sedeCtx = useManualDeliverySede()
  const t = useT()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ checked: number; updated: number; skipped: number; results: ReclassifyResultRow[] } | null>(null)

  const canReclassify = effectiveIsMasterAdminPlane(me, activeOperator) || effectiveIsAdminSedeUi(me, activeOperator)
  if (!canReclassify) return null

  const handleReclassify = async () => {
    if (!confirm(t.strumentiCentroControllo.reclassifyConfirm)) return
    setBusy(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/reclassify-pending-kind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sede_id: sedeCtx.effectiveSedeId || undefined, limit: 5000 }),
      })
      const json = await res.json()
      setResult({
        checked: json.checked ?? 0,
        updated: json.updated ?? 0,
        skipped: json.skipped ?? 0,
        results: json.results ?? [],
      })
    } catch {
      setResult({ checked: 0, updated: 0, skipped: 0, results: [] })
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="app-card min-h-0 min-w-0 overflow-hidden p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-app-fg">{t.strumentiCentroControllo.reclassifyTitle}</h3>
          <p className="mt-1 text-xs text-app-fg-muted">
            {t.strumentiCentroControllo.reclassifyDesc}
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={handleReclassify}
          className="shrink-0 touch-manipulation rounded-lg border border-cyan-500/35 bg-cyan-500/8 px-3 py-1.5 text-xs font-semibold text-cyan-200/95 transition-colors hover:bg-cyan-500/15 disabled:opacity-50"
        >
          {busy ? t.strumentiCentroControllo.reclassifyBusy : t.strumentiCentroControllo.reclassifyButton}
        </button>
      </div>

      {result && (
        <div className="mt-3 rounded-lg border border-app-line-25 bg-app-line-10 px-4 py-3 text-xs">
          <p className="font-medium text-app-fg">
            {(() => {
              const line = t.strumentiCentroControllo.reclassifyResultLine
                .replace('{checked}', String(result.checked))
                .replace('{updated}', String(result.updated))
                .replace('{skipped}', String(result.skipped))
              return line
            })()}
          </p>
          {result.results.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-app-fg-muted hover:text-app-fg">
                {t.strumentiCentroControllo.reclassifyDetailLabel.replace('{n}', String(result.results.length))}
              </summary>
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                {result.results.map((r) => (
                  <li key={r.id} className="truncate text-app-fg-muted">
                    <code className="text-[10px]">{r.id.slice(0, 12)}…</code>{' '}
                    <span className="text-red-400">{r.from}</span>
                    <span className="mx-1">→</span>
                    <span className="text-emerald-300">{r.to ?? '—'}</span>
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
