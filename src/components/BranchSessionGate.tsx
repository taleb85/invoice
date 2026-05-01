'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useMe } from '@/lib/me-context'
import { useLocale } from '@/lib/locale-context'
import {
  branchAccessoLoginInFlightRef,
  branchSessionGateRequiredRole,
  clearSessionOperatorGate,
  isSessionOperatorGateOk,
} from '@/lib/session-operator-gate'

const ACCESSO_PATH = '/accesso'

function safeNextPath(raw: string | null | undefined): string {
  const p = (raw ?? '/').trim() || '/'
  if (!p.startsWith('/') || p.startsWith('//')) return '/'
  return p
}

function isAccessoPath(pathname: string | null | undefined): boolean {
  return pathname === ACCESSO_PATH || (pathname?.startsWith(`${ACCESSO_PATH}/`) ?? false)
}

/**
 * Per operatore / admin_sede: finché non c’è conferma nella sessione browser (sessionStorage),
 * reindirizza a /accesso (nome + PIN). Il login iniziale imposta il flag per evitare doppio passaggio.
 *
 * Fino a `clientGateReady` serviamo `children` com’in SSR (nessun sessionStorage lato server),
 * per non divergere dall’HTML idratato. Poi, se serve il passaggio su /accesso, usiamo
 * `window.location.replace` (affidabile in PWA) invece di `router.replace`, che a volte
 * non completa e lascia l’utente su `GateLoading` all’infinito.
 */
function GateLoading({ label }: { label: string }) {
  return (
    <div
      className="flex min-h-[40vh] flex-1 flex-col items-center justify-center gap-3 px-4 py-16"
      role="status"
      aria-live="polite"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-app-cyan-400 border-t-transparent" />
      <p className="text-sm text-app-fg-muted">{label}</p>
    </div>
  )
}

export default function BranchSessionGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { me } = useMe()
  const { t } = useLocale()
  const gateStuckRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [clientGateReady, setClientGateReady] = useState(false)

  const onAccesso = isAccessoPath(pathname)

  const canRender =
    onAccesso ||
    !me?.user ||
    !branchSessionGateRequiredRole(me.role) ||
    isSessionOperatorGateOk()

  const needsOperatoreAccesso =
    !onAccesso &&
    !!me?.user &&
    branchSessionGateRequiredRole(me.role) &&
    !isSessionOperatorGateOk()

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return
    if (onAccesso) {
      setClientGateReady(true)
      return
    }
    if (!me?.user || !branchSessionGateRequiredRole(me.role) || isSessionOperatorGateOk()) {
      setClientGateReady(true)
      return
    }
    const next = safeNextPath(pathname)
    const url = `${ACCESSO_PATH}?next=${encodeURIComponent(next)}`
    if (window.location.pathname === ACCESSO_PATH) {
      setClientGateReady(true)
      return
    }
    window.location.replace(url)
    setClientGateReady(true)
  }, [onAccesso, pathname, me?.user, me?.role])

  useEffect(() => {
    if (!needsOperatoreAccesso) {
      if (gateStuckRef.current) {
        clearTimeout(gateStuckRef.current)
        gateStuckRef.current = null
      }
      return
    }
    if (gateStuckRef.current) return
    gateStuckRef.current = setTimeout(() => {
      gateStuckRef.current = null
      if (typeof window === 'undefined') return
      if (window.location.pathname === ACCESSO_PATH) return
      const next = safeNextPath(pathname)
      window.location.assign(`${ACCESSO_PATH}?next=${encodeURIComponent(next)}`)
    }, 3_000)
    return () => {
      if (gateStuckRef.current) {
        clearTimeout(gateStuckRef.current)
        gateStuckRef.current = null
      }
    }
  }, [needsOperatoreAccesso, pathname])

  /** Fine turno quando l’app/PWA va in background o viene chiusa — il `sp_device_id` resta su localStorage. */
  useEffect(() => {
    function onVisibility() {
      if (typeof document === 'undefined') return
      if (document.visibilityState === 'hidden') {
        if (branchAccessoLoginInFlightRef.current) return
        clearSessionOperatorGate()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  if (!clientGateReady) {
    return <>{children}</>
  }

  if (!canRender) {
    return <GateLoading label={t.common.loading} />
  }

  return <>{children}</>
}
