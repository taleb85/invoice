import { revalidatePath } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getRequestAuth } from '@/utils/supabase/server'
import { isBranchSedeStaffRole, isMasterAdminRole } from '@/lib/roles'

const APP_ROLES = ['operatore', 'admin_sede', 'admin_tecnico', 'admin'] as const

export async function PATCH(
  req: NextRequest,
  segmentCtx: { params: Promise<{ id: string }> },
) {
  const { user } = await getRequestAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()

  const { data: caller, error: callerErr } = await svc
    .from('profiles')
    .select('role, sede_id')
    .eq('id', user.id)
    .maybeSingle()

  if (callerErr) {
    console.error('[PATCH profiles] caller:', callerErr.message)
    return NextResponse.json({ error: callerErr.message }, { status: 500 })
  }
  if (!caller) {
    return NextResponse.json(
      { error: 'Profilo sessione non trovato nel database. Riavvia il login o contatta l’assistenza.' },
      { status: 403 },
    )
  }

  const master = isMasterAdminRole(caller.role)
  const sedeStaff = isBranchSedeStaffRole(caller.role)
  if (!master && !sedeStaff) {
    return NextResponse.json({ error: 'Accesso negato.' }, { status: 403 })
  }

  const rawParams = await Promise.resolve(segmentCtx.params)
  const targetId = rawParams?.id?.trim()
  if (!targetId) {
    return NextResponse.json({ error: 'Id profilo non valido.' }, { status: 400 })
  }

  const body = (await req.json()) as { full_name?: string | null; role?: string }

  const { data: target } = await svc
    .from('profiles')
    .select('sede_id, role')
    .eq('id', targetId)
    .maybeSingle()

  if (!target) return NextResponse.json({ error: 'Profilo non trovato.' }, { status: 404 })

  const targetRole = String(target.role ?? '').toLowerCase()

  if (sedeStaff) {
    if (!caller.sede_id || target.sede_id !== caller.sede_id) {
      return NextResponse.json({ error: 'Puoi modificare solo profili della tua sede.' }, { status: 403 })
    }
    if (targetRole === 'admin') {
      return NextResponse.json({ error: 'Non puoi modificare questo profilo.' }, { status: 403 })
    }
    if (body.role !== undefined) {
      const r = String(body.role).toLowerCase()
      if (r !== 'operatore' && r !== 'admin_sede' && r !== 'admin_tecnico') {
        return NextResponse.json({ error: 'Ruolo non consentito.' }, { status: 403 })
      }
    }
  }

  if (master && body.role !== undefined) {
    const r = String(body.role).toLowerCase()
    if (!APP_ROLES.includes(r as (typeof APP_ROLES)[number])) {
      return NextResponse.json({ error: 'Ruolo non valido.' }, { status: 400 })
    }
  }

  const updates: { full_name?: string | null; role?: string } = {}
  if (body.full_name !== undefined) {
    const fn = typeof body.full_name === 'string' ? body.full_name.trim().toUpperCase() : ''
    updates.full_name = fn || null
  }
  if (body.role !== undefined) {
    updates.role = String(body.role).toLowerCase()
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nessun campo da aggiornare.' }, { status: 400 })
  }

  const { data: patched, error } = await svc
    .from('profiles')
    .update(updates)
    .eq('id', targetId)
    .select('id, role, full_name')
    .maybeSingle()

  if (error) {
    console.error('[PATCH profiles] update:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!patched) {
    return NextResponse.json(
      { error: 'Aggiornamento non applicato: nessuna riga modificata (id non trovato?).' },
      { status: 404 },
    )
  }

  const sedeSlug = typeof target.sede_id === 'string' ? target.sede_id.trim() : ''
  if (sedeSlug) {
    revalidatePath(`/sedi/${sedeSlug}`)
  }
  revalidatePath('/sedi')

  return NextResponse.json({ ok: true, profile: patched })
}
