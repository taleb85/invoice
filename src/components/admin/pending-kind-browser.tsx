'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useMe } from '@/lib/me-context'
import { useActiveOperator } from '@/lib/active-operator-context'
import { effectiveIsAdminSedeUi, effectiveIsMasterAdminPlane } from '@/lib/effective-operator-ui'
import { useManualDeliverySede } from '@/lib/use-effective-sede-id'

type KindStats = {
  kind: string
  label: string
  icon: string
  table: string
  count: number
}

type ApiResponse = {
  stats: KindStats[]
  total: number
}

const KIND_COLORS: Record<string, string> = {
  fattura: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30',
  nota_credito: 'bg-purple-500/15 text-purple-200 border-purple-500/30',
  bolla: 'bg-indigo-500/15 text-indigo-200 border-indigo-500/30',
  statement: 'bg-amber-500/15 text-amber-200 border-amber-500/30',
  ordine: 'bg-sky-500/15 text-sky-200 border-sky-500/30',
  potenziale: 'bg-pink-500/15 text-pink-200 border-pink-500/30',
}

const NOW = new Date()
const MONTHS = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
]

export default function PendingKindBrowser() {
  const { me } = useMe()
  const { activeOperator } = useActiveOperator()
  const sedeCtx = useManualDeliverySede()
  const sedeId = sedeCtx.effectiveSedeId
  const [stats, setStats] = useState<KindStats[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState(NOW.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(NOW.getMonth() + 1)
  const [reclassKind, setReclassKind] = useState<string | null>(null)
  const [reclassResult, setReclassResult] = useState<{
    kind: string
    checked: number
    updated: number
  } | null>(null)

  const canView = effectiveIsMasterAdminPlane(me, activeOperator) || effectiveIsAdminSedeUi(me, activeOperator)
  if (!canView) return null

  const years = useMemo(() => {
    const y = NOW.getFullYear()
    return Array.from({ length: 6 }, (_, i) => y - i)
  }, [])

  const loadStats = useCallback(() => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ year: String(selectedYear), month: String(selectedMonth) })
    if (sedeId) params.set('sede_id', sedeId)

    fetch(`/api/admin/document-counts?${params.toString()}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Errore caricamento'))))
      .then((data: ApiResponse) => {
        setStats(data.stats)
        setTotal(data.total)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [sedeId, selectedYear, selectedMonth])

  useEffect(() => { loadStats() }, [loadStats])

  const handleReclassify = async (kind: string) => {
    const pendingKind = kind.replace('coda_', '')
    setReclassKind(pendingKind)
    setReclassResult(null)
    try {
      const res = await fetch('/api/admin/reclassify-pending-kind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pending_kind: pendingKind, sede_id: sedeId ?? undefined, limit: 200 }),
      })
      const json = await res.json()
      setReclassResult({ kind: pendingKind, checked: json.checked ?? 0, updated: json.updated ?? 0 })
      loadStats()
    } catch {
      setReclassResult({ kind: pendingKind, checked: 0, updated: 0 })
    } finally {
      setReclassKind(null)
    }
  }

  // Gruppi principali
  const finalized = stats.filter((s) => !s.kind.startsWith('coda_'))
  const inQueue = stats.filter((s) => s.kind.startsWith('coda_'))

  return (
    <article className="app-card min-h-0 min-w-0 overflow-hidden p-5">
      {/* Header con filtri periodo */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-app-fg">
            Archivio documenti
            {!loading && <span className="ml-2 text-xs font-normal text-app-fg-muted">({total} totali)</span>}
          </h3>
          <p className="text-xs text-app-fg-muted">
            Tutti i documenti presenti nel sistema, raggruppati per categoria.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="rounded-md border border-app-line-30 bg-app-workspace-surface-elevated px-2 py-1 text-xs font-medium text-app-fg"
          >
            {MONTHS.map((name, i) => (
              <option key={i + 1} value={i + 1}>{name}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="rounded-md border border-app-line-30 bg-app-workspace-surface-elevated px-2 py-1 text-xs font-medium text-app-fg"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {reclassResult && (
        <div className="mt-3 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs text-cyan-200">
          <span className="font-medium">{reclassResult.kind}</span>:{' '}
          {reclassResult.checked} controllati,{' '}
          <span className={reclassResult.updated > 0 ? 'font-semibold text-amber-300' : ''}>
            {reclassResult.updated} riclassificati
          </span>
        </div>
      )}

      {loading && <p className="text-xs text-app-fg-muted py-6 text-center">Caricamento…</p>}
      {error && <p className="text-xs text-red-400 py-2">{error}</p>}

      {!loading && !error && (
        <div className="mt-4 space-y-6">
          {/* Documenti finalizzati */}
          <div>
            <h4 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-app-fg-muted">
              Documenti finalizzati ({finalized.reduce((s, st) => s + st.count, 0)})
            </h4>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {finalized.map((st) => (
                <div
                  key={st.kind}
                  className={`rounded-lg border px-3 py-2.5 text-center transition-colors hover:brightness-110 ${
                    KIND_COLORS[st.kind] ?? 'bg-slate-500/15 text-slate-200 border-slate-500/30'
                  }`}
                >
                  <p className="text-lg">{st.icon}</p>
                  <p className="mt-1 text-lg font-bold tabular-nums">{st.count.toLocaleString('it-IT')}</p>
                  <p className="text-[10px] font-medium opacity-80">{st.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Documenti in coda — cliccabili per riclassificare */}
          <div>
            <h4 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-app-fg-muted">
              In attesa di classificazione ({inQueue.reduce((s, st) => s + st.count, 0)})
              <span className="ml-2 font-normal text-app-fg-muted">— clicca per riclassificare tutti</span>
            </h4>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {inQueue.filter((st) => st.count > 0 || st.kind === 'coda_altro').map((st) => {
                const pendingKind = st.kind.replace('coda_', '')
                const busy = reclassKind === pendingKind
                const isAltro = st.kind === 'coda_altro'
                const noDocs = st.count === 0
                return (
                  <button
                    key={st.kind}
                    type="button"
                    disabled={busy || isAltro || noDocs}
                    onClick={() => void handleReclassify(st.kind)}
                    className={`rounded-lg border px-3 py-2.5 text-center transition-colors ${
                      noDocs || isAltro
                        ? 'bg-slate-500/8 text-slate-400 border-slate-500/15 cursor-default'
                        : 'bg-amber-500/12 text-amber-200 border-amber-500/25 hover:bg-amber-500/20 hover:border-amber-400/40 hover:shadow-[0_0_12px_-4px_rgba(251,191,36,0.15)] cursor-pointer'
                    } disabled:opacity-50 disabled:cursor-wait`}
                  >
                    <p className="text-lg">{busy ? '⏳' : st.icon}</p>
                    <p className={`mt-1 text-lg font-bold tabular-nums ${st.count > 0 ? '' : 'opacity-50'}`}>
                      {busy ? '…' : st.count.toLocaleString('it-IT')}
                    </p>
                    <p className="text-[10px] font-medium opacity-80">{st.label.replace('In coda → ', '')}</p>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </article>
  )
}
