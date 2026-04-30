'use client'
import { useEffect, useState } from 'react'
import { useT } from '@/lib/use-t'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts'
import { KpiCard } from './kpi-card'
import type { AnalyticsOverview } from '@/app/api/analytics/overview/route'

/** Tick assi — contrasto alto (SVG `<text>`: niente classe Tailwind). */
const CHART_AXIS_TICK_FONT_FAMILY =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'

const chartAxisTick = (
  fontSize: number,
): { fill: string; fontSize: number; fontWeight: number; fontFamily: string } => ({
  fill: 'rgba(255,255,255,0.86)',
  fontSize,
  fontWeight: 600,
  fontFamily: CHART_AXIS_TICK_FONT_FAMILY,
})

const GRID_COLOR = 'rgba(255,255,255,0.06)'
const CYAN = '#22d3ee'
const PURPLE = '#818cf8'

/** Colori diversi per ogni barra del grafico „Top fornitori“ (ciclo se ci sono più righe del palette). */
const ANALYTICS_TOP_SUPPLIER_BAR_COLORS = [
  '#22d3ee',
  '#818cf8',
  '#34d399',
  '#fbbf24',
  '#f472b6',
  '#38bdf8',
  '#c084fc',
  '#2dd4bf',
  '#fb923c',
  '#a5b4fc',
] as const

function fmt(n: number, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(n)
}

function fmtShort(n: number) {
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `£${(n / 1_000).toFixed(0)}k`
  return `£${n.toFixed(0)}`
}

type Props = {
  sedeId?: string | null
  fiscalYear?: number | null
  months?: number
}

const chartCardClass =
  'relative overflow-hidden rounded-2xl border border-[rgba(34,211,238,0.15)] bg-transparent px-5 pt-5 pb-4'

