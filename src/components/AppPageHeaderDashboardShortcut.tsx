import type { ReactNode } from 'react'

/**
 * Colonna titolo standard nelle `AppPageHeaderStrip`: contenuto (h1, sottotitoli, ecc.).
 */
export function AppPageHeaderTitleWithDashboardShortcut({
  children,
  className = 'min-w-0 items-start gap-3 sm:flex-1 sm:flex-initial',
}: {
  children: ReactNode
  /** Classi del contenitore flex esterno (allineamento / flex nelle strip). */
  className?: string
}) {
  return (
    <div className={`flex ${className}`}>
      {/* Colonna sempre verticale (h1 + sottotitoli) dentro lo strip — evita “affiancamento” casuali */}
      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:gap-1.5">{children}</div>
    </div>
  )
}
