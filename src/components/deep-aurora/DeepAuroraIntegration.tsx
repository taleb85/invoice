'use client'

import type { ReactNode } from 'react'

/**
 * Wrapper app autenticata: attiva tema Deep Aurora sul body (:has), `.glass-*` e override in `globals.css`.
 * `display: contents` — non interferisce con la griglia `app-shell-workspace-canvas` (sidebar + main).
 */
export function DeepAuroraIntegration({ children }: { children: ReactNode }) {
  return (
    <div data-deep-aurora-integration className="contents">
      {children}
    </div>
  )
}
