import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getRequestAuth } from '@/utils/supabase/server'
import { isBranchSedeStaffRole, isMasterAdminRole } from '@/lib/roles'

const APP_ROLES = ['operatore', 'admin_sede', 'admin_tecnico', 'admin'] as const

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user } = await getRequestAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()

  const { data: caller } = await svc
    .from('profiles')
    .select('role, sede_id')
    .eq('id', user.id)
    .single()

  const master = isMasterAdminRole(caller?.role)
  const sedeStaff = isBranchSedeStaffRole(caller?.role)
  if (!master && !sedeStaff) {
    return NextResponse.json({ error: 'Accesso negato.' }, { status: 403 })
  }

  const { id: targetId } = await params
  const body = (await req.json()) as { full_name?: string | null; role?: string }

  const { data: target } = await svc
    .from('profiles')
    .select('sede_id, role')
    .eq('id', targetId)
    .maybeSingle()

  if (!target) return NextResponse.json({ error: 'Profilo non trovato.' }, { status: 404 })

  const targetRole = String(target.role ?? '').toLowerCase()

  if (sedeStaff) {
    if (!caller?.sede_id || target.sede_id !== caller.sede_id) {
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

  const { error } = await svc.from('profiles').update(updates).eq('id', targetId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
