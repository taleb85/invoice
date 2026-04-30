'use client'

import Link from 'next/link'
import type { OperatorDashboardKpis, ScannerFlowDaySummary } from '@/lib/dashboard-operator-kpis'
import type { Translations } from '@/lib/translations'
import { withFiscalYearQuery } from '@/lib/fiscal-link'

const AURORA_HOME_SECTION_CLASS =
  'relative flex w-full min-w-0 flex-col min-h-0 app-card-unified overflow-hidden rounded-2xl'

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
