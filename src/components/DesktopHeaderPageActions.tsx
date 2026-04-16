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

type HostContextValue = {
  hostRef: RefObject<HTMLDivElement | null>
  /** Chiamato da `DesktopHeaderActionsStrip` (host in AppShell): aggiorna il ref e forza il re-render del provider. */
  registerHost: (el: HTMLDivElement | null) => void
}

const HostContext = createContext<HostContextValue | null>(null)

const noopRegisterHost: (el: HTMLDivElement | null) => void = () => {}

export function DesktopHeaderPageActionsProvider({ children }: { children: ReactNode }) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [, bump] = useState(0)

  const registerHost = useCallback((el: HTMLDivElement | null) => {
    hostRef.current = el
    bump((n) => n + 1)
  }, [])

  const value = useMemo(() => ({ hostRef, registerHost }), [registerHost])

  return <HostContext.Provider value={value}>{children}</HostContext.Provider>
}

/** Ref callback per il contenitore delle azioni desktop in AppShell (no-op se fuori dal provider). */
export function useDesktopHeaderPageActionsRegisterHost(): (el: HTMLDivElement | null) => void {
  const ctx = useContext(HostContext)
  return ctx?.registerHost ?? noopRegisterHost
}
