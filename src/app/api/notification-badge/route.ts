import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getRequestAuth } from '@/utils/supabase/server'
import {
  countPendingDocumentiForSede,
  countPendingDocumentiSessionScoped,
  countSyncLogErrors24h,
  countSyncLogErrors24hForSede,
} from '@/lib/dashboard-notification-counts'
import type { NotificationBadgePayload } from '@/types/notification-badge'

/**
 * Conteggi per badge campanella (mobile + refresh client).
 * Query allineate a `page.tsx` / `dashboard-notification-counts`.
 */
export async function GET(req: NextRequest) {
  const { user } = await getRequestAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  /** Un solo round-trip: evita `getProfile()` che rifà `getUser()` + select pesante. */
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, sede_id')
    .eq('id', user.id)
    .maybeSingle()

  const isMasterAdmin = profile?.role === 'admin'
  const isAdminSede = profile?.role === 'admin_sede'

  const logErrorsGlobal = isMasterAdmin ? await countSyncLogErrors24h(supabase) : 0

  let operatorPendingDocs = 0
  let operatorLogErrorsScoped = 0
  if (!isMasterAdmin) {
    const sedeParam = req.nextUrl.searchParams.get('sede_id')?.trim()
    const sedeId = sedeParam || profile?.sede_id?.trim() || null
    if (sedeId) {
      operatorPendingDocs = await countPendingDocumentiForSede(supabase, sedeId)
    } else {
      operatorPendingDocs = await countPendingDocumentiSessionScoped(supabase)
    }
    if (isAdminSede && profile?.sede_id) {
      operatorLogErrorsScoped = await countSyncLogErrors24hForSede(supabase, profile.sede_id)
    }
  }

  const payload: NotificationBadgePayload = {
    isAdmin: isMasterAdmin,
    adminLogErrors24h: logErrorsGlobal,
    operatorPendingDocs,
    operatorLogErrors24h: operatorLogErrorsScoped,
  }
  return NextResponse.json(payload)
}
