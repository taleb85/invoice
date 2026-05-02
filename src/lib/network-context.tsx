'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

const RECONNECTING_MS = 2800

type NetworkContextValue = {
  /** navigator.onLine + ultimo probe HTTP riuscito (quando eseguito). */
  online: boolean
  /** Subito dopo il ripristino da offline (UI: pallino arancione lampeggiante). */
  reconnecting: boolean
  lastChangeAt: number
  /** Verifica reale verso l’app (best-effort). */
  probeReachable: () => Promise<boolean>
}

const NetworkContext = createContext<NetworkContextValue | null>(null)

export function NetworkProvider({ children }: { children: ReactNode }) {
  /** Stesso valore su SSR e primo paint client → niente hydration mismatch (evita navigator “finto” su server). */
  const [online, setOnline] = useState(true)
  const [reconnecting, setReconnecting] = useState(false)
  const [lastChangeAt, setLastChangeAt] = useState(0)
  const wasOfflineRef = useRef(false)
  const reconnectingClearRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const syncFromNavigator = useCallback(() => {
    const nowOnline = navigator.onLine
    if (!nowOnline) {
      wasOfflineRef.current = true
      if (reconnectingClearRef.current) {
        clearTimeout(reconnectingClearRef.current)
        reconnectingClearRef.current = null
      }
      setReconnecting(false)
      setOnline(false)
    } else {
      setOnline(true)
      if (wasOfflineRef.current) {
        wasOfflineRef.current = false
        setReconnecting(true)
        if (reconnectingClearRef.current) clearTimeout(reconnectingClearRef.current)
        reconnectingClearRef.current = setTimeout(() => {
          setReconnecting(false)
          reconnectingClearRef.current = null
        }, RECONNECTING_MS)
      }
    }
    setLastChangeAt(Date.now())
  }, [])

  useEffect(() => {
    syncFromNavigator()
    window.addEventListener('online', syncFromNavigator)
    window.addEventListener('offline', syncFromNavigator)
    return () => {
      window.removeEventListener('online', syncFromNavigator)
      window.removeEventListener('offline', syncFromNavigator)
      if (reconnectingClearRef.current) clearTimeout(reconnectingClearRef.current)
    }
  }, [syncFromNavigator])

  const probeReachable = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !navigator.onLine) return false
    try {
      const ac = new AbortController()
      const t = window.setTimeout(() => ac.abort(), 4000)
      const r = await fetch('/api/me', {
        method: 'GET',
        cache: 'no-store',
        credentials: 'include',
        signal: ac.signal,
      })
      window.clearTimeout(t)
      const ok = r.ok || r.status === 401 || r.status === 404
      setOnline(ok)
      setLastChangeAt(Date.now())
      if (!ok) setReconnecting(false)
      return ok
    } catch {
      setOnline(false)
      setReconnecting(false)
      setLastChangeAt(Date.now())
      return false
    }
  }, [])

  const value = useMemo(
    () => ({ online, reconnecting, lastChangeAt, probeReachable }),
    [online, reconnecting, lastChangeAt, probeReachable]
  )

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>
}

export function useNetworkStatus(): NetworkContextValue {
  const ctx = useContext(NetworkContext)
  if (!ctx) {
    throw new Error('useNetworkStatus must be used within NetworkProvider')
  }
  return ctx
}

/** Per componenti fuori dal provider (es. pagine rare). */
export function useNetworkStatusOptional(): NetworkContextValue | null {
  return useContext(NetworkContext)
}
