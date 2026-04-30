import type { ReactNode } from 'react'
import {
  SUMMARY_HIGHLIGHT_ACCENTS,
  SUMMARY_HIGHLIGHT_CARD_INNER_PADDING_CLASS,
  SUMMARY_HIGHLIGHT_SURFACE_CLASS,
  type SummaryHighlightAccent,
} from '@/lib/summary-highlight-accent'

export type DataCardProps = {
  accent: SummaryHighlightAccent
  /** Etichetta KPI (maiuscolo consigliato dal chiamante) */
  label: ReactNode
  /** Valore principale — tipicamente `font-bold` / numeri */
  value: ReactNode
  metadata?: ReactNode
  /** Icona o glifo in alto a destra */
  icon?: ReactNode
  className?: string
  padded?: boolean
}

/**
 * Card KPI: bordo + barra tema + icona in alto a destra.
 */
export function DataCard({ accent, label, value, metadata, icon, className = '', padded = true }: DataCardProps) {
  const theme = SUMMARY_HIGHLIGHT_ACCENTS[accent]
  return (
    <div className={`${SUMMARY_HIGHLIGHT_SURFACE_CLASS} ${theme.border} relative ${className}`.trim()}>
      <div className={`app-card-bar-accent ${theme.bar}`} aria-hidden />
      {icon ? (
        <div
          className="pointer-events-none absolute right-2 top-2 z-[1] flex h-9 w-9 items-center justify-center sm:right-3 sm:top-3 sm:h-10 sm:w-10"
          aria-hidden
        >
          {icon}
        </div>
      ) : null}
      {padded ? (
        <div className={`${SUMMARY_HIGHLIGHT_CARD_INNER_PADDING_CLASS} ${icon ? 'pe-12 sm:pe-14' : ''}`}>
          <p className={`text-[10px] font-bold uppercase tracking-wider sm:text-xs ${theme.label}`}>{label}</p>
          <div className="mt-1 text-2xl font-bold tabular-nums leading-tight tracking-tight text-app-fg sm:text-3xl">
            {value}
          </div>
          {metadata ? <p className="mt-1 text-sm font-normal leading-snug text-app-fg-muted">{metadata}</p> : null}
        </div>
      ) : null}
    </div>
  )
}
