'use client'

import { useMe } from '@/lib/me-context'
import NotificationBell from '@/components/NotificationBell'

/** Campana notifiche (striscia header desktop). */
export default function DesktopHeaderToolbar() {
  const { me } = useMe()
  const isAdmin = Boolean(me?.is_admin)

  return (
    <NotificationBell
      variant="header"
      isAdmin={isAdmin}
      initialAdminErrors={0}
      initialOperatorPending={0}
      initialOperatorLogErrors={0}
    />
  )
}
