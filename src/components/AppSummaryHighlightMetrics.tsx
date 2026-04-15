import type { ReactNode } from 'react'
import { SUMMARY_HIGHLIGHT_ACCENTS, type SummaryHighlightAccent } from '@/lib/summary-highlight-accent'

export type AppSummaryHighlightMetricsProps = {
  accent: SummaryHighlightAccent
  label: ReactNode
  primary: ReactNode
  secondary?: ReactNode
  trailing?: ReactNode
  trailingAlign?: 'with-metrics' | 'with-label'
}

/** Corpo metrico (etichetta + valore + sottotitolo) senza guscio né barra — per riuso in card o header unificato. */
export default function AppSummaryHighlightMetrics({
  accent,
  label,
  primary,
  secondary,
  trailing,
  trailingAlign = 'with-metrics',
}: AppSummaryHighlightMetricsProps) {
  const hasSecondary = secondary != null && secondary !== ''
  const hasTrailing = trailing != null
  const theme = SUMMARY_HIGHLIGHT_ACCENTS[accent]
  const trailingWithLabel = hasTrailing && trailingAlign === 'with-label'

  return (
    <>
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
    </>
  )
}
