'use client'
import { useState, useEffect } from 'react'

function isLocalDevHostname(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname.endsWith('.localhost')
  )
}

export function useServiceWorkerUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    // In dev / host locali il SW non va registrato (PWARegister) — qui evitiamo listener che
    // interferiscono con Fast Refresh (`controllerchange` → reload pagina).
    if (process.env.NODE_ENV === 'development') return
    if (typeof window !== 'undefined' && isLocalDevHostname(window.location.hostname)) return

    const syncWaitingState = (reg: ServiceWorkerRegistration) => {
      setRegistration(reg)
      if (reg.waiting) {
        setUpdateAvailable(true)
      }
    }

    const attachUpdateFound = (reg: ServiceWorkerRegistration) => {
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing
        if (!newWorker) return
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setUpdateAvailable(true)
          }
        })
      })
    }

    void navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return
      syncWaitingState(reg)
      attachUpdateFound(reg)
    })

    // Controlla nuova versione del SW: all’avvio, ogni ora, quando il tab torna in primo piano
    const checkForNewWorker = () => {
      void navigator.serviceWorker.getRegistration().then((reg) => {
        if (!reg) return
        void reg.update().then(() => {
          syncWaitingState(reg)
        })
      })
    }
    void checkForNewWorker()
    const onVis = () => {
      if (document.visibilityState === 'visible') void checkForNewWorker()
    }
    document.addEventListener('visibilitychange', onVis)
    const interval = window.setInterval(() => {
      void checkForNewWorker()
    }, 60 * 60 * 1000)

    // Ricarica solo se c’era già un controller (aggiornamento deploy). Alla prima installazione
    // PWA `skipWaiting` attiva il SW subito: un reload qui su mobile sembra “l’app non si avvia”.
    const hadControllerAtLoad = !!navigator.serviceWorker.controller
    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadControllerAtLoad) return
      if (!refreshing) {
        refreshing = true
        window.location.reload()
      }
    })

    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.clearInterval(interval)
    }
  }, [])

  function applyUpdate() {
    setUpdating(true)

    // Se c'è un worker in attesa, chiedigli di saltare l'attesa
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' })
    }

    // Forza il ricaricamento dopo 1.5 secondi, indipendentemente dal fatto che
    // il controllerchange sia scattato o meno. Questo copre i casi in cui:
    // - Il SW non è mai entrato in stato "waiting" (skipWaiting() già chiamato in install)
    // - hadControllerAtLoad era false e il listener controllerchange non ha ricaricato
    // - Il worker ha già attivato ma la pagina non ha ricevuto controllerchange
    setTimeout(() => {
      window.location.reload()
    }, 1500)
  }

  return { updateAvailable, updating, applyUpdate }
}
