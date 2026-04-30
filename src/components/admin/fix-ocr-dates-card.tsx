'use client'

import { useState } from 'react'
import { useMe } from '@/lib/me-context'
import { useActiveOperator } from '@/lib/active-operator-context'
import { effectiveIsAdminSedeUi, effectiveIsMasterAdminPlane } from '@/lib/effective-operator-ui'

export type FixOcrDetailRow = {
  id: string
  table: string
  action:
    | 'date_only'
    | 'migrated_to_fattura'
    | 'migrated_to_bolla'
    | 'unchanged'
    | 'error'
    | 'bolla_enriched'
    | 'fattura_enriched'
  previousData: string
  newData: string | null
  ocrTipo: string | null
}

function actionLabelIt(a: FixOcrDetailRow['action']): string {
  switch (a) {
    case 'date_only':
      return 'Data aggiornata'
    case 'migrated_to_fattura':
      return 'Migrato → fattura'
    case 'migrated_to_bolla':
      return 'Migrato → bolla'
    case 'unchanged':
      return 'Invariato'
    case 'error':
      return 'Errore'
    case 'bolla_enriched':
      return 'Bolla: dati da OCR'
    case 'fattura_enriched':
      return 'Fattura: dati da OCR'
    default:
      return a
  }
}

/**
 * Correggi date sospette (Gemini) — stessa logica della pagina Impostazioni.
 */
export default function FixOcrDatesCard({ anchorId }: { anchorId?: string }) {
  const { me } = useMe()
  const { activeOperator } = useActiveOperator()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [details, setDetails] = useState<FixOcrDetailRow[]>([])
  const [detailsTruncated, setDetailsTruncated] = useState(false)
  const [reportErrors, setReportErrors] = useState<{ id: string; table: string; message: string }[]>([])

  const masterPlane = effectiveIsMasterAdminPlane(me, activeOperator)
  const isAdminSede = effectiveIsAdminSedeUi(me, activeOperator)
  const sedeId = me?.sede_id ?? null
  const show = !!(sedeId && (masterPlane || isAdminSede))

  if (!show) return null

  const run = async () => {
    setErr(null)
    setResult(null)
    setDetails([])
    setDetailsTruncated(false)
    setReportErrors([])
    setLoading(true)
    try {
      const res = await fetch('/api/admin/fix-ocr-dates', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 40, sede_id: sedeId, allow_tipo_migrate: true }),
      })
      const data = (await res.json()) as {
        error?: string
        corrected?: number
        totalSuspicious?: number
        scanned?: number
        remaining?: number
        dateOnlyFixes?: number
        tipoMigratedToFattura?: number
        tipoMigratedToBolla?: number
        errors?: { id: string; table: string; message: string }[]
        details?: FixOcrDetailRow[]
        detailsTruncated?: boolean
      }
      if (!res.ok) {
        setErr(data.error ?? `HTTP ${res.status}`)
        return
      }
      setResult(
        `Corretti: ${data.corrected ?? 0} (su ${data.scanned ?? 0} scansioni; sospetti in sede: ${
          data.totalSuspicious ?? 0
        }${data.remaining ? `; in coda: ${data.remaining}` : ''}) — ` +
          `date: ${data.dateOnlyFixes ?? 0}, → fattura: ${
            data.tipoMigratedToFattura ?? 0
          }, → bolla: ${data.tipoMigratedToBolla ?? 0}.` +
          (data.errors?.length ? ` Errori: ${data.errors.length}.` : ''),
      )
      setDetails(Array.isArray(data.details) ? data.details : [])
      setDetailsTruncated(Boolean(data.detailsTruncated))
      setReportErrors(Array.isArray(data.errors) ? data.errors : [])
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Errore di rete')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div id={anchorId} className="app-card overflow-hidden">
      <div className="flex items-start gap-4 app-workspace-inset-bg-soft p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/12 ring-1 ring-amber-500/25">
          <svg className="h-5 w-5 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">OCR & date</p>
          <p className="mt-0.5 text-sm font-semibold text-app-fg">Correggi date (Gemini)</p>
          <p className="mt-1 text-xs leading-snug text-app-fg-muted">
            Rilegge l’allegato con l’OCR attuale e corregge date sospette e tipo documento, solo per questa sede.
          </p>
          {err ? (
            <p className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">{err}</p>
          ) : null}
          {result ? (
            <p className="mt-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
              {result}
            </p>
          ) : null}
          {reportErrors.length > 0 ? (
            <div className="mt-3 max-h-40 overflow-y-auto rounded-lg border border-amber-500/25 bg-amber-500/8 px-3 py-2.5">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-200/90">Errori o avvisi</p>
              <ul className="space-y-1.5 text-[11px] leading-snug text-amber-100/95">
                {reportErrors.map((e, i) => (
                  <li key={`${e.table}-${e.id}-${i}`} className="break-words">
                    <span className="font-mono text-[10px] text-amber-200/70">{e.table}</span>
                    <span className="mx-1 text-amber-200/50">·</span>
                    <span className="font-mono text-[10px] text-amber-100/80" title={e.id}>
                      {e.id.length > 10 ? `${e.id.slice(0, 8)}…` : e.id}
                    </span>
                    <span className="mt-0.5 block text-app-fg-muted dark:text-amber-50/80">{e.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {details.length > 0 ? (
            <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-app-line-25 bg-black/20 px-3 py-2.5">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-app-fg-muted">Dettaglio operazioni</p>
              <ul className="space-y-2 text-[11px] leading-snug text-app-fg">
                {details.map((d, i) => (
                  <li key={`${d.table}-${d.id}-${i}`} className="border-b border-app-line-10 pb-2 last:border-0 last:pb-0">
                    <span className="font-mono text-[10px] text-app-fg-muted">{d.table}</span>
                    <span className="mx-1 text-app-fg-muted">·</span>
                    <span className="font-mono text-[10px] text-cyan-300/90" title={d.id}>
                      {d.id.length > 10 ? `${d.id.slice(0, 8)}…` : d.id}
                    </span>
                    <span className="ml-1.5 text-app-fg-muted">{actionLabelIt(d.action)}</span>
                    {d.newData && d.newData !== d.previousData ? (
                      <span className="mt-0.5 block pl-0 text-app-fg-muted">
                        {d.previousData} → <span className="font-medium text-emerald-200/95">{d.newData}</span>
                      </span>
                    ) : d.action === 'unchanged' ? (
                      <span className="mt-0.5 block text-app-fg-muted">Data: {d.previousData}</span>
                    ) : d.action === 'error' ? (
                      <span className="mt-0.5 block text-app-fg-muted">Data in DB: {d.previousData}</span>
                    ) : null}
                    {d.ocrTipo ? (
                      <span className="mt-0.5 block text-[10px] text-violet-300/90">OCR: {d.ocrTipo}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
              {detailsTruncated ? (
                <p className="mt-2 text-[10px] text-amber-200/80">Elenco troncato: riesegui l’operazione se restano documenti in coda.</p>
              ) : null}
            </div>
          ) : null}
          <button
            type="button"
            onClick={run}
            disabled={loading}
            className="mt-3 inline-flex w-full touch-manipulation items-center justify-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 text-xs font-semibold text-amber-100 transition-colors hover:border-amber-400/50 hover:bg-amber-500/18 disabled:opacity-50 sm:w-auto"
          >
            {loading ? 'Elaborazione…' : 'Fix date OCR'}
          </button>
        </div>
      </div>
    </div>
  )
}
