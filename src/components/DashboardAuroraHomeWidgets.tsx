'use client'

import Link from 'next/link'
import { useMemo, type CSSProperties } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import type { DashboardHomeMonthlyPoint, OperatorDashboardKpis, ScannerFlowDaySummary } from '@/lib/dashboard-operator-kpis'
import type { Translations, Locale } from '@/lib/translations'
import { formatCurrency } from '@/lib/locale-shared'
import { withFiscalYearQuery } from '@/lib/fiscal-link'

const AURORA_HOME_SECTION_CLASS =
  'relative flex w-full min-w-0 flex-col min-h-0 app-card-unified overflow-hidden rounded-2xl'

const CHART_AXIS = { fill: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: 600 }

const TOOLTIP_SHELL: CSSProperties = {
  backgroundColor: 'rgba(15,23,42,0.94)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 12,
  padding: '10px 12px',
  color: '#f1f5f9',
}

type TrendProps = {
  points: DashboardHomeMonthlyPoint[]
  t: Translations
  locale: Locale
  currency: string
  analyticsHref: string
  fiscalHint?: string | null
}

export function DashboardMonthlyTrendGlassCard({
  points,
  t,
  locale,
  currency,
  analyticsHref,
  fiscalHint,
}: TrendProps) {
  const data = useMemo(() => {
    const maxS = Math.max(...points.map((p) => p.spend), 1)
    const maxB = Math.max(...points.map((p) => p.bolle), 1)
    const maxF = Math.max(...points.map((p) => p.fatture), 1)
    return points.map((p) => ({
      ...p,
      nSpend: Math.round((p.spend / maxS) * 1000) / 10,
      nBolle: Math.round((p.bolle / maxB) * 1000) / 10,
      nFatture: Math.round((p.fatture / maxF) * 1000) / 10,
    }))
  }, [points])

  const barSlice = useMemo(() => {
    const slice = points.slice(-6)
    const m = Math.max(...slice.map((p) => p.spend), 1)
    return slice.map((p) => ({
      key: p.key,
      label: p.label,
      pct: Math.max(14, Math.round((p.spend / m) * 100)),
      fill: p.spend >= m * 0.85 ? '#22d3ee' : '#a3e635',
    }))
  }, [points])

  const hasData = points.some((p) => p.spend > 0 || p.bolle > 0 || p.fatture > 0)

  type Row = (typeof data)[number]

  return (
    <section className={AURORA_HOME_SECTION_CLASS} aria-label={t.dashboard.homeMonthlyTrendTitle}>
      <div className="flex flex-col gap-3 border-b border-white/10 px-4 pt-4 pb-3 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-x-4 md:gap-y-2 md:px-5 md:pt-5 md:pb-4">
        <div className="min-w-0">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
            {t.dashboard.homeMonthlyTrendTitle}
          </h2>
          {fiscalHint ? <p className="mt-1 text-[11px] text-cyan-200/80">{fiscalHint}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <Link
            href={analyticsHref}
            className="rounded-lg border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/80 backdrop-blur-md transition hover:border-white/22 hover:bg-white/[0.07]"
          >
            {t.dashboard.homeMonthlyTrendCompareAnalytics}
          </Link>
          <span
            role="button"
            tabIndex={0}
            aria-disabled
            title={t.dashboard.homeMonthlyTrendExportDemoAria}
            className="cursor-not-allowed rounded-lg bg-[#38bdf8] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-950 opacity-75 shadow-[0_0_22px_-4px_rgba(34,211,238,0.55)]"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') e.preventDefault()
            }}
          >
            {t.dashboard.homeMonthlyTrendExportDemo}
          </span>
        </div>
      </div>
      <div className="flex min-h-[220px] flex-col gap-3 p-3 sm:min-h-[240px] md:flex-row md:p-4 lg:min-h-[260px] lg:gap-4">
        <div className="min-h-[180px] min-w-0 flex-1 md:min-h-[200px]">
          {hasData ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="4 6" vertical={false} />
                <XAxis dataKey="label" tick={CHART_AXIS} tickLine={false} axisLine={false} />
                <YAxis hide domain={[0, 100]} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const row = payload[0]?.payload as Row | undefined
                    if (!row) return null
                    return (
                      <div style={TOOLTIP_SHELL}>
                        <p className="mb-2 text-[11px] font-semibold text-white/90">{row.label}</p>
                        <ul className="space-y-1 text-[11px]">
                          <li className="flex justify-between gap-6">
                            <span className="text-white/55">{t.dashboard.homeChartLegendSpend}</span>
                            <span className="font-mono tabular-nums text-cyan-200">
                              {formatCurrency(row.spend, currency, locale)}
                            </span>
                          </li>
                          <li className="flex justify-between gap-6">
                            <span className="text-white/55">{t.dashboard.homeChartLegendBolle}</span>
                            <span className="tabular-nums text-lime-200">{row.bolle}</span>
                          </li>
                          <li className="flex justify-between gap-6">
                            <span className="text-white/55">{t.dashboard.homeChartLegendFatture}</span>
                            <span className="tabular-nums text-amber-200">{row.fatture}</span>
                          </li>
                        </ul>
                      </div>
                    )
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="nSpend"
                  stroke="#22d3ee"
                  strokeWidth={2.25}
                  dot={false}
                  activeDot={{ r: 4 }}
                  style={{ filter: 'drop-shadow(0 0 10px rgba(34,211,238,0.45))' }}
                />
                <Line
                  type="monotone"
                  dataKey="nBolle"
                  stroke="#a3e635"
                  strokeWidth={2.25}
                  dot={false}
                  activeDot={{ r: 4 }}
                  style={{ filter: 'drop-shadow(0 0 10px rgba(163,230,53,0.4))' }}
                />
                <Line
                  type="monotone"
                  dataKey="nFatture"
                  stroke="#facc15"
                  strokeWidth={2.25}
                  dot={false}
                  activeDot={{ r: 4 }}
                  style={{ filter: 'drop-shadow(0 0 10px rgba(250,204,21,0.38))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full min-h-[12rem] items-center justify-center rounded-xl border border-white/10 bg-black/20 px-4 text-center text-sm text-white/50">
              {t.dashboard.homeEmptyMonthlyTrend}
            </div>
          )}
        </div>
        {hasData && barSlice.length > 0 ? (
          <div
            className="flex h-36 shrink-0 flex-row items-end justify-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-3"
            aria-hidden
          >
            {barSlice.map((b) => (
              <div key={b.key} className="flex h-full w-7 flex-col justify-end" title={b.label}>
                <div
                  className="w-full rounded-t-sm"
                  style={{
                    height: `${b.pct}px`,
                    maxHeight: 120,
                    backgroundColor: b.fill,
                    boxShadow: `0 0 12px ${b.fill === '#22d3ee' ? 'rgba(34,211,238,0.35)' : 'rgba(163,230,53,0.3)'}`,
                  }}
                />
              </div>
            ))}
          </div>
        ) : null}
      </div>
      {hasData ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/10 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-white/45 md:px-5">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]" />
            {t.dashboard.homeChartLegendSpend}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-lime-400 shadow-[0_0_8px_rgba(163,230,53,0.5)]" />
            {t.dashboard.homeChartLegendBolle}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_8px_rgba(250,204,21,0.45)]" />
            {t.dashboard.homeChartLegendFatture}
          </span>
        </div>
      ) : null}
    </section>
  )
}

