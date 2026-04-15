'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'

type HostContextValue = {
  hostRef: RefObject<HTMLDivElement | null>
  /** Chiamato da `SidebarBrandHeader` sul div host: aggiorna il ref e forza il re-render del portal. */
  registerHost: (el: HTMLDivElement | null) => void
}

const HostContext = createContext<HostContextValue | null>(null)

const noopRegisterHost = (_el: HTMLDivElement | null) => {}

export function DesktopHeaderPageActionsProvider({ children }: { children: ReactNode }) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [, setHostEpoch] = useState(0)

  const registerHost = useCallback((el: HTMLDivElement | null) => {
    hostRef.current = el
    setHostEpoch((n) => n + 1)
  }, [])

  const value = useMemo(() => ({ hostRef, registerHost }), [registerHost])

  return <HostContext.Provider value={value}>{children}</HostContext.Provider>
}

/** Ref callback per il contenitore in `SidebarBrandHeader` (no-op se fuori dal provider). */
export function useDesktopHeaderPageActionsRegisterHost(): (el: HTMLDivElement | null) => void {
  const ctx = useContext(HostContext)
  return ctx?.registerHost ?? noopRegisterHost
}

function useDesktopHeaderPageActionsHost(): HostContextValue {
  const ctx = useContext(HostContext)
  if (!ctx) {
    throw new Error('DesktopHeaderPageActionsProvider is required around the app shell')
  }
  return ctx
}

/**
 * Monta azioni (es. dashboard) nella striscia desktop. Dipende da `registerHost` sulla header
 * (callback ref) così il portal si aggiorna sempre dopo che il nodo host esiste.
 */
export default function DashboardDesktopHeaderActionsPortal({ children }: { children: ReactNode }) {
  const { hostRef } = useDesktopHeaderPageActionsHost()

  if (!hostRef.current) return null
  return createPortal(children, hostRef.current)
}
