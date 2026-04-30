'use client'

import type { OperatorDashboardKpis, ScannerFlowDaySummary } from '@/lib/dashboard-operator-kpis'
import type { Translations } from '@/lib/translations'

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
