import type { ReactNode } from 'react'
import {
  SUMMARY_HIGHLIGHT_ACCENTS,
  SUMMARY_HIGHLIGHT_CARD_INNER_PADDING_CLASS,
  SUMMARY_HIGHLIGHT_SURFACE_CLASS,
  type SummaryHighlightAccent,
} from '@/lib/summary-highlight-accent'

export type StandardCardProps = {
  accent: SummaryHighlightAccent
  children: ReactNode
  className?: string
  /** Padding interno come le altre card sezione (default true). */
  padded?: boolean
}

/**
 * Card lista/dashboard: bordo tinta KPI + barra neon + padding allineato alle altre schede.
 */
export function StandardCard({ accent, children, className = '', padded = true }: StandardCardProps) {
  const theme = SUMMARY_HIGHLIGHT_ACCENTS[accent]
  return (
    <div className={`${SUMMARY_HIGHLIGHT_SURFACE_CLASS} ${theme.border} ${className}`.trim()}>
      <div className={`app-card-bar-accent ${theme.bar}`} aria-hidden />
      {padded ? (
        <div className={SUMMARY_HIGHLIGHT_CARD_INNER_PADDING_CLASS}>{children}</div>
      ) : (
        children
      )}
    </div>
  )
}
