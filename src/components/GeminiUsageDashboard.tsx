'use client'

import { useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react'

/** ── Date helpers (calendar locale browser, anno fiscale UK = 6 aprile) ── */

function localYmd(d: Date): string {
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
}

export type PeriodPreset =
  | 'today'
  | 'week'
  | 'month'
  | 'last90'
  | 'fy_curr_uk'
  | 'fy_prev_uk'
  | 'custom'

/** Inizio anno fiscale UK corrente (6 apr locale). */
function ukCurrentFiscalYearStartAnchor(today = new Date()): Date {
  const cy = today.getFullYear()
  const fyStartThisYear = new Date(cy, 3, 6) // aprile = 3
  return today >= fyStartThisYear ? fyStartThisYear : new Date(cy - 1, 3, 6)
}

function presetDateRangeUk(
  preset: Exclude<PeriodPreset, 'today' | 'custom'>,
): { mode: 'day'; from: string; to: string } {
  const now = new Date()
  const today0 = startOfLocalDay(now)
  const todayIso = localYmd(today0)

  if (preset === 'week') {
    const weekStart = new Date(today0)
    weekStart.setDate(weekStart.getDate() - 6)
    return { mode: 'day', from: localYmd(weekStart), to: todayIso }
  }
  if (preset === 'month') {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    return { mode: 'day', from: localYmd(monthStart), to: todayIso }
  }
  if (preset === 'last90') {
    const d = new Date(today0)
    d.setDate(d.getDate() - 89)
    return { mode: 'day', from: localYmd(d), to: todayIso }
  }
  if (preset === 'fy_curr_uk') {
    const fyFrom = ukCurrentFiscalYearStartAnchor(now)
    return { mode: 'day', from: localYmd(fyFrom), to: todayIso }
  }
  if (preset === 'fy_prev_uk') {
    const currentStar = ukCurrentFiscalYearStartAnchor(now)
    const prevFrom = new Date(currentStar.getFullYear() - 1, 3, 6)
    const prevTo = new Date(currentStar.getFullYear(), 3, 5)
    return { mode: 'day', from: localYmd(prevFrom), to: localYmd(prevTo) }
  }
  const _exhaustive: never = preset
  return _exhaustive
}

function defaultCustomRange(): { from: string; to: string } {
  const now = new Date()
  const t0 = startOfLocalDay(now)
  const past = new Date(t0)
  past.setDate(past.getDate() - 30)
  return { from: localYmd(past), to: localYmd(t0) }
}

interface DailyUsage {
  date: string
  calls: number
  tokens: number
  costUsd: number
}

interface RecentCall {
  created_at: string
  user_id: string
  operation: string
  intent: string
  inputTokens: number
  outputTokens: number
  estimatedCostUsd: number
}

interface PerSedeUsage {
  sedeId: string | null
  nome: string
  calls: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  costUsd: number
}

interface UsageData {
  model: string
  pricing: { inputPerMillion: number; outputPerMillion: number }
  totalCalls: number
  totalInputTokens: number
  totalOutputTokens: number
  totalTokens: number
  totalCostUsd: number
  avgCostPerScan: number
  daily: DailyUsage[]
  recent: RecentCall[]
  perSede: PerSedeUsage[]
  /** Intervallo dalla risposta /api/admin/ai-usage */
  period?: {
    start: string
    end: string
    range_mode?: 'instant' | 'day'
    label_from_date?: string
    label_to_date?: string
  }
}

function fmtPeriodSummary(period: UsageData['period']): string {
  if (!period?.start || !period?.end) return ''
  try {
    if (period.range_mode === 'instant') {
      const a = new Date(period.start)
      const b = new Date(period.end)
      return `${a.toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'medium' })} → ${b.toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'medium' })}`
    }
    if (period.label_from_date && period.label_to_date) {
      return `${period.label_from_date} → ${period.label_to_date}`
    }
    const a = new Date(period.start)
    const b = new Date(period.end)
    return `${localYmd(a)} → ${localYmd(b)}`
  } catch {
    return ''
  }
}

function fmt(n: number, decimals = 0): string {
  return n.toLocaleString('it-IT', { maximumFractionDigits: decimals })
}

function fmtCost(n: number): string {
  if (n === 0) return '$0.000000'
  if (n < 0.001) return `$${n.toFixed(6)}`
  return `$${n.toFixed(4)}`
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub?: string
  accent?: string
}) {
  return (
    <div
      className="flex min-w-0 flex-col gap-1 rounded-xl p-4"
      style={{
        background: 'rgba(15, 42, 74, 0.6)',
        border: '1px solid rgba(34, 211, 238, 0.15)',
      }}
    >
      <span className="text-[10px] font-semibold uppercase tracking-widest text-app-fg-muted">
        {label}
      </span>
      <span
        className="text-[22px] font-bold leading-none"
        style={{ color: accent ?? '#22d3ee' }}
      >
        {value}
      </span>
      {sub && <span className="text-[11px] text-app-fg-muted">{sub}</span>}
    </div>
  )
}

