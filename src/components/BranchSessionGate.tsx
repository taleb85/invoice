'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
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
 * `canRender` è calcolato in render (non solo in useEffect) così, dopo codice sede o PIN,
 * non restiamo con `allowed=false` per un frame / per sempre se l’effetto non aggiorna lo stato.
 */
export default function BranchSessionGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { me, loading } = useMe()
  const { t } = useLocale()

  const onAccesso = isAccessoPath(pathname)
  const canRender =
    onAccesso ||
    !me?.user ||
    !branchSessionGateRequiredRole(me.role) ||
    isSessionOperatorGateOk()

  useEffect(() => {
    if (loading) return
    if (onAccesso || !me?.user || !branchSessionGateRequiredRole(me.role)) return
    if (isSessionOperatorGateOk()) return

    const next = safeNextPath(pathname)
    if (typeof window !== 'undefined') {
      const url = `${ACCESSO_PATH}?next=${encodeURIComponent(next)}`
      if (window.location.pathname !== ACCESSO_PATH) {
        window.location.assign(url)
      }
    }
  }, [loading, me?.user, me?.role, pathname, onAccesso])

  if (!canRender) {
    return (
      <div
        className="flex min-h-[40vh] flex-1 flex-col items-center justify-center gap-3 px-4 py-16"
        role="status"
        aria-live="polite"
      >
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-app-cyan-400 border-t-transparent" />
        <p className="text-sm text-app-fg-muted">{t.common.loading}</p>
      </div>
    )
  }

  return <>{children}</>
}
