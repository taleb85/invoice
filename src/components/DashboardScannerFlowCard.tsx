import Link from 'next/link'
import type { ScannerFlowDaySummary, ScannerFlowEventRow, ScannerFlowEventStep } from '@/lib/dashboard-operator-kpis'
import type { Translations } from '@/lib/translations'
import HubScannerIcon from '@/components/HubScannerIcon'

/** Bordo / alone come `scannerNavItemCls(false)` nella dock (titolo mobile, chip più grande). */
const SCANNER_FLOW_MOBILE_TITLE_FRAME =
  'rounded-2xl border border-cyan-500/35 bg-gradient-to-b from-cyan-500/15 to-violet-500/10 shadow-[0_0_24px_-8px_rgba(6,182,212,0.48)] ring-1 ring-inset ring-white/10'

export function scannerFlowStepLabel(step: ScannerFlowEventStep, t: Translations): string {
  switch (step) {
    case 'ai_elaborata':
      return t.dashboard.scannerFlowStepAiElaborata
    case 'archiviata_bolla':
      return t.dashboard.scannerFlowStepArchiviataBolla
    case 'archiviata_fattura':
      return t.dashboard.scannerFlowStepArchiviataFattura
    default: {
      const _x: never = step
      return _x
    }
  }
}

function ScannerFlowTodayActivity({
  events,
  formatEventTime,
  t,
  embedded,
}: {
  events: ScannerFlowEventRow[]
  formatEventTime: (iso: string) => string
  t: Translations
  embedded: boolean
}) {
  const border = embedded ? 'border-slate-600/50' : 'border-white/10'
  const titleCls = embedded ? 'text-slate-200' : 'text-cyan-100'
  const emptyCls = embedded ? 'text-slate-400' : 'text-cyan-50/95'
  const timeCls = embedded ? 'shrink-0 tabular-nums text-slate-400' : 'shrink-0 tabular-nums text-cyan-200/80'
  const descCls = embedded ? 'min-w-0 text-slate-200' : 'min-w-0 text-cyan-50/95'

  return (
    <div className={`mt-4 shrink-0 border-t pb-1 pt-4 ${border}`}>
      <h3 className={`text-xs font-semibold uppercase tracking-wide ${titleCls}`}>{t.dashboard.scannerFlowTodayActivityTitle}</h3>
      {events.length === 0 ? (
        <p className={`mt-2 text-xs leading-snug md:text-sm ${emptyCls}`}>{t.dashboard.scannerFlowNoEventsToday}</p>
      ) : (
        <ul className="mt-2 space-y-2.5">
          {events.map((e) => (
            <li key={e.id} className="flex gap-3 text-left text-xs leading-snug md:text-sm">
              <time className={timeCls} dateTime={e.created_at}>
                {formatEventTime(e.created_at)}
              </time>
              <span className={descCls}>{scannerFlowStepLabel(e.step, t)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export type DashboardScannerFlowHeaderLinks = {
  newScanHref: string
  eventsHref?: string
}

function ScannerFlowCardIntro({
  summary,
  t,
  events,
  formatEventTime,
  embedded,
  allEventsHref,
  headerLinks,
}: {
  summary: ScannerFlowDaySummary
  t: Translations
  events: ScannerFlowEventRow[]
  formatEventTime: (iso: string) => string
  embedded: boolean
  allEventsHref?: string
  headerLinks?: DashboardScannerFlowHeaderLinks
}) {
  const todayLine = t.dashboard.scannerFlowTodayCounts
    .replace('{ai}', String(summary.aiElaborate))
    .replace('{arch}', String(summary.archiviate))

  const kpiNumCls = embedded ? 'text-slate-50 md:text-3xl' : 'text-cyan-50 md:text-3xl'
  const kpiLabelCls = embedded ? 'text-slate-400 md:text-xs' : 'text-cyan-100/80 md:text-xs'
  const kpiBoxBorder = embedded ? 'border-slate-600/60' : 'border-white/15'
  const kpiBoxBg = embedded ? 'bg-slate-800/40' : 'bg-white/5'

  const eventsInHeader = Boolean(headerLinks?.eventsHref?.trim())
  const showFooterEventsLink = Boolean(allEventsHref?.trim()) && !eventsInHeader
  const newScanLabel = t.dashboard.scannerFlowOpenScanner
  const eventsLinkLabel = t.dashboard.scannerFlowEventsAllLink
  const scannerEventsLinkClass =
    'text-xs font-semibold text-cyan-200/95 hover:text-cyan-50 hover:underline sm:text-sm'

  return (
    <>
      {embedded ? (
        <>
          <h2 className="text-sm font-semibold text-slate-100 md:text-base">{t.dashboard.scannerFlowCardTitle}</h2>
          <p className="mt-1 text-xs leading-snug text-slate-300">{t.dashboard.scannerFlowCardHint}</p>
          <p className="mt-2 text-xs font-medium text-slate-200">{todayLine}</p>
        </>
      ) : (
        <div className="flex w-full flex-col gap-3 border-b border-white/10 pb-3 md:flex-row md:items-center md:justify-between md:pb-4">
          <div className="flex w-full justify-center md:justify-start">
            <h2
              className={`m-0 inline-flex max-w-full min-w-0 min-h-[52px] flex-col items-center justify-center gap-1 px-5 py-3 text-center font-normal sm:min-h-14 sm:gap-1.5 sm:px-7 sm:py-4 md:min-h-0 md:flex-row md:items-center md:justify-start md:gap-2 md:px-3 md:py-2 md:text-left ${SCANNER_FLOW_MOBILE_TITLE_FRAME} md:shadow-[0_0_14px_-10px_rgba(6,182,212,0.38)]`}
            >
              <HubScannerIcon className="h-7 w-7 shrink-0 text-cyan-200 drop-shadow-[0_0_12px_rgba(34,211,238,0.5)] sm:h-8 sm:w-8 md:h-5 md:w-5 md:drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]" aria-hidden />
              <span className="line-clamp-2 max-w-[18rem] text-center text-xs font-semibold leading-snug text-cyan-50 sm:max-w-[20rem] sm:text-sm md:line-clamp-1 md:max-w-none md:text-left md:text-xs [overflow-wrap:anywhere]">
                {t.nav.bottomNavScannerAi}
              </span>
            </h2>
          </div>
          {headerLinks &&
          (headerLinks.newScanHref?.trim() || headerLinks.eventsHref?.trim()) ? (
            <div className="flex shrink-0 flex-nowrap items-center justify-center gap-2 sm:gap-3 md:justify-end">
              {headerLinks.newScanHref?.trim() ? (
                <Link
                  href={headerLinks.newScanHref}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-white shadow-[0_0_16px_-4px_rgba(6,182,212,0.45)] transition-colors hover:bg-cyan-400"
                >
                  <HubScannerIcon className="h-3.5 w-3.5 shrink-0" />
                  {newScanLabel}
                </Link>
              ) : null}
              {headerLinks.eventsHref?.trim() ? (
                <Link
                  href={headerLinks.eventsHref}
                  className={`shrink-0 whitespace-nowrap ${scannerEventsLinkClass}`}
                >
                  {eventsLinkLabel}
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2 md:gap-3">
        <div
          className={`flex flex-col items-center justify-center rounded-xl border px-2 py-2.5 text-center md:py-3 ${kpiBoxBorder} ${kpiBoxBg}`}
        >
          <span className={`text-2xl font-bold tabular-nums md:text-3xl ${kpiNumCls}`}>{summary.aiElaborate}</span>
          <span className={`mt-0.5 text-[10px] font-medium uppercase tracking-wide ${kpiLabelCls}`}>
            {t.dashboard.scannerFlowAiElaborate}
          </span>
        </div>
        <div
          className={`flex flex-col items-center justify-center rounded-xl border px-2 py-2.5 text-center md:py-3 ${kpiBoxBorder} ${kpiBoxBg}`}
        >
          <span className={`text-2xl font-bold tabular-nums md:text-3xl ${kpiNumCls}`}>{summary.archiviate}</span>
          <span className={`mt-0.5 text-[10px] font-medium uppercase tracking-wide ${kpiLabelCls}`}>
            {t.dashboard.scannerFlowArchived}
          </span>
        </div>
      </div>
      {!embedded && showFooterEventsLink && allEventsHref ? (
        <div className="mt-3 flex justify-center border-t border-white/10 pt-3">
          <Link href={allEventsHref} className={scannerEventsLinkClass}>
            {eventsLinkLabel}
          </Link>
        </div>
      ) : null}
      {embedded ? (
        <ScannerFlowTodayActivity events={events} formatEventTime={formatEventTime} t={t} embedded />
      ) : null}
      {embedded && allEventsHref ? (
        <div className="mt-3 flex justify-center border-t border-slate-600/50 pt-3">
          <Link
            href={allEventsHref}
            className="text-xs font-semibold text-cyan-300 hover:text-cyan-100 hover:underline sm:text-sm"
          >
            {t.dashboard.scannerFlowEventsAllLink}
          </Link>
        </div>
      ) : null}
    </>
  )
}

export type DashboardScannerFlowCardVariant = 'section' | 'embedded'

/**
 * Riepilogo giornaliero `scanner_flow_events` (flusso Scanner AI).
 * - `section`: blocco autonomo (es. mobile).
 * - `embedded`: corpo dentro un contenitore esterno (es. card dashboard desktop).
 */
export default function DashboardScannerFlowCard({
  summary,
  events,
  formatEventTime,
  t,
  variant = 'section',
  allEventsHref,
  headerLinks,
}: {
  summary: ScannerFlowDaySummary
  events: ScannerFlowEventRow[]
  formatEventTime: (iso: string) => string
  t: Translations
  variant?: DashboardScannerFlowCardVariant
  /** Link alla pagina elenco eventi (storico). */
  allEventsHref?: string
  /** CTA accanto al titolo «AI Scanner» (es. nuova scansione + eventi). */
  headerLinks?: DashboardScannerFlowHeaderLinks
}) {
  const embedded = variant === 'embedded'

  if (embedded) {
    return (
      <div className="px-4 py-4 sm:px-6 sm:py-5" aria-label={t.dashboard.scannerFlowCardTitle}>
        <ScannerFlowCardIntro
          summary={summary}
          t={t}
          events={events}
          formatEventTime={formatEventTime}
          embedded
          allEventsHref={allEventsHref}
          headerLinks={undefined}
        />
      </div>
    )
  }

  return (
    <section className="app-card px-4 py-3 md:px-6 md:py-4">
      <ScannerFlowCardIntro
        summary={summary}
        t={t}
        events={events}
        formatEventTime={formatEventTime}
        embedded={false}
        allEventsHref={allEventsHref}
        headerLinks={headerLinks}
      />
    </section>
  )
}
