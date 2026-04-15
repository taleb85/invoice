'use client'

import { useEffect, useState } from 'react'
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

/**
 * Per operatore / admin_sede: finché non c’è conferma nella sessione browser (sessionStorage),
 * reindirizza a /accesso (nome + PIN). Il login iniziale imposta il flag per evitare doppio passaggio.
 */
export default function BranchSessionGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { me, loading } = useMe()
  const { t } = useLocale()
  const [allowed, setAllowed] = useState(
    () => pathname === ACCESSO_PATH || (pathname?.startsWith(`${ACCESSO_PATH}/`) ?? false),
  )

  useEffect(() => {
    if (loading) return

    if (pathname === ACCESSO_PATH || pathname?.startsWith(`${ACCESSO_PATH}/`)) {
      setAllowed(true)
      return
    }

    if (!me?.user) {
      setAllowed(true)
      return
    }

    if (!branchSessionGateRequiredRole(me.role)) {
      setAllowed(true)
      return
    }

    if (isSessionOperatorGateOk()) {
      setAllowed(true)
      return
    }

    const next = safeNextPath(pathname)
    /* Navigazione completa: evita spinner infinito se il client router non aggiorna il path verso /accesso. */
    if (typeof window !== 'undefined') {
      const url = `${ACCESSO_PATH}?next=${encodeURIComponent(next)}`
      if (window.location.pathname !== ACCESSO_PATH) {
        window.location.assign(url)
      }
    }
  }, [loading, me?.user, me?.role, pathname])

  if (!allowed) {
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
