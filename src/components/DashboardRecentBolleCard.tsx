import Link from 'next/link'
import type { ReactNode } from 'react'
import HubScannerIcon from '@/components/HubScannerIcon'
import { SUMMARY_HIGHLIGHT_ACCENTS, type SummaryHighlightAccent } from '@/lib/summary-highlight-accent'

export type DashboardRecentBollaListItem = {
  id: string
  data: string
  stato: string
  fornitori?: { nome?: string | null } | null
}

export type DashboardRecentBolleCardLabels = {
  title: string
  newBill: string
  viewAll: string
  noBills: string
  addFirst: string
  completato: string
  inAttesa: string
  /** Con `surface="scanner-flow"` + `hideRecentList`: titolo e CTA principale allineati allo hub Scanner. */
  scannerHubTitle?: string
  scannerHubOpenScanner?: string
  /** Link testuale eventi Scanner (es. «Elenco completo eventi →») nell’header hub. */
  scannerHubEventsLink?: string
}

export type DashboardRecentBolleCardShellLabels = {
  title?: string
}

type ListModeProps = {
  shellOnly?: false
  bolle: DashboardRecentBollaListItem[]
  formatDate: (data: string) => string
  labels: DashboardRecentBolleCardLabels
  accent?: SummaryHighlightAccent
  /** Superficie come `DashboardScannerFlowCard` (cyan/viola, bordo 500/35). */
  surface?: 'default' | 'scanner-flow'
  /** Non mostrare righe bolle (solo header / CTA della card). */
  hideRecentList?: boolean
  hrefNew?: string
  hrefList?: string
  /** Con hub Scanner: storico eventi (es. `/scanner/eventi`). */
  hrefScannerEvents?: string
  hrefDetail?: (id: string) => string
}

type ShellModeProps = {
  shellOnly: true
  accent?: SummaryHighlightAccent
  labels?: DashboardRecentBolleCardShellLabels
  children?: ReactNode
}

export type DashboardRecentBolleCardProps = ListModeProps | ShellModeProps

const defaultHrefNew = '/bolle/new'
const defaultHrefList = '/bolle'
const defaultHrefDetail = (id: string) => `/bolle/${id}`

