import type { ReactNode } from 'react'
import AppSummaryHighlightMetrics from '@/components/AppSummaryHighlightMetrics'
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
  const hasFooter = footer != null
  const theme = SUMMARY_HIGHLIGHT_ACCENTS[accent]

  return (
    <div className={`${SUMMARY_HIGHLIGHT_SURFACE_CLASS} mb-6 ${className ?? ''}`}>
      <div className={`app-card-bar-accent ${theme.bar}`} aria-hidden />
      <div className={SUMMARY_HIGHLIGHT_CARD_INNER_PADDING_CLASS}>
        <AppSummaryHighlightMetrics
          accent={accent}
          label={label}
          primary={primary}
          secondary={secondary}
          trailing={trailing}
          trailingAlign={trailingAlign}
        />
        {hasFooter ? (
          <div className="mt-2.5 border-t border-app-soft-border pt-2.5">{footer}</div>
        ) : null}
      </div>
    </div>
  )
}
