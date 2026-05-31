'use client'

import type { ReactNode } from 'react'

/** Footer condiviso modali documento (layer fornitore, viewer in-app). */
export function DocumentModalFooter({ children }: { children: ReactNode }) {
  return (
    <div className="shrink-0 border-t border-app-line-22/90 app-workspace-inset-bg-soft px-4 py-2.5 md:px-5">
      <div className="flex flex-wrap items-center gap-4">{children}</div>
    </div>
  )
}
