'use client'

import { useEffect } from 'react'

function isDevHost(hostname: string) {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname.endsWith('.localhost')
  )
}

export default function PWARegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const host = window.location.hostname
    if (process.env.NODE_ENV === 'development' || isDevHost(host)) {
      void navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const r of regs) void r.unregister()
      })
      return
    }
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch((err) => console.error('SW registration failed:', err))
  }, [])

  return null
}
