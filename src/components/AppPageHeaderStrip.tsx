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

/** Riga interna: titolo a sinistra; azioni a destra; padding e gap generosi così la barra non risulta “stretta”. */
const innerClsBase =
  'flex w-full min-w-0 flex-col gap-3 px-4 py-3 sm:flex-row sm:flex-nowrap sm:gap-x-6 sm:px-5 sm:py-3.5 md:gap-x-8 md:px-6 md:py-4 lg:gap-x-10 lg:px-8 xl:px-10'

const innerClsDenseBase =
  `flex w-full min-w-0 flex-col gap-2 ${APP_PAGE_HEADER_INNER_DENSE_PADDING_CLASS} sm:flex-row sm:flex-nowrap sm:gap-x-3`

/** Destra strip: permette shrink e wrap quando FY + tray stretti così il titolo a sinistra recupera larghezza (`min-w-0` sulla colonna sinistra). */
const innerRightClsBase =
  'flex min-h-0 min-w-0 max-w-[min(30rem,calc(100%-1rem))] shrink flex-row flex-wrap content-end justify-end gap-x-3 gap-y-2 sm:items-center sm:gap-x-4 md:flex-nowrap md:gap-x-5'

const innerRightClsDenseBase =
  'flex min-h-0 min-w-0 max-w-[min(28rem,calc(100%-1rem))] shrink flex-wrap content-end justify-end gap-2 sm:flex-nowrap sm:gap-x-3 md:gap-3'

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
  /** Icona colorata visualizzata a sinistra del titolo, stessa tinta dell'accent. */
  icon,
  /** Prima dell’icona sezione/titolo, sulla stessa riga dello strip (es. torna indietro). */
  leadingAccessory,
  /** Slot libero per contenuto arbitrario nella sezione merged (alternativo a `mergedSummary`). */
  mergedSlot,
  /**
   * Allineamento verticale sulla riga header (principalmente sm+ quando titolo+sottotitolo affiancati al Fiscal Year / tray).
   * `start` allinea cuffie, icona strip e primo rigo titolo sulla stessa base (evita “centro” sulla colonna a due righe).
   */
  rowAlign = 'center',
}: {
  children: ReactNode
  embedded?: boolean
  className?: string
  accent?: SummaryHighlightAccent
  /** Padding e gap ridotti (es. `/bolle/new`). */
  dense?: boolean
  flushBottom?: boolean
  mergedSummary?: Omit<AppSummaryHighlightMetricsProps, 'accent'>
  /** Icona colorata visualizzata a sinistra del titolo, stessa tinta dell'accent. */
  icon?: ReactNode
  leadingAccessory?: ReactNode
  mergedSlot?: ReactNode
  rowAlign?: 'center' | 'start'
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
  const showMergedSlot = mergedSlot != null

  const alignStart = rowAlign === 'start'
  const innerRowCls = `${dense ? innerClsDenseBase : innerClsBase} ${
    alignStart ? 'sm:items-start' : 'sm:items-center'
  } ${dense && alignStart ? 'md:items-start' : dense ? 'md:items-center' : ''}`
  const leftClusterCls = `flex min-w-0 min-h-0 flex-1 gap-3 lg:gap-4 ${alignStart ? 'items-start' : 'items-center'}`
  const titleCls = `min-w-0 flex-1 ${alignStart ? 'self-start' : 'self-center'}`
  const rightCls = `${dense ? innerRightClsDenseBase : innerRightClsBase} ${
    alignStart ? 'items-start sm:justify-end sm:pt-0.5' : 'items-center'
  }`

  const headerRow = (
    <div className={innerRowCls.trim()}>
      <div className={leftClusterCls}>
        {leadingAccessory}
        {icon && (
          <span
            className={`inline-flex h-10 w-10 shrink-0 items-center justify-center opacity-90 ${alignStart ? 'mt-px' : ''} ${theme?.headerIcon ?? 'text-app-fg-muted'}`}
            aria-hidden
          >
            {icon}
          </span>
        )}
        <div className={titleCls}>{first}</div>
      </div>
      <div className={rightCls}>
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
      ) : showMergedSlot ? (
        <>
          {headerRow}
          <div className={`border-t border-app-soft-border ${SUMMARY_HIGHLIGHT_CARD_INNER_PADDING_CLASS}`}>
            {mergedSlot}
          </div>
        </>
      ) : (
        headerRow
      )}
    </div>
  )
}
