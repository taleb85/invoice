import type { ReactNode } from 'react'
import { SUMMARY_HIGHLIGHT_ACCENTS, type SummaryHighlightAccent } from '@/lib/summary-highlight-accent'

export type DashboardRecentBolleCardLabels = {
  title?: string
}

export type DashboardRecentBolleCardProps = {
  accent?: SummaryHighlightAccent
  labels?: DashboardRecentBolleCardLabels
  children?: ReactNode
}

/** Placeholder card per layout desktop quando la colonna «recenti» non è popolata. */
export default function DashboardRecentBolleCard(props: DashboardRecentBolleCardProps) {
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
