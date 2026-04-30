import Link from 'next/link'
import type { ScannerFlowDaySummary, ScannerFlowEventRow, ScannerFlowEventStep } from '@/lib/dashboard-operator-kpis'
import type { Translations } from '@/lib/translations'
import HubScannerIcon from '@/components/HubScannerIcon'
import { SCANNER_FLOW_CARD_INNER_PADDING_CLASS, SCANNER_FLOW_MOBILE_TITLE_FRAME } from '@/lib/scanner-flow-title-frame'
import {
  SUMMARY_HIGHLIGHT_ACCENTS,
  SUMMARY_HIGHLIGHT_SURFACE_CLASS,
  AURORA_GLASS_PANEL_LAYOUT_CLASS,
} from '@/lib/summary-highlight-accent'
import ScannerFlowKpiButtons from '@/components/ScannerFlowKpiButtons'

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
  const border = embedded ? 'border-app-line-25' : 'border-white/10'
  const titleCls = embedded ? 'text-app-fg-muted' : 'text-app-fg-muted'
  const emptyCls = embedded ? 'text-app-fg-muted' : 'text-app-fg'
  const timeCls = embedded ? 'shrink-0 tabular-nums text-app-fg-muted' : 'shrink-0 tabular-nums text-app-fg-muted'
  const descCls = embedded ? 'min-w-0 text-app-fg-muted' : 'min-w-0 text-app-fg'

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
  tz,
  fiscalYearLabel,
  detailTimeRange,
  glassShell = false,
}: {
  summary: ScannerFlowDaySummary
  t: Translations
  events: ScannerFlowEventRow[]
  formatEventTime: (iso: string) => string
  embedded: boolean
  allEventsHref?: string
  headerLinks?: DashboardScannerFlowHeaderLinks
  tz: string
  /** Etichetta anno fiscale (KPI usano stesso intervallo del selettore) */
  fiscalYearLabel?: string
  /** Quando presente, le liste nel modal e i conteggi usano lo stesso intervallo */
  detailTimeRange?: { from: string; toExclusive: string }
  glassShell?: boolean
}) {
  const todayLine = t.dashboard.scannerFlowTodayCounts
    .replace('{ai}', String(summary.aiElaborate))
    .replace('{arch}', String(summary.archiviate))

  const kpiNumCls = embedded ? 'text-app-fg md:text-3xl' : 'text-app-fg md:text-3xl'
  const kpiLabelCls = embedded ? 'text-app-fg-muted md:text-xs' : 'text-app-fg-muted md:text-xs'
  const kpiBoxBorder = embedded
    ? glassShell
      ? 'border-white/10'
      : 'border-app-line-28'
    : glassShell
      ? 'border-white/10'
      : 'border-app-line-30'
  const kpiBoxBg = embedded
    ? glassShell
      ? 'glass-surface shadow-inner shadow-black/20'
      : 'app-workspace-inset-bg-soft'
    : glassShell
      ? 'glass-surface shadow-inner shadow-black/20 ring-1 ring-white/5'
      : 'app-workspace-inset-bg-soft shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ring-1 ring-app-line-10'

  const eventsInHeader = Boolean(headerLinks?.eventsHref?.trim())
  const showFooterEventsLink = Boolean(allEventsHref?.trim()) && !eventsInHeader
  const newScanLabel = t.dashboard.scannerFlowOpenScanner
  const eventsLinkLabel = t.dashboard.scannerFlowEventsAllLink
  const scannerEventsLinkClass =
    'text-xs font-semibold text-app-fg-muted hover:text-app-fg hover:underline sm:text-sm'

  return (
    <>
      {embedded ? (
        <>
          <h2 className="text-sm font-semibold text-app-fg md:text-base">{t.dashboard.scannerFlowCardTitle}</h2>
          <p className="mt-1 text-xs leading-snug text-app-fg-muted">{t.dashboard.scannerFlowCardHint}</p>
          <p className="mt-2 text-xs font-medium text-app-fg-muted">{todayLine}</p>
        </>
      ) : (
        <div className="flex w-full flex-col gap-2 border-b border-app-line-15 pb-2 md:flex-row md:items-start md:justify-between md:gap-3 md:pb-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex w-full justify-start">
              <h2
                className={`m-0 inline-flex max-w-full min-w-0 min-h-[40px] flex-row flex-nowrap items-center justify-start gap-1.5 px-3 py-1.5 text-left font-normal sm:min-h-[44px] sm:gap-2 sm:px-3.5 sm:py-2 md:min-h-0 md:gap-1.5 md:px-2.5 md:py-1.5 ${SCANNER_FLOW_MOBILE_TITLE_FRAME} md:shadow-[0_0_14px_-10px_rgba(6,182,212,0.38)]`}
              >
                <HubScannerIcon className="h-5 w-5 shrink-0 text-app-fg-muted drop-shadow-[0_0_10px_rgba(34,211,238,0.45)] sm:h-6 sm:w-6 md:h-5 md:w-5 md:drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]" aria-hidden />
                <span className="min-w-0 shrink truncate text-left text-[11px] font-semibold leading-tight text-app-fg sm:text-xs md:flex-1 md:basis-auto md:text-[11px]">
                  {t.fornitori.tabRiepilogo}
                </span>
              </h2>
            </div>
            {fiscalYearLabel?.trim() ? (
              <p className="px-3 text-xs font-medium text-cyan-200/90 md:px-2.5">
                {t.dashboard.scannerFlowFiscalPeriodLine.replace(/\{year\}/g, fiscalYearLabel)}
              </p>
            ) : null}
            {fiscalYearLabel?.trim() ? (
              <p className="max-w-2xl px-3 text-[11px] leading-snug text-app-fg-muted/95 md:px-2.5">
                {t.dashboard.scannerFlowCardHintFiscal}
              </p>
            ) : null}
          </div>
          {headerLinks &&
          (headerLinks.newScanHref?.trim() || headerLinks.eventsHref?.trim()) ? (
            <div className="hidden shrink-0 flex-nowrap items-center justify-center gap-2 self-center sm:gap-3 md:flex md:justify-end">
              {headerLinks.newScanHref?.trim() ? (
                <Link
                  href={headerLinks.newScanHref}
                  className={
                    glassShell
                      ? 'inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#38bdf8] px-3 py-1.5 text-xs font-semibold text-slate-950 shadow-md transition hover:brightness-110 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[#38bdf8]/50'
                      : 'inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-app-cyan-500 px-3 py-1.5 text-xs font-semibold text-white shadow-[0_0_18px_-4px_rgba(34,211,238,0.5)] ring-1 ring-app-tint-300-30 transition-colors hover:bg-app-cyan-400'
                  }
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
      <div className="mt-2 grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 md:mt-2.5 md:gap-2.5">
        <ScannerFlowKpiButtons
          aiElaborate={summary.aiElaborate}
          archiviate={summary.archiviate}
          t={t}
          tz={tz}
          detailTimeRange={detailTimeRange}
          kpiBoxBorder={kpiBoxBorder}
          kpiBoxBg={kpiBoxBg}
          kpiNumCls={kpiNumCls}
          kpiLabelCls={kpiLabelCls}
        />
      </div>
      {!embedded && showFooterEventsLink && allEventsHref ? (
        <div className="mt-2 flex justify-center border-t border-app-line-15 pt-2">
          <Link href={allEventsHref} className={scannerEventsLinkClass}>
            {eventsLinkLabel}
          </Link>
        </div>
      ) : null}
      {embedded ? (
        <ScannerFlowTodayActivity events={events} formatEventTime={formatEventTime} t={t} embedded />
      ) : null}
      {embedded && allEventsHref ? (
        <div className="mt-3 flex justify-center border-t border-app-line-25 pt-3">
          <Link
            href={allEventsHref}
            className="text-xs font-semibold text-app-fg-muted hover:text-app-fg hover:underline sm:text-sm"
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
  tz = 'UTC',
  fiscalYearLabel,
  detailTimeRange,
  glassShell = false,
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
  /** IANA timezone for today-filtering in the detail modal. */
  tz?: string
  /** Etichetta breve (es. 2025/26); i KPI e il modal rispettano l’intervallo fiscale. */
  fiscalYearLabel?: string
  /** Intervallo (timestamp ISO) condiviso con il modal /api/scansioni/detail. */
  detailTimeRange?: { from: string; toExclusive: string }
  /** Guscio vetro sulla dashboard dentro `DeepAuroraIntegration`. */
  glassShell?: boolean
}) {
  const embedded = variant === 'embedded'

  if (embedded) {
    return (
      <div className={SCANNER_FLOW_CARD_INNER_PADDING_CLASS} aria-label={t.dashboard.scannerFlowCardTitle}>
        <ScannerFlowCardIntro
          summary={summary}
          t={t}
          events={events}
          formatEventTime={formatEventTime}
          embedded
          allEventsHref={allEventsHref}
          headerLinks={undefined}
          tz={tz}
          fiscalYearLabel={undefined}
          detailTimeRange={undefined}
          glassShell={glassShell}
        />
      </div>
    )
  }

  const scannerShellTheme = SUMMARY_HIGHLIGHT_ACCENTS.cyan

  if (glassShell) {
    return (
      <section
        className={`${AURORA_GLASS_PANEL_LAYOUT_CLASS} app-card-unified overflow-hidden rounded-2xl`}
        aria-label={t.dashboard.scannerFlowCardTitle}
      >
        <div className={`w-full min-w-0 ${SCANNER_FLOW_CARD_INNER_PADDING_CLASS}`}>
          <ScannerFlowCardIntro
            summary={summary}
            t={t}
            events={events}
            formatEventTime={formatEventTime}
            embedded={false}
            allEventsHref={allEventsHref}
            headerLinks={headerLinks}
            tz={tz}
            fiscalYearLabel={fiscalYearLabel}
            detailTimeRange={detailTimeRange}
            glassShell
          />
        </div>
      </section>
    )
  }

  return (
    <section className={`${SUMMARY_HIGHLIGHT_SURFACE_CLASS} ${scannerShellTheme.border}`}>
      <div className={`app-card-bar-accent shrink-0 ${scannerShellTheme.bar}`} aria-hidden />
      <div className={`w-full min-w-0 ${SCANNER_FLOW_CARD_INNER_PADDING_CLASS}`}>
        <ScannerFlowCardIntro
          summary={summary}
          t={t}
          events={events}
          formatEventTime={formatEventTime}
          embedded={false}
          allEventsHref={allEventsHref}
          headerLinks={headerLinks}
          tz={tz}
          fiscalYearLabel={fiscalYearLabel}
          detailTimeRange={detailTimeRange}
        />
      </div>
    </section>
  )
}
