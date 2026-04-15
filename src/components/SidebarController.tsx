'use client'

import MobileTopbar from './MobileTopbar'

/**
 * Topbar mobile (`md:hidden` nel componente). Su desktop `md:contents` così la griglia in `AppShell`
 * vede direttamente `aside` + header + main; la sidebar vive tutta nel solo `aside`.
 */
export default function SidebarController() {
  return (
    <div className="flex shrink-0 flex-col md:contents">
      <MobileTopbar />
    </div>
  )
}
