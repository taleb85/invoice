'use client'

import dynamic from 'next/dynamic'
import MobileTopbar from './MobileTopbar'

const Sidebar = dynamic(() => import('./Sidebar'), { ssr: false })

/**
 * Topbar mobile: sempre nel bundle (no dynamic) + `md:hidden` nel componente → niente primo paint senza logo/operatore/rete.
 * La sidebar resta dynamic ssr:false (pesante).
 */
export default function SidebarController({
  sidebarCollapsed,
  onSidebarCollapsedChange,
}: {
  sidebarCollapsed: boolean
  onSidebarCollapsedChange: (collapsed: boolean) => void
}) {
  return (
    <div className="flex shrink-0 flex-col md:h-full md:min-h-0 md:min-w-0 md:overflow-visible">
      <MobileTopbar />
      <Sidebar
        collapsed={sidebarCollapsed}
        onCollapsedChange={onSidebarCollapsedChange}
      />
    </div>
  )
}
