import type { ReactNode } from 'react'

/**
 * Colonna titolo standard nelle `AppPageHeaderStrip`: contenuto (h1, sottotitoli, ecc.).
 */
export function AppPageHeaderTitleWithDashboardShortcut({
  children,
  className = 'min-w-0 items-start gap-2 sm:flex-1 sm:flex-initial',
  /** Colonna titolo: stack compatto (`nav → h1`, `h1 → sottotitolo`). */
  contentClassName =
    'flex min-w-0 flex-1 flex-col gap-0 [&>nav+h1]:mt-0.5 [&>h1+p]:mt-0',
}: {
  children: ReactNode
  /** Classi del contenitore flex esterno (allineamento / flex nelle strip). */
  className?: string
  contentClassName?: string
}) {
  return (
    <div className={`flex ${className}`}>
      {/* Colonna sempre verticale (h1 + sottotitoli) dentro lo strip — evita “affiancamento” casuali */}
      <div className={contentClassName}>{children}</div>
    </div>
  )
}
