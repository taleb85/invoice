import { Children, type ReactNode } from 'react'
import AppSummaryHighlightMetrics, {
  type AppSummaryHighlightMetricsProps,
} from '@/components/AppSummaryHighlightMetrics'
import {
  SUMMARY_HIGHLIGHT_ACCENTS,
  SUMMARY_HIGHLIGHT_CARD_INNER_PADDING_CLASS,
  SUMMARY_HIGHLIGHT_SURFACE_CLASS,
  type SummaryHighlightAccent,
} from '@/lib/summary-highlight-accent'
import AppPageHeaderDesktopTray from '@/components/AppPageHeaderDesktopTray'
import { APP_PAGE_HEADER_INNER_DENSE_PADDING_CLASS } from '@/lib/app-shell-layout'

/** Riga interna: titolo a sinistra; azioni + campana/rete raggruppate a destra (padding X = `app-shell-page-padding-x`). */
const innerCls =
  'flex w-full min-w-0 flex-col gap-3 px-3 py-3.5 sm:flex-row sm:flex-nowrap sm:items-start sm:gap-x-4 sm:px-4 sm:py-3.5 md:items-start md:gap-x-5 md:px-6 md:py-4 lg:gap-x-7 lg:px-8 xl:px-10'

const innerClsDense =
  `flex w-full min-w-0 flex-col gap-2 ${APP_PAGE_HEADER_INNER_DENSE_PADDING_CLASS} sm:flex-row sm:flex-nowrap sm:items-center sm:gap-x-3 md:items-center`

const innerRightCls =
  'flex min-w-0 shrink-0 flex-wrap items-center justify-start gap-2 sm:justify-end sm:gap-x-2 md:gap-3'

const innerRightClsDense =
  'flex min-w-0 shrink-0 flex-wrap items-center justify-start gap-2 sm:justify-end sm:gap-x-2 md:gap-2'

/**
 * Titolo pagina con stesso effetto di `.app-card` (vetro, ring cyan, ombre neon) + barra (`.app-card-bar-accent` se tema).
 * Con `accent`, barra e bordo seguono la tinta della sezione (come `AppSummaryHighlightCard`).
 */
export default function AppPageHeaderStrip({
  children,
  embedded,
  className,
  accent,
  dense = false,
  /** Senza margine inferiore (es. dashboard / fornitori con `gap` sul contenitore pagina). */
  flushBottom = false,
  /**
   * Riepilogo metrico sotto la riga titolo/azioni, **nello stesso guscio** (un solo bordo + barra).
   * Richiede `accent` (stessa tinta etichetta metriche).
   */
  mergedSummary,
}: {
  children: ReactNode
  embedded?: boolean
  className?: string
  accent?: SummaryHighlightAccent
  /** Padding e gap ridotti (es. `/bolle/new`). */
  dense?: boolean
  flushBottom?: boolean
  mergedSummary?: Omit<AppSummaryHighlightMetricsProps, 'accent'>
}) {
  const theme = accent != null ? SUMMARY_HIGHLIGHT_ACCENTS[accent] : null
  const skipMb = embedded || flushBottom
  const shell = theme
    ? `${SUMMARY_HIGHLIGHT_SURFACE_CLASS} flex flex-col p-0${skipMb ? '' : ' mb-6 md:mb-8'} ${theme.border}`
    : embedded
      ? 'app-card flex flex-col overflow-hidden p-0'
      : flushBottom
        ? 'app-card flex flex-col overflow-hidden p-0'
        : 'app-card mb-6 flex flex-col overflow-hidden p-0 md:mb-8'
  const outer = [shell, className].filter(Boolean).join(' ')
  const barClassName = theme ? `app-card-bar-accent shrink-0 ${theme.bar}` : 'app-card-bar shrink-0'
  const items = Children.toArray(children)
  const [first, ...rest] = items.length > 0 ? items : [null]
  const showMerged = accent != null && mergedSummary != null

  const headerRow = (
    <div className={dense ? innerClsDense : innerCls}>
      <div className="min-w-0 flex-1">{first}</div>
      <div className={dense ? innerRightClsDense : innerRightCls}>
        {rest}
        <AppPageHeaderDesktopTray />
      </div>
    </div>
  )

  return (
    <div className={outer}>
      <div className={barClassName} aria-hidden />
      {showMerged ? (
        <>
          {headerRow}
          <div className={`border-t border-app-soft-border ${SUMMARY_HIGHLIGHT_CARD_INNER_PADDING_CLASS}`}>
            <AppSummaryHighlightMetrics accent={accent} {...mergedSummary} />
          </div>
        </>
      ) : (
        headerRow
      )}
    </div>
  )
}
