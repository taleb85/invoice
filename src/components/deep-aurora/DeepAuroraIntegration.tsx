import type { ReactNode } from 'react'

/**
 * Ambito Deep Aurora / Smart Pair sulla dashboard (e pagine future):
 * espone `--accent-color`, `.glass-card` e lo sfondo body senza il tema tipografico full-page del mock.
 */
export function DeepAuroraIntegration({ children }: { children: ReactNode }) {
  return (
    <div data-deep-aurora-integration className="min-h-0 w-full min-w-0">
      {children}
    </div>
  )
}
