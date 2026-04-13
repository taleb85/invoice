'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import type { NotificationBadgePayload } from '@/types/notification-badge'

type Options = {
  isAdmin: boolean
  effectiveSedeId: string | null
  initialAdminErrors: number
  initialOperatorPending: number
  initialOperatorLogErrors: number
}

export function useNotificationCounts({
  isAdmin,
  effectiveSedeId,
  initialAdminErrors,
  initialOperatorPending,
  initialOperatorLogErrors,
}: Options) {
  const pathname = usePathname()
  const [adminLogErrors24h, setAdminLogErrors24h] = useState(initialAdminErrors)
  const [operatorPendingDocs, setOperatorPendingDocs] = useState(initialOperatorPending)
  const [operatorLogErrors24h, setOperatorLogErrors24h] = useState(initialOperatorLogErrors)

  const load = useCallback(async () => {
    const q =
      effectiveSedeId && effectiveSedeId.length > 0
        ? `?sede_id=${encodeURIComponent(effectiveSedeId)}`
        : ''
    try {
      const r = await fetch(`/api/notification-badge${q}`, { cache: 'no-store' })
      if (!r.ok) return
      const d = (await r.json()) as NotificationBadgePayload
      setAdminLogErrors24h(d.adminLogErrors24h ?? 0)
      setOperatorPendingDocs(d.operatorPendingDocs ?? 0)
      setOperatorLogErrors24h(d.operatorLogErrors24h ?? 0)
    } catch {
      /* ignore */
    }
  }, [effectiveSedeId])

  useEffect(() => {
    setAdminLogErrors24h(initialAdminErrors)
    setOperatorPendingDocs(initialOperatorPending)
    setOperatorLogErrors24h(initialOperatorLogErrors)
  }, [initialAdminErrors, initialOperatorPending, initialOperatorLogErrors])

  useEffect(() => {
    void load()
  }, [load, pathname])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') void load()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [load])

  const badgeCount = isAdmin ? adminLogErrors24h : operatorPendingDocs
  const badgeVariant: 'error' | 'pending' | 'none' =
    badgeCount <= 0 ? 'none' : isAdmin ? 'error' : 'pending'

  return {
    adminLogErrors24h,
    operatorPendingDocs,
    operatorLogErrors24h,
    badgeCount,
    badgeVariant,
    refresh: load,
  }
}
