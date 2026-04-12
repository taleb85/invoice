import { NextRequest, NextResponse } from 'next/server'
import { createClient, getProfile } from '@/utils/supabase/server'
import {
  countPendingDocumentiForSede,
  countPendingDocumentiSessionScoped,
  countSyncLogErrors24h,
} from '@/lib/dashboard-notification-counts'
import type { NotificationBadgePayload } from '@/types/notification-badge'

/**
 * Conteggi per badge campanella (mobile + refresh client).
 * Query allineate a `page.tsx` / `dashboard-notification-counts`.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const profile = await getProfile()
  const isAdmin = profile?.role === 'admin'

  const logErrors24h = await countSyncLogErrors24h(supabase)

  let operatorPendingDocs = 0
  if (!isAdmin) {
    const sedeParam = req.nextUrl.searchParams.get('sede_id')?.trim()
    const sedeId = sedeParam || profile?.sede_id?.trim() || null
    if (sedeId) {
      operatorPendingDocs = await countPendingDocumentiForSede(supabase, sedeId)
    } else {
      operatorPendingDocs = await countPendingDocumentiSessionScoped(supabase)
    }
  }

  const payload: NotificationBadgePayload = {
    isAdmin,
    adminLogErrors24h: logErrors24h,
    operatorPendingDocs,
    operatorLogErrors24h: isAdmin ? 0 : logErrors24h,
  }
  return NextResponse.json(payload)
}