export default function DashboardRecentBolleCard(props: DashboardRecentBolleCardProps) {
  if (props.shellOnly) {
    const theme = SUMMARY_HIGHLIGHT_ACCENTS[props.accent ?? 'cyan']
    const title = props.labels?.title?.trim()
    return (
      <div className={`app-card overflow-hidden ${theme.border}`}>
        <div className={`app-card-bar ${theme.bar}`} aria-hidden />
        {title ? (
          <div className="border-b border-slate-600/80/80 px-4 py-4 sm:px-6">
            <h2 className="font-semibold text-slate-100">{title}</h2>
          </div>
        ) : null}
        {props.children ?? <div className="min-h-[10rem] px-4 py-6 sm:px-6" />}
      </div>
    )
  }

  const {
    bolle,
    formatDate,
    labels,
    accent = 'cyan',
    surface = 'default',
    hideRecentList = false,
    hrefNew = defaultHrefNew,
    hrefList = defaultHrefList,
    hrefScannerEvents,
    hrefDetail = defaultHrefDetail,
  } = props
  const theme = SUMMARY_HIGHLIGHT_ACCENTS[accent]
  const flow = surface === 'scanner-flow'
  const scannerHubHeader = flow && hideRecentList
  const headerTitle =
    scannerHubHeader && labels.scannerHubTitle?.trim() ? labels.scannerHubTitle : labels.title
  const primaryCtaLabel =
    scannerHubHeader && labels.scannerHubOpenScanner?.trim()
      ? labels.scannerHubOpenScanner
      : labels.newBill

  const rootClass = flow ? 'app-card' : `app-card overflow-hidden ${theme.border}`

  const headerClass = flow
    ? 'flex flex-col gap-3 border-b border-white/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 md:py-4'
    : 'flex flex-col gap-3 border-b border-slate-600/80/80 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6'

  const titleClass = flow ? 'font-semibold text-cyan-50' : 'font-semibold text-slate-100'
  const viewAllClass = flow
    ? 'text-sm font-medium text-cyan-200/90 hover:text-cyan-50 hover:underline'
    : 'text-sm font-medium text-cyan-400 hover:text-cyan-300 hover:underline'
  const scannerEventsLinkClass =
    'text-xs font-semibold text-cyan-200/95 hover:text-cyan-50 hover:underline sm:text-sm'

  const listX = flow ? 'px-4 sm:px-6' : 'px-6'
  const emptyIconClass = flow ? 'mx-auto mb-3 h-12 w-12 text-cyan-400/30' : 'mx-auto mb-3 h-12 w-12 text-slate-600'
  const emptyTextClass = flow ? 'text-sm text-cyan-100/85' : 'text-sm text-slate-200'
  const emptyLinkClass = flow
    ? 'mt-3 inline-block text-sm font-medium text-cyan-200 hover:text-cyan-50 hover:underline'
    : 'mt-3 inline-block text-sm font-medium text-cyan-400 hover:text-cyan-300 hover:underline'
  const divideClass = flow ? 'divide-y divide-white/10' : 'divide-y divide-slate-800/80'
  const rowHoverClass = flow ? 'hover:bg-white/5' : 'hover:bg-slate-700/40'
  const rowSupplierClass = flow ? 'text-sm font-medium text-cyan-50' : 'text-sm font-medium text-slate-100'
  const rowDateClass = flow ? 'mt-0.5 text-xs text-cyan-200/65' : 'mt-0.5 text-xs text-slate-500'

  return (
    <div className={rootClass}>
      {!flow ? <div className={`app-card-bar ${theme.bar}`} aria-hidden /> : null}
      <div className={headerClass}>
        <h2 className={titleClass}>{headerTitle}</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={hrefNew}
            className={
              flow
                ? 'inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-white shadow-[0_0_16px_-4px_rgba(6,182,212,0.45)] transition-colors hover:bg-cyan-400'
                : 'inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-cyan-600'
            }
          >
            {scannerHubHeader ? (
              <HubScannerIcon className="h-3.5 w-3.5" />
            ) : (
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            )}
            {primaryCtaLabel}
          </Link>
          {scannerHubHeader && hrefScannerEvents && labels.scannerHubEventsLink?.trim() ? (
            <Link href={hrefScannerEvents} className={scannerEventsLinkClass}>
              {labels.scannerHubEventsLink}
            </Link>
          ) : null}
          {!scannerHubHeader ? (
            <Link href={hrefList} className={viewAllClass}>
              {labels.viewAll}
            </Link>
          ) : null}
        </div>
      </div>

      {hideRecentList ? null : bolle.length === 0 ? (
        <div className={`${listX} py-12 text-center`}>
          <svg className={emptyIconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <p className={emptyTextClass}>{labels.noBills}</p>
          <Link href={hrefNew} className={emptyLinkClass}>
            {labels.addFirst}
          </Link>
        </div>
      ) : (
        <div className={divideClass}>
          {bolle.map((b) => (
            <Link
              key={b.id}
              href={hrefDetail(b.id)}
              className={`flex items-center justify-between py-4 transition-colors ${listX} ${rowHoverClass}`}
            >
              <div>
                <p className={rowSupplierClass}>{b.fornitori?.nome ?? '—'}</p>
                <p className={rowDateClass}>{formatDate(b.data)}</p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  b.stato === 'completato'
                    ? 'bg-green-500/15 text-green-300 ring-1 ring-green-500/30'
                    : 'bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/30'
                }`}
              >
                {b.stato === 'completato' ? labels.completato : labels.inAttesa}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
