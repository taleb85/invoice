'use client'

import ConnectionStatusDot from '@/components/ConnectionStatusDot'

export default function AppPageHeaderDesktopTray({ className }: { className?: string }) {
  return (
    <div
      data-app-page-header-embedded-tray
      className={`hidden shrink-0 items-center gap-2 md:flex ${className ?? ''}`}
    >
      <ConnectionStatusDot className="h-8 px-2.5" />
    </div>
  )
}
