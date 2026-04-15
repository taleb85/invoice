import type { ReactNode } from 'react'
import {
  SUMMARY_HIGHLIGHT_ACCENTS,
  SUMMARY_HIGHLIGHT_CARD_INNER_PADDING_CLASS,
  SUMMARY_HIGHLIGHT_SURFACE_CLASS,
  type SummaryHighlightAccent,
} from '@/lib/summary-highlight-accent'

type AppSummaryHighlightCardProps = {
  label: ReactNode
  primary: ReactNode
  secondary?: ReactNode
  /** Contenuto allineato a destra sulla stessa riga del sottotitolo (da sm in su). */
  trailing?: ReactNode
  /**
   * `with-metrics` (default): trailing accanto al numero + secondary.
   * `with-label`: trailing sulla riga dell’etichetta (più compatto in altezza; es. Statements).
   */
  trailingAlign?: 'with-metrics' | 'with-label'
  /** Area sotto il blocco principale (es. ricerca), dentro lo stesso padding della card. */
  footer?: ReactNode
  /** Colore barra + etichetta: come i KPI dashboard per categoria. */
  accent?: SummaryHighlightAccent
  className?: string
}

/** Riepilogo in evidenza: solo bordo + barra superiore (tinta KPI), corpo trasparente sul canvas. */
export default function AppSummaryHighlightCard({
  label,
  primary,
  secondary,
  trailing,
  trailingAlign = 'with-metrics',
  footer,
  accent = 'purple',
  className,
}: AppSummaryHighlightCardProps) {
  const hasSecondary = secondary != null && secondary !== ''
  const hasTrailing = trailing != null
  const hasFooter = footer != null
  const theme = SUMMARY_HIGHLIGHT_ACCENTS[accent]
  const trailingWithLabel = hasTrailing && trailingAlign === 'with-label'

  return (
    <div className={`${SUMMARY_HIGHLIGHT_SURFACE_CLASS} mb-6 ${theme.border} ${className ?? ''}`}>
      <div className={`app-card-bar-accent ${theme.bar}`} aria-hidden />
      <div className={SUMMARY_HIGHLIGHT_CARD_INNER_PADDING_CLASS}>
        {trailingWithLabel ? (
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
            <p className={`text-[10px] font-bold uppercase tracking-widest ${theme.label}`}>{label}</p>
            <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs font-semibold">
              {trailing}
            </div>
          </div>
        ) : (
          <p className={`text-[10px] font-bold uppercase tracking-widest ${theme.label}`}>{label}</p>
        )}
        {hasSecondary ? (
          <div
            className={
              trailingWithLabel
                ? 'mt-1 flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5'
                : 'mt-1 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4'
            }
          >
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <p className="text-2xl font-bold tabular-nums text-app-fg sm:text-3xl">{primary}</p>
              <p className="min-w-0 text-sm leading-snug text-app-fg-muted">{secondary}</p>
            </div>
            {hasTrailing && !trailingWithLabel ? (
              <div className="flex min-w-0 w-full shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold sm:w-auto sm:justify-end">
                {trailing}
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <p className="mt-1 text-2xl font-bold tabular-nums text-app-fg sm:text-3xl">{primary}</p>
            {hasTrailing && !trailingWithLabel ? (
              <div className="mt-1 flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs font-semibold">
                {trailing}
              </div>
            ) : null}
          </>
        )}
        {hasFooter ? (
          <div className="mt-2.5 border-t border-app-soft-border pt-2.5">{footer}</div>
        ) : null}
      </div>
    </div>
  )
}
