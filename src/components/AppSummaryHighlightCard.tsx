import type { ReactNode } from 'react'
import {
  SUMMARY_HIGHLIGHT_ACCENTS,
  type SummaryHighlightAccent,
} from '@/lib/summary-highlight-accent'

type AppSummaryHighlightCardProps = {
  label: ReactNode
  primary: ReactNode
  secondary?: ReactNode
  /** Contenuto allineato a destra sulla stessa riga del sottotitolo (da sm in su). */
  trailing?: ReactNode
  /** Area sotto il blocco principale (es. ricerca), dentro lo stesso padding della card. */
  footer?: ReactNode
  /** Colore barra + etichetta: come i KPI dashboard per categoria. */
  accent?: SummaryHighlightAccent
  className?: string
}

/** Riepilogo in evidenza (barra + bordo tinta come l’icona categoria nei KPI). */
export default function AppSummaryHighlightCard({
  label,
  primary,
  secondary,
  trailing,
  footer,
  accent = 'purple',
  className,
}: AppSummaryHighlightCardProps) {
  const hasSecondary = secondary != null && secondary !== ''
  const hasTrailing = trailing != null
  const hasFooter = footer != null
  const theme = SUMMARY_HIGHLIGHT_ACCENTS[accent]

  return (
    <div className={`app-card mb-6 overflow-hidden ${theme.border} ${className ?? ''}`}>
      <div className={`app-card-bar ${theme.bar}`} aria-hidden />
      <div className="px-5 py-4 sm:px-6 sm:py-5">
        <p className={`text-[10px] font-bold uppercase tracking-widest ${theme.label}`}>{label}</p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-slate-50 sm:text-3xl">{primary}</p>
        {hasSecondary && !hasTrailing ? (
          <p className="mt-1 text-sm text-slate-200">{secondary}</p>
        ) : null}
        {hasSecondary && hasTrailing ? (
          <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <p className="min-w-0 text-sm text-slate-200">{secondary}</p>
            <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold sm:justify-end">
              {trailing}
            </div>
          </div>
        ) : null}
        {!hasSecondary && hasTrailing ? (
          <div className="mt-1 flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs font-semibold">
            {trailing}
          </div>
        ) : null}
        {hasFooter ? (
          <div className="mt-4 border-t border-slate-600/35 pt-4">{footer}</div>
        ) : null}
      </div>
    </div>
  )
}
