'use client'

import ConnectionStatusDot from '@/components/ConnectionStatusDot'
import DesktopHeaderToolbar from '@/components/DesktopHeaderToolbar'

/** Campana + stato rete nel corpo pagina (desktop); nasconde il fallback in `AppShell` via `data-app-page-header-embedded-tray`. */
export default function AppPageHeaderDesktopTray({ className }: { className?: string }) {
  return (
    <div
      data-app-page-header-embedded-tray
      className={`hidden shrink-0 items-center gap-2 md:flex ${className ?? ''}`}
    >
      <DesktopHeaderToolbar />
      <ConnectionStatusDot />
    </div>
  )
}
