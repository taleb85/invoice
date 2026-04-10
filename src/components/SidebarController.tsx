'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'

const Sidebar = dynamic(() => import('./Sidebar'), { ssr: false })
const MobileTopbar = dynamic(() => import('./MobileTopbar'), { ssr: false })

export default function SidebarController() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <>
      <MobileTopbar onOpen={() => setSidebarOpen(true)} />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </>
  )
}
