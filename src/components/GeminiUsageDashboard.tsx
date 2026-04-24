'use client'

import { useEffect, useState, useCallback } from 'react'

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
        Ultimi 7 giorni — Scansioni
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

// ─── Main component ────────────────────────────────────────────────────────────
export default function GeminiUsageDashboard() {
  const [data, setData] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/gemini/usage')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Errore caricamento')
      setData(json as UsageData)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore sconosciuto')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="app-card overflow-hidden">
      {/* Header bar */}
      <div className="app-card-bar" />

      {/* Card header */}
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1"
            style={{
              background: 'rgba(34, 211, 238, 0.10)',
              outline: '1px solid rgba(34, 211, 238, 0.25)',
            }}
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              style={{ color: '#22d3ee' }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.6}
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-app-fg">Consumi Gemini AI</h3>
            <p className="text-[11px] text-app-fg-muted">
              {data?.model ?? 'gemini-2.5-flash-lite'} — Scansioni OCR
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-white/5 disabled:opacity-40"
          aria-label="Aggiorna dati"
        >
          <svg
            className={`h-4 w-4 text-app-fg-muted ${loading ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>

      <div className="app-workspace-inset-bg-soft px-5 pb-5">
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
                  I dati vengono raccolti dalle scansioni manuali nello scanner.
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
}
