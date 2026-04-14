'use client'

import {
  createContext, useCallback, useContext,
  useEffect, useRef, useState, ReactNode,
} from 'react'

export interface ActiveOperator {
  id:        string
  full_name: string
  sede_id:   string
  sede_nome: string | null
  /** Profilo reale dopo verifica PIN (`operatore` | `admin_sede`). Assente = legacy → operatore. */
  role?: 'operatore' | 'admin_sede' | null
}

interface ActiveOperatorContextValue {
  activeOperator:      ActiveOperator | null
  /** Salva anche `boundAuthUserId` (es. `me.user.id`) quando l’operatore è scelto dopo login. */
  setActiveOperator:   (op: ActiveOperator | null, boundAuthUserId?: string | null) => void
  clearActiveOperator: () => void
  /** Timeout inattività in minuti. 0 = disabilitato. */
  inactivityTimeout:    number
  setInactivityTimeout: (mins: number) => void
  /** Apre/chiude il modal di cambio operatore */
  showSwitchModal:  boolean
  openSwitchModal:  () => void
  closeSwitchModal: () => void
}

export const FLUXO_ACTIVE_OPERATOR_KEY = 'fluxo-active-operator'
/** Profilo auth (Supabase) che ha confermato l’operatore via PIN — evita di mostrare operatori di altri account sullo stesso browser. */
export const FLUXO_ACTIVE_OPERATOR_USER_KEY = 'fluxo-active-operator-user'

const STORAGE_KEY = FLUXO_ACTIVE_OPERATOR_KEY
const BOUND_USER_KEY = FLUXO_ACTIVE_OPERATOR_USER_KEY
const TIMEOUT_KEY  = 'fluxo-inactivity-timeout'

const Ctx = createContext<ActiveOperatorContextValue>({
  activeOperator:       null,
  setActiveOperator:    () => {},
  clearActiveOperator:  () => {},
  inactivityTimeout:    0,
  setInactivityTimeout: () => {},
  showSwitchModal:  false,
  openSwitchModal:  () => {},
  closeSwitchModal: () => {},
})

export function ActiveOperatorProvider({ children }: { children: ReactNode }) {
  const [activeOperator, setActiveOperatorState] = useState<ActiveOperator | null>(null)
  const [inactivityTimeout, setInactivityTimeoutState] = useState(0)
  const [showSwitchModal, setShowSwitchModal]           = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* ── Bootstrap from localStorage (client only) ──
   * Senza `fluxo-active-operator-user` non ripristiniamo: dati legacy o altro account. */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const bound = localStorage.getItem(BOUND_USER_KEY)
      if (raw && bound) setActiveOperatorState(JSON.parse(raw))
      const t = localStorage.getItem(TIMEOUT_KEY)
      if (t) setInactivityTimeoutState(Number(t))
    } catch { /* ignore */ }
  }, [])

  /* ── Persist to localStorage on change ── */
  const setActiveOperator = useCallback((op: ActiveOperator | null, boundAuthUserId?: string | null) => {
    setActiveOperatorState(op)
    try {
      if (op) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(op))
        const uid = boundAuthUserId?.trim()
        if (uid) localStorage.setItem(BOUND_USER_KEY, uid)
        else localStorage.removeItem(BOUND_USER_KEY)
      } else {
        localStorage.removeItem(STORAGE_KEY)
        localStorage.removeItem(BOUND_USER_KEY)
      }
    } catch { /* ignore */ }
  }, [])

  const clearActiveOperator = useCallback(() => setActiveOperator(null), [setActiveOperator])

  const setInactivityTimeout = useCallback((mins: number) => {
    setInactivityTimeoutState(mins)
    try { localStorage.setItem(TIMEOUT_KEY, String(mins)) } catch { /* ignore */ }
  }, [])

  /* ── Inactivity timer ── */
  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (inactivityTimeout > 0 && activeOperator) {
      timerRef.current = setTimeout(() => {
        setShowSwitchModal(true)
      }, inactivityTimeout * 60 * 1000)
    }
  }, [inactivityTimeout, activeOperator])

  useEffect(() => {
    if (inactivityTimeout <= 0 || !activeOperator) {
      if (timerRef.current) clearTimeout(timerRef.current)
      return
    }
    const events = ['mousemove', 'keydown', 'touchstart', 'click', 'scroll']
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }))
    resetTimer()
    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer))
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [inactivityTimeout, activeOperator, resetTimer])

  const openSwitchModal  = useCallback(() => setShowSwitchModal(true),  [])
  const closeSwitchModal = useCallback(() => setShowSwitchModal(false), [])

  return (
    <Ctx.Provider value={{
      activeOperator, setActiveOperator, clearActiveOperator,
      inactivityTimeout, setInactivityTimeout,
      showSwitchModal, openSwitchModal, closeSwitchModal,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export function useActiveOperator() {
  return useContext(Ctx)
}
