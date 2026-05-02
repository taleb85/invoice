'use client'

import { useCallback, useState } from 'react'

type ReprocessResponse = {
  error?: string
  processed?: number
  auto_saved?: number
  da_revisionare?: number
  other_outcomes?: number
  errors?: number
  has_more_candidates?: boolean
}

type Strings = {
  resultTemplate: string
  moreHint: string
}

/**
 * Stesso POST di Centro operazioni: `/api/admin/reprocess-da-associare`.
 * Master può omettere `sede_id` (tutta la base); admin_sede richiede sede sul server (`me`).
 */
export function useReprocessDaAssociare(opts: {
  effectiveSedeId: string | null
  strings: Strings
  /** Dopo POST ok (es. `router.refresh` per KPI dashboard SSR). */
  onSuccess?: () => void
}) {
  const { effectiveSedeId, strings, onSuccess } = opts

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)

  const run = useCallback(async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/admin/reprocess-da-associare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(effectiveSedeId ? { sede_id: effectiveSedeId } : {}),
        }),
      })
      const j = (await res.json().catch(() => ({}))) as ReprocessResponse
      if (!res.ok) {
        setError(
          j.error ??
            (res.status === 504
              ? 'Timeout (504): la richiesta ha impiegato troppo tempo. Riprova: vengono elaborati solo pochi documenti per singola richiesta.'
              : `HTTP ${res.status}`),
        )
        return
      }
      const trimmedHint = strings.moreHint.trim()
      const more =
        j.has_more_candidates === true && trimmedHint
          ? `\n${trimmedHint}`
          : ''
      const otherOutcomes =
        typeof j.other_outcomes === 'number' && Number.isFinite(j.other_outcomes)
          ? j.other_outcomes
          : Math.max(0, (j.processed ?? 0) - (j.auto_saved ?? 0) - (j.da_revisionare ?? 0))
      setResult(
        strings.resultTemplate
          .replace('{processed}', String(j.processed ?? 0))
          .replace('{auto_saved}', String(j.auto_saved ?? 0))
          .replace('{da_revisionare}', String(j.da_revisionare ?? 0))
          .replace('{other_outcomes}', String(otherOutcomes))
          .replace('{errors}', String(j.errors ?? 0))
          .replace('{more}', more),
      )
      onSuccess?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore di rete')
    } finally {
      setLoading(false)
    }
  }, [effectiveSedeId, onSuccess, strings.moreHint, strings.resultTemplate])

  return { loading, error, result, run }
}