// ─── Mini bar chart ────────────────────────────────────────────────────────────
function MiniBarChart({ daily }: { daily: DailyUsage[] }) {
  if (!daily.length) return null
  const maxCalls = Math.max(...daily.map((d) => d.calls), 1)
  const last7 = daily.slice(-7)

  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: 'rgba(15, 42, 74, 0.6)',
        border: '1px solid rgba(34, 211, 238, 0.15)',
      }}
    >
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-app-fg-muted">
        Nel periodo — ultimi giorni disponibili (finestra grafico max 7)
      </p>
      <div className="flex items-end gap-1.5" style={{ height: 56 }}>
        {last7.map((d) => (
          <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-t transition-all"
              style={{
                height: `${Math.max(4, Math.round((d.calls / maxCalls) * 48))}px`,
                background:
                  d.calls > 0
                    ? 'rgba(34, 211, 238, 0.55)'
                    : 'rgba(34, 211, 238, 0.12)',
              }}
              title={`${d.date}: ${d.calls} scansioni`}
            />
            <span className="text-[9px] text-app-fg-muted">
              {d.date.slice(5)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export interface GeminiUsageDashboardHandle {
  refresh: () => void
}

export interface GeminiUsageDashboardProps {
  /** Obsoleto — l'anno fiscale UK è nei preset. */
  countryCode?: string
}

// ─── Main component ────────────────────────────────────────────────────────────
const GeminiUsageDashboard = forwardRef<GeminiUsageDashboardHandle, GeminiUsageDashboardProps>(
  function GeminiUsageDashboard(props, ref) {
    void props.countryCode

    const [preset, setPreset] = useState<PeriodPreset>('month')
    const dr = defaultCustomRange()
    const [customFrom, setCustomFrom] = useState(dr.from)
    const [customTo, setCustomTo] = useState(dr.to)

    const [data, setData] = useState<UsageData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const load = useCallback(async () => {
      setLoading(true)
      setError(null)

      try {
        const qs = new URLSearchParams()

        if (preset === 'today') {
          const now = new Date()
          qs.set('after', startOfLocalDay(now).toISOString())
          qs.set('before', now.toISOString())
        } else if (preset === 'custom') {
          const f = customFrom.trim().slice(0, 10)
          const t = customTo.trim().slice(0, 10)
          if (
            !/^\d{4}-\d{2}-\d{2}$/.test(f) ||
            !/^\d{4}-\d{2}-\d{2}$/.test(t) ||
            f > t
          ) {
            setError('Intervallo non valido: controlla le date Da / A.')
            setLoading(false)
            return
          }
          qs.set('from', f)
          qs.set('to', t)
        } else {
          const range = presetDateRangeUk(preset)
          qs.set('from', range.from)
          qs.set('to', range.to)
        }

        const res = await fetch(`/api/admin/ai-usage?${qs.toString()}`)
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'Errore caricamento')
        setData(json as UsageData)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Errore sconosciuto')
      } finally {
        setLoading(false)
      }
    }, [preset, customFrom, customTo])

  useImperativeHandle(ref, () => ({ refresh: load }), [load])

    useEffect(() => {
      load()
    }, [load])

    return (
    <div className="app-card overflow-hidden">
      <div className="app-workspace-inset-bg-soft px-5 pb-5 pt-5">
        {loading && !data && (
          <div className="flex items-center justify-center py-10">
            <svg
              className="h-5 w-5 animate-spin text-app-fg-muted"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          </div>
        )}

        {error && (
          <div
            className="rounded-lg px-4 py-3 text-[12px]"
            style={{
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              color: '#f87171',
            }}
          >
            {error}
          </div>
        )}

        {data && (
          <div className="flex flex-col gap-4">
            {/* Period filter */}
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-app-fg-muted">
                  Periodo
                </span>
                {(
                  [
                    ['today', 'Oggi'],
                    ['week', 'Settimana'],
                    ['month', 'Mese'],
                    ['last90', 'Ultimi 3 mesi'],
                    ['fy_curr_uk', 'Anno fiscale UK (corrente)'],
                    ['fy_prev_uk', 'Anno fiscale UK (precedente)'],
                    ['custom', 'Personalizzato'],
                  ] as const satisfies ReadonlyArray<readonly [PeriodPreset, string]>
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPreset(key)}
                    className="rounded-lg px-2.5 py-1.5 text-[11px] font-medium leading-tight transition-colors sm:px-3 sm:text-[12px]"
                    style={{
                      background:
                        preset === key ? 'rgba(34, 211, 238, 0.18)' : 'rgba(15, 42, 74, 0.5)',
                      border:
                        preset === key
                          ? '1px solid rgba(34, 211, 238, 0.45)'
                          : '1px solid rgba(34, 211, 238, 0.12)',
                      color: preset === key ? '#e0f9ff' : 'rgba(148, 163, 184, 0.95)',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {preset === 'custom' && (
                <div className="flex flex-wrap items-end gap-3 rounded-lg px-1 py-2">
                  <label className="flex flex-col gap-1 text-[11px] text-app-fg-muted">
                    Da (inclusivo)
                    <input
                      type="date"
                      value={customFrom}
                      className="min-w-[10.5rem] rounded-md px-2 py-1 font-mono text-[12px] text-app-fg"
                      style={{
                        background: 'rgba(15, 42, 74, 0.85)',
                        border: '1px solid rgba(34, 211, 238, 0.25)',
                      }}
                      onChange={(ev) => setCustomFrom(ev.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[11px] text-app-fg-muted">
                    A (inclusivo)
                    <input
                      type="date"
                      value={customTo}
                      className="min-w-[10.5rem] rounded-md px-2 py-1 font-mono text-[12px] text-app-fg"
                      style={{
                        background: 'rgba(15, 42, 74, 0.85)',
                        border: '1px solid rgba(34, 211, 238, 0.25)',
                      }}
                      onChange={(ev) => setCustomTo(ev.target.value)}
                    />
                  </label>
                </div>
              )}

              {data.period && (
                <p className="text-right font-mono text-[11px] text-app-fg-muted">
                  {fmtPeriodSummary(data.period)}
                </p>
              )}
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard
                label="Scansioni totali"
                value={fmt(data.totalCalls)}
                sub="documenti OCR"
              />
              <StatCard
                label="Token totali"
                value={fmt(data.totalTokens)}
                sub={`${fmt(data.totalInputTokens)} in + ${fmt(data.totalOutputTokens)} out`}
                accent="#a78bfa"
              />
              <StatCard
                label="Costo totale"
                value={fmtCost(data.totalCostUsd)}
                sub="USD stimato"
                accent="#34d399"
              />
              <StatCard
                label="Costo per scan"
                value={fmtCost(data.avgCostPerScan)}
                sub="media per scansione"
                accent="#f59e0b"
              />
            </div>

            {/* Pricing info */}
            {data.pricing && (
              <div
                className="rounded-lg px-4 py-2.5 text-[11px]"
                style={{
                  background: 'rgba(34, 211, 238, 0.05)',
                  border: '1px solid rgba(34, 211, 238, 0.12)',
                  color: 'rgba(34,211,238,0.7)',
                }}
              >
                Prezzi {data.model}: ${data.pricing.inputPerMillion}/M token input &middot; $
                {data.pricing.outputPerMillion}/M token output
              </div>
            )}

            {/* Bar chart */}
            {data.daily.length > 0 && <MiniBarChart daily={data.daily} />}

            {/* Empty state */}
            {data.totalCalls === 0 && (
              <div
                className="rounded-xl px-5 py-8 text-center"
                style={{
                  background: 'rgba(15, 42, 74, 0.4)',
                  border: '1px solid rgba(34, 211, 238, 0.10)',
                }}
              >
                <p className="text-[13px] text-app-fg-muted">
                  Nessuna scansione registrata ancora.
                </p>
                <p className="mt-1 text-[11px] text-app-fg-muted opacity-60">
                  I consumi Gemini vengono registrati dopo ogni OCR (scanner, sync email, estratti, ecc.).
                </p>
              </div>
            )}

            {/* Per-sede breakdown */}
            {data.perSede && data.perSede.length > 0 && (
              <div
                className="overflow-hidden rounded-xl"
                style={{
                  background: 'rgba(15, 42, 74, 0.4)',
                  border: '1px solid rgba(34, 211, 238, 0.12)',
                }}
              >
                <div className="px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-app-fg-muted">
                    Costi per sede
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr
                        style={{
                          borderTop: '1px solid rgba(34,211,238,0.08)',
                          borderBottom: '1px solid rgba(34,211,238,0.08)',
                        }}
                      >
                        <th className="px-4 py-2 text-left font-medium text-app-fg-muted">
                          Sede
                        </th>
                        <th className="px-4 py-2 text-right font-medium text-app-fg-muted">
                          Scansioni
                        </th>
                        <th className="px-4 py-2 text-right font-medium text-app-fg-muted">
                          Token totali
                        </th>
                        <th className="px-4 py-2 text-right font-medium text-app-fg-muted">
                          Costo (USD)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.perSede.map((sede, i) => (
                        <tr
                          key={i}
                          className="transition-colors hover:bg-white/5"
                          style={{ borderBottom: '1px solid rgba(34,211,238,0.06)' }}
                        >
                          <td className="px-4 py-2 text-app-fg">{sede.nome}</td>
                          <td className="px-4 py-2 text-right font-mono text-app-fg-muted">
                            {fmt(sede.calls)}
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-app-fg-muted">
                            {fmt(sede.totalTokens)}
                          </td>
                          <td
                            className="px-4 py-2 text-right font-mono"
                            style={{ color: '#34d399' }}
                          >
                            {fmtCost(sede.costUsd)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Recent calls table */}
            {data.recent.length > 0 && (
              <div
                className="overflow-hidden rounded-xl"
                style={{
                  background: 'rgba(15, 42, 74, 0.4)',
                  border: '1px solid rgba(34, 211, 238, 0.12)',
                }}
              >
                <div className="px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-app-fg-muted">
                    Ultime scansioni ({data.recent.length})
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr
                        style={{
                          borderTop: '1px solid rgba(34,211,238,0.08)',
                          borderBottom: '1px solid rgba(34,211,238,0.08)',
                        }}
                      >
                        <th className="px-4 py-2 text-left font-medium text-app-fg-muted">
                          Data
                        </th>
                        <th className="px-4 py-2 text-left font-medium text-app-fg-muted">
                          Tipo
                        </th>
                        <th className="px-4 py-2 text-right font-medium text-app-fg-muted">
                          Input
                        </th>
                        <th className="px-4 py-2 text-right font-medium text-app-fg-muted">
                          Output
                        </th>
                        <th className="px-4 py-2 text-right font-medium text-app-fg-muted">
                          Costo
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recent.map((row, i) => (
                        <tr
                          key={i}
                          className="transition-colors hover:bg-white/5"
                          style={{
                            borderBottom: '1px solid rgba(34,211,238,0.06)',
                          }}
                        >
                          <td className="px-4 py-2 text-app-fg-muted">{fmtDate(row.created_at)}</td>
                          <td className="px-4 py-2 text-app-fg">
                            {row.intent || row.operation}
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-app-fg-muted">
                            {fmt(row.inputTokens)}
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-app-fg-muted">
                            {fmt(row.outputTokens)}
                          </td>
                          <td
                            className="px-4 py-2 text-right font-mono"
                            style={{ color: '#34d399' }}
                          >
                            {fmtCost(row.estimatedCostUsd)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
})

export default GeminiUsageDashboard
