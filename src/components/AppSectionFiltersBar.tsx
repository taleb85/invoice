import type { ReactNode } from 'react'
import { APP_SECTION_FILTERS_STRIP_CLASS } from '@/lib/app-shell-layout'

/** Barra orizzontale sotto header: filtri, ricerca, scorciatoie — stesso padding delle tabelle. */
export default function AppSectionFiltersBar({
  children,
  className = '',
  'aria-label': ariaLabel = 'Filtri',
}: {
  children: ReactNode
  className?: string
  'aria-label'?: string
}) {
  return (
    <div role="toolbar" aria-label={ariaLabel} className={`${APP_SECTION_FILTERS_STRIP_CLASS} ${className}`.trim()}>
      {children}
    </div>
  )
}