type SmartProps = {
  kpis: OperatorDashboardKpis
  scanner: ScannerFlowDaySummary
  t: Translations
}

function riskFromKpis(k: OperatorDashboardKpis): 'low' | 'medium' | 'high' {
  const load = k.documentiDaRevisionare + k.statementsWithIssues + k.duplicatiCount + k.duplicatiBolleCount
  if (load > 24) return 'high'
  if (load > 6) return 'medium'
  return 'low'
}

export function DashboardSmartPairRiskGlass({ kpis, scanner, t }: SmartProps) {
  const totalBolle = Math.max(1, kpis.bolleTotal)
  const matchedPct = Math.min(100, Math.round(((totalBolle - kpis.bolleInAttesa) / totalBolle) * 100))
  const risk = riskFromKpis(kpis)
  const riskLabel =
    risk === 'low'
      ? t.dashboard.homeRiskLow
      : risk === 'medium'
        ? t.dashboard.homeRiskMedium
        : t.dashboard.homeRiskHigh
  const riskClass =
    risk === 'low'
      ? 'text-lime-400 [text-shadow:0_0_20px_rgba(163,230,53,0.45)]'
      : risk === 'medium'
        ? 'text-amber-300 [text-shadow:0_0_18px_rgba(252,211,77,0.4)]'
        : 'text-orange-400 [text-shadow:0_0_18px_rgba(251,146,60,0.45)]'
  const subtitle = t.dashboard.homeSmartPairMatchedLine.replace(/\{pct\}/g, String(matchedPct))

  return (
    <section className={AURORA_HOME_SECTION_CLASS}>
      <div className="flex flex-col gap-4 p-4 md:flex-row md:items-stretch md:gap-5 md:p-5">
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-3">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">
            {t.dashboard.homeSmartPairTitle}
          </h2>
          <p className="text-4xl font-bold tabular-nums text-white [text-shadow:0_0_24px_rgba(255,255,255,0.12)] md:text-5xl">
            {matchedPct}%
          </p>
          <p className="text-xs text-white/55">{subtitle}</p>
          <div className="relative h-3 w-full overflow-hidden rounded-full bg-white/[0.08] ring-1 ring-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-lime-400"
              style={{
                width: `${matchedPct}%`,
                boxShadow: '0 0 18px rgba(34,211,238,0.45), 0 0 28px rgba(163,230,53,0.25)',
              }}
            />
          </div>
          <p className="text-[11px] text-white/40">
            {t.dashboard.scannerFlowAiElaborate}: {scanner.aiElaborate} · {t.dashboard.scannerFlowArchived}:{' '}
            {scanner.archiviate}
          </p>
        </div>
        <div className="flex w-full shrink-0 flex-col justify-center rounded-xl border border-white/10 bg-black/[0.26] px-4 py-4 shadow-[inset_0_1px_0_rgb(255_255_255/0.05)] backdrop-blur-md md:w-[13.5rem]">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
            {t.dashboard.homeRiskSynthTitle}
          </p>
          <p className={`mt-2 text-center text-xl font-black uppercase md:text-2xl ${riskClass}`}>{riskLabel}</p>
        </div>
      </div>
    </section>
  )
}

function DiamondIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3l8 10-8 8-8-8 8-10z"
        fill="currentColor"
        opacity={0.9}
      />
      <path
        d="M12 7l5 7-5 6-5-6 5-7z"
        fill="#38bdf8"
        opacity={0.9}
      />
    </svg>
  )
}

type PriorityProps = {
  kpis: OperatorDashboardKpis
  fiscalYear: number
  t: Translations
}

export function DashboardPrioritaGlassPanel({ kpis, fiscalYear, t }: PriorityProps) {
  const anomalyParams = kpis.statementsWithIssues > 0 ? ({ stato: 'anomalia' as const }) : undefined
  const items: Array<{
    title: string
    sub: string
    href: string
    muted: boolean
  }> = [
    {
      title: t.dashboard.homePriorityDupInvoices,
      href: '/impostazioni',
      muted: kpis.duplicatiCount === 0,
      sub:
        kpis.duplicatiCount === 0
          ? t.dashboard.homePriorityAllClearSubtitle
          : t.dashboard.homePrioritySubtitleWithCount.replace('{n}', String(kpis.duplicatiCount)),
    },
    {
      title: t.dashboard.homePriorityDupBolle,
      href: withFiscalYearQuery('/bolle', fiscalYear, { tutte: '1' }),
      muted: kpis.duplicatiBolleCount === 0,
      sub:
        kpis.duplicatiBolleCount === 0
          ? t.dashboard.homePriorityAllClearSubtitle
          : t.dashboard.homePrioritySubtitleWithCount.replace('{n}', String(kpis.duplicatiBolleCount)),
    },
    {
      title: t.dashboard.homePriorityRevision,
      href: withFiscalYearQuery('/revisione', fiscalYear),
      muted: kpis.documentiDaRevisionare === 0,
      sub:
        kpis.documentiDaRevisionare === 0
          ? t.dashboard.homePriorityAllClearSubtitle
          : t.dashboard.homePrioritySubtitleWithCount.replace('{n}', String(kpis.documentiDaRevisionare)),
    },
    {
      title: t.dashboard.homePriorityStatements,
      href: withFiscalYearQuery('/statements/verifica', fiscalYear, anomalyParams),
      muted: kpis.statementsWithIssues === 0,
      sub:
        kpis.statementsWithIssues === 0
          ? t.dashboard.homePriorityAllClearSubtitle
          : t.dashboard.homePrioritySubtitleWithCount.replace('{n}', String(kpis.statementsWithIssues)),
    },
  ]

  return (
    <aside className={AURORA_HOME_SECTION_CLASS}>
      <div className="border-b border-white/10 px-4 py-3.5 md:px-5">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">
          {t.dashboard.homePrioritiesTitle}
        </h2>
      </div>
      <ul className="divide-y divide-white/[0.07] px-3 py-1 md:px-4 md:py-2">
        {items.map((it) => (
          <li key={it.title}>
            <Link
              href={it.href}
              className={`group flex gap-3 px-2 py-3 transition md:rounded-xl md:py-3.5 ${
                it.muted
                  ? 'opacity-[0.72] hover:bg-white/[0.03]'
                  : 'hover:bg-white/[0.06] active:bg-white/[0.08]'
              }`}
            >
              <DiamondIcon className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300 drop-shadow-[0_0_10px_rgba(56,189,248,0.55)]" />
              <div className="min-w-0">
                <p className="font-semibold text-white">{it.title}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-white/42 group-hover:text-white/55">{it.sub}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  )
}
