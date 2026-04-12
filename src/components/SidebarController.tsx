'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'

const Sidebar = dynamic(() => import('./Sidebar'), { ssr: false })
const MobileTopbar = dynamic(() => import('./MobileTopbar'), { ssr: false })

const MOBILE_BREAKPOINT = 768

export default function SidebarController() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return (
    <>
      {isMobile && <MobileTopbar />}
      <Sidebar />
    </>
  )
}
