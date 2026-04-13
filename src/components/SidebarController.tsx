'use client'

import dynamic from 'next/dynamic'
import MobileTopbar from './MobileTopbar'

const Sidebar = dynamic(() => import('./Sidebar'), { ssr: false })

/**
 * Topbar mobile: sempre nel bundle (no dynamic) + `md:hidden` nel componente → niente primo paint senza logo/operatore/rete.
 * La sidebar resta dynamic ssr:false (pesante).
 */
export default function SidebarController() {
  return (
    <>
      <MobileTopbar />
      <Sidebar />
    </>
  )
}
