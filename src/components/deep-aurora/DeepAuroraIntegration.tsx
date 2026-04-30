'use client'

import type { ReactNode } from 'react'

/**
 * Wrapper app autenticata: attiva tema Deep Aurora sul body (:has), `.glass-*` e override in `globals.css`.
 */
export function DeepAuroraIntegration({ children }: { children: ReactNode }) {
  return (
    <div
      data-deep-aurora-integration
      className="flex min-h-0 min-w-0 w-full flex-1 flex-col [&:focus]:outline-none"
    >
      {children}
    </div>
  )
}
