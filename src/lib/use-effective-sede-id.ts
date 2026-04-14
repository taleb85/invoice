'use client'

import { useCallback, useEffect, useState } from 'react'
import { useMe, type MeData } from '@/lib/me-context'
import { useActiveOperator } from '@/lib/active-operator-context'

function readAdminSedeCookie(): string | null {
  if (typeof document === 'undefined') return null
  const m = document.cookie.match(/(?:^|;\s*)admin-sede-id=([^;]*)/)
  const v = m?.[1] ? decodeURIComponent(m[1]).trim() : ''
  return v || null
}

export type ManualDeliverySedeContext = {
  meLoading: boolean
  me: MeData | null
  /** Sede per query fornitori / form */
  effectiveSedeId: string | null
  /** Stessa regola precedente: admin solo con operatore attivo o cookie sede */
  visible: boolean
}

/**
 * Contesto sede per consegna manuale (dashboard): allineato alla logica originale
 * (`operatoreSedeMode` + `effectiveSedeId`).
 */
export function useManualDeliverySede(): ManualDeliverySedeContext {
  const { me, loading: meLoading } = useMe()
  const { activeOperator } = useActiveOperator()
  const [cookieSedeId, setCookieSedeId] = useState<string | null>(null)

  const refreshCookie = useCallback(() => {
    setCookieSedeId(readAdminSedeCookie())
  }, [])

  useEffect(() => {
    refreshCookie()
    const onFocus = () => refreshCookie()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refreshCookie])

  /** Dopo cambio operatore (modal PIN) il master aggiorna `admin-sede-id` senza cambiare focus finestra. */
  useEffect(() => {
    refreshCookie()
  }, [activeOperator?.id, refreshCookie])

  useEffect(() => {
    const onOpChange = () => refreshCookie()
    window.addEventListener('fluxo:active-operator-changed', onOpChange)
    return () => window.removeEventListener('fluxo:active-operator-changed', onOpChange)
  }, [refreshCookie])

  const effectiveSedeId =
    activeOperator?.sede_id?.trim() ||
    (me?.is_admin ? cookieSedeId : null) ||
    me?.sede_id?.trim() ||
    null

  const operatoreSedeMode = !!activeOperator || !!cookieSedeId
  const visible =
    !!me &&
    !meLoading &&
    (!me.is_admin || operatoreSedeMode) &&
    !!effectiveSedeId

  return { me, meLoading, effectiveSedeId, visible }
}
