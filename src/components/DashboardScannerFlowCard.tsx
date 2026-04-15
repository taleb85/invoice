import type { ScannerFlowDaySummary } from '@/lib/dashboard-operator-kpis'
import type { Translations } from '@/lib/translations'

/** Stesso filo visivo della voce «Scanner AI» in `DashboardMobileBottomNav` (gradiente cyan/viola + alone). */
const SCANNER_FLOW_CARD_SHELL =
  'mt-3 overflow-hidden rounded-2xl border border-cyan-500/35 bg-gradient-to-b from-cyan-500/15 to-violet-500/10 text-cyan-100 shadow-[0_0_20px_-10px_rgba(6,182,212,0.42)]'

function ScannerFlowCardIntro({
  summary,
  t,
  todayLine,
}: {
  summary: ScannerFlowDaySummary
  t: Translations
  todayLine: string
}) {
  return (
    <>
      <h2 className="text-sm font-semibold text-cyan-50 md:text-base">{t.dashboard.scannerFlowCardTitle}</h2>
      <p className="mt-1 text-xs leading-snug text-cyan-100/85 md:text-sm md:leading-snug">{t.dashboard.scannerFlowCardHint}</p>
      <p className="mt-2 text-xs font-medium text-cyan-50">{todayLine}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 md:gap-3">
        <div className="flex flex-col items-center justify-center rounded-xl border border-white/15 bg-white/5 px-2 py-2.5 text-center md:py-3">
          <span className="text-2xl font-bold tabular-nums text-cyan-50 md:text-3xl">{summary.aiElaborate}</span>
          <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-cyan-100/80 md:text-xs">
            {t.dashboard.scannerFlowAiElaborate}
          </span>
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl border border-white/15 bg-white/5 px-2 py-2.5 text-center md:py-3">
          <span className="text-2xl font-bold tabular-nums text-cyan-50 md:text-3xl">{summary.archiviate}</span>
          <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-cyan-100/80 md:text-xs">
            {t.dashboard.scannerFlowArchived}
          </span>
        </div>
      </div>
    </>
  )
}

/**
 * Riepilogo giornaliero `scanner_flow_events` (flusso Scanner AI), stessa UI su tutti i breakpoint.
 */
export default function DashboardScannerFlowCard({
  summary,
  t,
}: {
  summary: ScannerFlowDaySummary
  t: Translations
}) {
  const todayLine = t.dashboard.scannerFlowTodayCounts
    .replace('{ai}', String(summary.aiElaborate))
    .replace('{arch}', String(summary.archiviate))

  return (
    <section
      className={`${SCANNER_FLOW_CARD_SHELL} px-4 py-3 md:px-6 md:py-4`}
      aria-label={t.dashboard.scannerFlowCardTitle}
    >
      <ScannerFlowCardIntro summary={summary} t={t} todayLine={todayLine} />
    </section>
  )
}
