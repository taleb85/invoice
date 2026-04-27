'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useMe } from '@/lib/me-context'
import { useLocale } from '@/lib/locale-context'
import {
  branchSessionGateRequiredRole,
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
 * `canRender` è calcolato in render così, dopo codice sede o PIN, non restiamo con `allowed=false`
 * per un frame o per sempre.
 *
 * `isSessionOperatorGateOk()` legge `sessionStorage`: in SSR non esiste → ogni prima passata
 * diverge dal client. Fino a `clientGateReady` renderizziamo `children` come SSR e al primo
 * client (stessa forma); poi applichiamo il gate. Il redirect a /accesso resta in useLayoutEffect.
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
  const router = useRouter()
  const { me } = useMe()
  const { t } = useLocale()
  const gateStuckRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [clientGateReady, setClientGateReady] = useState(false)

  useLayoutEffect(() => {
    setClientGateReady(true)
  }, [])

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
    if (!needsOperatoreAccesso) return
    if (typeof window === 'undefined') return
    const next = safeNextPath(pathname)
    const url = `${ACCESSO_PATH}?next=${encodeURIComponent(next)}`
    if (window.location.pathname === ACCESSO_PATH) return
    try {
      router.replace(url)
    } catch {
      window.location.replace(url)
    }
  }, [needsOperatoreAccesso, pathname, router])

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

  if (!clientGateReady) {
    return <>{children}</>
  }

  if (!canRender) {
    return <GateLoading label={t.common.loading} />
  }

  return <>{children}</>
}
