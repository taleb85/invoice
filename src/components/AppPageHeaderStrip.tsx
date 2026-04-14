import type { ReactNode } from 'react'
import {
  SUMMARY_HIGHLIGHT_ACCENTS,
  type SummaryHighlightAccent,
} from '@/lib/summary-highlight-accent'

const innerCls =
  'flex w-full min-w-0 flex-col gap-3 px-4 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-4 sm:gap-y-3 md:px-5 md:py-4'

/**
 * Titolo pagina con stesso effetto di `.app-card` (vetro, ring cyan, ombre neon) + `app-card-bar`.
 * Con `accent`, barra e bordo seguono la tinta della sezione (come `AppSummaryHighlightCard`).
 */
export default function AppPageHeaderStrip({
  children,
  embedded,
  className,
  accent,
}: {
  children: ReactNode
  embedded?: boolean
  className?: string
  accent?: SummaryHighlightAccent
}) {
  const shell = embedded
    ? 'app-card flex flex-col overflow-hidden p-0'
    : 'app-card mb-6 flex flex-col overflow-hidden p-0 md:mb-8'
  const theme = accent != null ? SUMMARY_HIGHLIGHT_ACCENTS[accent] : null
  const outer = [shell, theme?.border, className].filter(Boolean).join(' ')
  return (
    <div className={outer}>
      <div
        className={theme ? `app-card-bar shrink-0 ${theme.bar}` : 'app-card-bar shrink-0'}
        aria-hidden
      />
      <div className={innerCls}>{children}</div>
    </div>
  )
}
