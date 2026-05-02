import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/utils/supabase/server'
import { isMasterAdminRole, isSedePrivilegedRole } from '@/lib/roles'
import { clearSessionActivity } from '@/lib/session-activity'
import { logActivity } from '@/lib/activity-logger'

/**
 * POST /api/operator/change-pin
 *
 * Admin or admin_sede can rotate any operator's PIN (password) in their sede.
 * On success all existing sessions for that operator are invalidated globally.
 *
 * Body: { operatorId: string, newPin: string }
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, sede_id')
    .eq('id', user.id)
    .single()

  const isMaster = isMasterAdminRole(profile?.role)
  const isAdminS = isSedePrivilegedRole(profile?.role)
  if (!isMaster && !isAdminS) {
    return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
  }

  let body: { operatorId?: string; newPin?: string }
  try {
    body = (await req.json()) as { operatorId?: string; newPin?: string }
  } catch {
    return NextResponse.json({ error: 'Body JSON non valido' }, { status: 400 })
  }

  const { operatorId, newPin } = body
  if (!operatorId || !newPin || String(newPin).length < 4) {
    return NextResponse.json(
      { error: 'operatorId e newPin (min 4 caratteri) sono obbligatori' },
      { status: 400 },
    )
  }

  const service = createServiceClient()

  // Verify the target is actually an operatore
  const { data: opProfile } = await service
    .from('profiles')
    .select('role, sede_id, full_name')
    .eq('id', operatorId)
    .single()

  if (!opProfile || opProfile.role !== 'operatore') {
    return NextResponse.json({ error: 'Operatore non trovato' }, { status: 404 })
  }

  // Admin sede can only change PINs for operators in their own sede
  if (isAdminS && opProfile.sede_id !== profile?.sede_id) {
    return NextResponse.json(
      { error: "Non puoi modificare operatori di un'altra sede" },
      { status: 403 },
    )
  }

  // Update the Supabase Auth password (operatore uses PIN as password)
  const { error: updateErr } = await service.auth.admin.updateUserById(operatorId, {
    password: String(newPin),
  })

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  // Invalidate all existing sessions for this operator across all devices
  await service.auth.admin.signOut(operatorId, 'global')

  // Clear server-side session-activity tracking so the inactivity timer resets
  await clearSessionActivity(service, operatorId)

  logActivity(service, {
    userId: user.id,
    sedeId: (opProfile as { sede_id?: string | null }).sede_id ?? profile?.sede_id ?? null,
    action: 'operatore.pin_changed',
    entityType: 'operatore',
    entityId: operatorId,
    entityLabel: opProfile.full_name ?? undefined,
  }).catch(() => {})

  return NextResponse.json({
    ok: true,
    message: `PIN aggiornato per ${opProfile.full_name ?? operatorId}. Tutte le sessioni attive sono state invalidate.`,
  })
}
