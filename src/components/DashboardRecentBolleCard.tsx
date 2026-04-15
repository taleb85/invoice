import type { ReactNode } from 'react'
import {
  SUMMARY_HIGHLIGHT_ACCENTS,
  SUMMARY_HIGHLIGHT_CARD_INNER_PADDING_CLASS,
  SUMMARY_HIGHLIGHT_SURFACE_CLASS,
  type SummaryHighlightAccent,
} from '@/lib/summary-highlight-accent'

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
    <div className={`${SUMMARY_HIGHLIGHT_SURFACE_CLASS} ${theme.border}`}>
      <div className={`app-card-bar-accent ${theme.bar}`} aria-hidden />
      {title ? (
        <div className={`border-b border-app-line-30 ${SUMMARY_HIGHLIGHT_CARD_INNER_PADDING_CLASS}`}>
          <h2 className="font-semibold text-app-fg">{title}</h2>
        </div>
      ) : null}
      {props.children ?? <div className={`min-h-[10rem] ${SUMMARY_HIGHLIGHT_CARD_INNER_PADDING_CLASS}`} />}
    </div>
  )
}
