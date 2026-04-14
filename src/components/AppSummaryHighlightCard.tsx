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
        {hasSecondary ? (
          <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <p className="text-2xl font-bold tabular-nums text-slate-50 sm:text-3xl">{primary}</p>
              <p className="min-w-0 text-sm leading-snug text-slate-200">{secondary}</p>
            </div>
            {hasTrailing ? (
              <div className="flex min-w-0 w-full shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold sm:w-auto sm:justify-end">
                {trailing}
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-50 sm:text-3xl">{primary}</p>
            {hasTrailing ? (
              <div className="mt-1 flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs font-semibold">
                {trailing}
              </div>
            ) : null}
          </>
        )}
        {hasFooter ? (
          <div className="mt-2.5 border-t border-slate-600/35 pt-2.5">{footer}</div>
        ) : null}
      </div>
    </div>
  )
}
