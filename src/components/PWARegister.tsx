'use client'

import { useEffect } from 'react'

const CHUNK_RELOAD_KEY = 'fluxo-chunk-reload-once'

function isDevHost(hostname: string) {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname.endsWith('.localhost')
  )
}

function isChunkLoadFailure(message: string): boolean {
  return (
    /ChunkLoadError/i.test(message) ||
    /Loading chunk [\d]+ failed/i.test(message) ||
    /Failed to fetch dynamically imported module/i.test(message)
  )
}

/** Un solo hard-reload se un chunk JS non si carica (tipico dopo deploy con cache PWA). */
function installChunkLoadRecovery() {
  const reloadOnce = async (reason: string) => {
    try {
      if (sessionStorage.getItem(CHUNK_RELOAD_KEY) === '1') return
      sessionStorage.setItem(CHUNK_RELOAD_KEY, '1')
    } catch {
      return
    }
    console.warn('[PWA] chunk load failure — clearing caches and reloading:', reason)
    try {
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((name) => caches.delete(name)))
      }
    } catch {
      /* best-effort */
    }
    window.location.reload()
  }

  const onError = (event: ErrorEvent) => {
    const msg = event.message || String(event.error ?? '')
    if (isChunkLoadFailure(msg)) void reloadOnce(msg)
  }
  const onRejection = (event: PromiseRejectionEvent) => {
    const msg =
      event.reason instanceof Error
        ? event.reason.message
        : typeof event.reason === 'string'
          ? event.reason
          : ''
    if (isChunkLoadFailure(msg)) void reloadOnce(msg)
  }

  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)
  return () => {
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onRejection)
  }
}

export default function PWARegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const host = window.location.hostname
    if (process.env.NODE_ENV === 'development' || isDevHost(host)) {
      void navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const r of regs) void r.unregister()
      })
      return installChunkLoadRecovery()
    }
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch((err) => console.error('SW registration failed:', err))
    return installChunkLoadRecovery()
  }, [])

  return null
}
