'use client'
import { useState, useEffect } from 'react'

export function useServiceWorkerUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.getRegistration().then(reg => {
      if (!reg) return
      setRegistration(reg)

      // Already a waiting worker (page was kept open during a background update)
      if (reg.waiting) {
        setUpdateAvailable(true)
      }

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing
        if (!newWorker) return
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setUpdateAvailable(true)
          }
        })
      })
    })

    // When the new SW takes control, reload the page to get the fresh assets
    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true
        window.location.reload()
      }
    })
  }, [])

  function applyUpdate() {
    if (!registration?.waiting) return
    setUpdating(true)
    registration.waiting.postMessage({ type: 'SKIP_WAITING' })
  }

  return { updateAvailable, updating, applyUpdate }
}
