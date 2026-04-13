'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

type NetworkContextValue = {
  /** navigator.onLine + ultimo probe HTTP riuscito (quando eseguito). */
  online: boolean
  lastChangeAt: number
  /** Verifica reale verso l’app (best-effort). */
  probeReachable: () => Promise<boolean>
}

const NetworkContext = createContext<NetworkContextValue | null>(null)

export function NetworkProvider({ children }: { children: ReactNode }) {
  /** Stesso valore su SSR e primo paint client → niente hydration mismatch (evita navigator “finto” su server). */
  const [online, setOnline] = useState(true)
  const [lastChangeAt, setLastChangeAt] = useState(0)

  const syncFromNavigator = useCallback(() => {
    setOnline(navigator.onLine)
    setLastChangeAt(Date.now())
  }, [])

  useEffect(() => {
    syncFromNavigator()
    window.addEventListener('online', syncFromNavigator)
    window.addEventListener('offline', syncFromNavigator)
    return () => {
      window.removeEventListener('online', syncFromNavigator)
      window.removeEventListener('offline', syncFromNavigator)
    }
  }, [syncFromNavigator])

  const probeReachable = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !navigator.onLine) return false
    try {
      const ac = new AbortController()
      const t = window.setTimeout(() => ac.abort(), 4000)
      const r = await fetch('/api/me', { method: 'GET', cache: 'no-store', signal: ac.signal })
      window.clearTimeout(t)
      const ok = r.ok
      setOnline(ok)
      setLastChangeAt(Date.now())
      return ok
    } catch {
      setOnline(false)
      setLastChangeAt(Date.now())
      return false
    }
  }, [])

  const value = useMemo(
    () => ({ online, lastChangeAt, probeReachable }),
    [online, lastChangeAt, probeReachable]
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