export function AnalyticsDashboard({ sedeId, fiscalYear, months = 6 }: Props) {
  const t = useT()
  const [data, setData] = useState<AnalyticsOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ months: String(months) })
    if (sedeId) params.set('sede_id', sedeId)
    if (fiscalYear) params.set('fy', String(fiscalYear))
    fetch(`/api/analytics/overview?${params}`)
      .then(async (r) => {
        if (r.ok) return r.json() as Promise<AnalyticsOverview>
        const body = await r.text().catch(() => '')
        return Promise.reject(new Error(`HTTP ${r.status}: ${body || t.appStrings.analyticsErrorLoading}`))
      })
      .then((d: AnalyticsOverview) => setData(d))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [sedeId, fiscalYear, months, t.appStrings.analyticsErrorLoading])

  if (loading) {
    return (
      <div className="space-y-6">
        {/* KPI skeleton */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-2xl border border-[rgba(34,211,238,0.15)] bg-sky-500/5"
            />
          ))}
        </div>
        {/* Chart skeletons */}
        <div className="grid gap-4 lg:grid-cols-2">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className={`h-[280px] animate-pulse rounded-2xl border border-[rgba(34,211,238,0.15)] bg-sky-500/5 ${i === 0 ? 'lg:col-span-2' : ''}`}
            />
          ))}
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-white/85">{error ?? t.appStrings.analyticsNoData}</p>
      </div>
    )
  }

  const totaleImporto = data.spesaMensile.reduce((s, m) => s + m.importo, 0)
  const anomalieNonRisolte = data.anomaliePrezzi.totale - data.anomaliePrezzi.risolte

  const tooltipStyle = {
    backgroundColor: '#1e2d4a',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    color: '#e2e8f0',
    fontSize: 12,
  }

  return (
    <div className="space-y-6">
      {/* ── KPI Cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          title={t.appStrings.analyticsKpiTotalInvoiced}
          value={fmt(totaleImporto)}
          subtitle={t.appStrings.analyticsKpiNFatture.replace('{n}', String(data.spesaMensile.reduce((s, m) => s + m.fatture, 0)))}
          color="cyan"
        />
        <KpiCard
          title={t.appStrings.analyticsKpiReconciliation}
          value={`${data.riconciliazione.percentuale}%`}
          subtitle={t.appStrings.analyticsKpiCompleted.replace('{n}', String(data.riconciliazione.completate))}
          trend={
            data.riconciliazione.percentuale >= 80
              ? 'up'
              : data.riconciliazione.percentuale >= 50
                ? 'neutral'
                : 'down'
          }
          trendValue={`${data.riconciliazione.completate}/${data.riconciliazione.completate + data.riconciliazione.inAttesa}`}
          color={
            data.riconciliazione.percentuale >= 80
              ? 'green'
              : data.riconciliazione.percentuale >= 50
                ? 'amber'
                : 'red'
          }
        />
        <KpiCard
          title={t.appStrings.analyticsKpiAvgTime}
          value={t.appStrings.analyticsKpiDays.replace('{n}', String(data.tempoMedioRiconciliazione))}
          subtitle={t.appStrings.analyticsKpiDaysFrom}
          color={data.tempoMedioRiconciliazione > 14 ? 'amber' : 'cyan'}
          trend={data.tempoMedioRiconciliazione > 14 ? 'down' : 'up'}
          trendValue={data.tempoMedioRiconciliazione > 14 ? t.appStrings.analyticsKpiSlow : t.appStrings.analyticsKpiOk}
        />
        <KpiCard
          title={t.appStrings.analyticsKpiPriceAnomalies}
          value={String(anomalieNonRisolte)}
          subtitle={t.appStrings.analyticsKpiResolvedOf.replace('{n}', String(data.anomaliePrezzi.risolte)).replace('{total}', String(data.anomaliePrezzi.totale))}
          color={anomalieNonRisolte > 0 ? 'red' : 'green'}
          trend={anomalieNonRisolte > 0 ? 'down' : 'up'}
          trendValue={anomalieNonRisolte > 0 ? t.appStrings.analyticsKpiToCheck : t.appStrings.analyticsKpiAllOk}
        />
      </div>

      {/* ── Charts ────────────────────────────────────────────────── */}

      {/* Chart 1: Spesa mensile — full width */}
      <div className={chartCardClass}>
        <h3 className="mb-4 text-sm font-semibold text-white">{t.appStrings.analyticsChartMonthlySpend}</h3>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data.spesaMensile} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="spesaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CYAN} stopOpacity={0.35} />
                <stop offset="95%" stopColor={CYAN} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
            <XAxis
              dataKey="mese"
              tick={chartAxisTick(12)}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={fmtShort}
              tick={chartAxisTick(12)}
              axisLine={false}
              tickLine={false}
              width={52}
            />
            <Tooltip
              formatter={(value, name) => [
                name === 'importo' ? fmt(Number(value ?? 0)) : value,
                name === 'importo' ? t.appStrings.analyticsChartAmount : t.appStrings.analyticsChartInvoices,
              ]}
              contentStyle={tooltipStyle}
              cursor={{ stroke: CYAN, strokeWidth: 1, strokeOpacity: 0.3 }}
            />
            <Area
              type="monotone"
              dataKey="importo"
              stroke={CYAN}
              strokeWidth={2}
              fill="url(#spesaGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Chart 2: Top fornitori */}
        <div className={chartCardClass}>
          <h3 className="mb-4 text-sm font-semibold text-white">{t.appStrings.analyticsChartTopSuppliers}</h3>
          {data.topFornitori.length === 0 ? (
            <div className="flex h-[220px] items-center justify-center text-xs text-white/82">
              {t.appStrings.analyticsChartNoData}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                layout="vertical"
                data={data.topFornitori}
                margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={fmtShort}
                  tick={chartAxisTick(12)}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="nome"
                  width={92}
                  tick={chartAxisTick(11)}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: string) => (v.length > 14 ? v.slice(0, 13) + '…' : v)}
                />
                <Tooltip
                  formatter={(value) => [fmt(Number(value ?? 0)), t.appStrings.analyticsChartAmount]}
                  contentStyle={tooltipStyle}
                  cursor={{ fill: 'rgba(255,255,255,0.06)' }}
                />
                <Bar
                  dataKey="importo"
                  radius={[0, 4, 4, 0]}
                  name={t.appStrings.analyticsChartAmount}
                >
                  {data.topFornitori.map((_, idx) => (
                    <Cell
                      key={`top-fornitore-${idx}`}
                      fill={ANALYTICS_TOP_SUPPLIER_BAR_COLORS[idx % ANALYTICS_TOP_SUPPLIER_BAR_COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Chart 3: Bolle vs Fatture */}
        <div className={chartCardClass}>
          <h3 className="mb-4 text-sm font-semibold text-white">{t.appStrings.analyticsChartBolleVsFatture}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart
              data={data.andamentoBolle}
              margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
              <XAxis
                dataKey="mese"
                tick={chartAxisTick(12)}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={chartAxisTick(12)}
                axisLine={false}
                tickLine={false}
                width={32}
                allowDecimals={false}
              />
              <Tooltip
                formatter={(value, name) => [value, name === 'bolle' ? t.appStrings.analyticsChartDeliveryNotes : t.appStrings.analyticsChartInvoices]}
                contentStyle={tooltipStyle}
              />
              <Legend
                wrapperStyle={{
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: CHART_AXIS_TICK_FONT_FAMILY,
                  color: 'rgba(255,255,255,0.88)',
                }}
                formatter={(v) => (v === 'bolle' ? t.appStrings.analyticsChartDeliveryNotes : t.appStrings.analyticsChartInvoices)}
              />
              <Line
                type="monotone"
                dataKey="bolle"
                stroke={CYAN}
                strokeWidth={2}
                dot={{ fill: CYAN, r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="fatture"
                stroke={PURPLE}
                strokeWidth={2}
                dot={{ fill: PURPLE, r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <div className="relative overflow-hidden rounded-2xl border border-[rgba(34,211,238,0.15)] bg-transparent px-4 pb-3 pt-3.5">
          <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-sky-500 via-sky-400 to-sky-600" aria-hidden />
          <p className="text-[11px] uppercase tracking-wider text-white/85">{t.appStrings.analyticsSummaryPendingDocs}</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-white">{data.documentiPendenti}</p>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-[rgba(34,211,238,0.15)] bg-transparent px-4 pb-3 pt-3.5">
          <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-sky-500 via-sky-400 to-sky-600" aria-hidden />
          <p className="text-[11px] uppercase tracking-wider text-white/85">{t.appStrings.analyticsSummaryPendingNotes}</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-white">{data.riconciliazione.inAttesa}</p>
        </div>
        <div className="relative col-span-2 overflow-hidden rounded-2xl border border-[rgba(34,211,238,0.15)] bg-transparent px-4 pb-3 pt-3.5 lg:col-span-1">
          <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-sky-500 via-sky-400 to-sky-600" aria-hidden />
          <p className="text-[11px] uppercase tracking-wider text-white/85">{t.appStrings.analyticsSummaryArchivedInvoices}</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-white">
            {data.spesaMensile.reduce((s, m) => s + m.fatture, 0)}
          </p>
        </div>
      </div>
    </div>
  )
}
