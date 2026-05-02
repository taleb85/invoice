import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getRequestAuth } from '@/utils/supabase/server'
import { isMasterAdminRole, isSedePrivilegedRole } from '@/lib/roles'

export async function GET(
  _req: NextRequest,
  segmentCtx: { params: Promise<{ id: string }> },
) {
  const { id } = await segmentCtx.params
  const { user } = await getRequestAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  const { data: profile } = await service
    .from('profiles')
    .select('role, sede_id')
    .eq('id', user.id)
    .single()

  const isMaster = isMasterAdminRole(profile?.role)
  const isAdminSede = isSedePrivilegedRole(profile?.role)
  if (!isMaster && !isAdminSede) {
    return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
  }
  if (isAdminSede && !isMaster && profile?.sede_id !== id) {
    return NextResponse.json({ error: 'Accesso negato a questa sede' }, { status: 403 })
  }

  const { data, error } = await service
    .from('approval_settings')
    .select('id, sede_id, threshold, require_approval, auto_register_fatture')
    .eq('sede_id', id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Return defaults if no settings row exists yet
  return NextResponse.json(
    data ?? { sede_id: id, threshold: 500, require_approval: true, auto_register_fatture: false },
  )
}

export async function POST(
  req: NextRequest,
  segmentCtx: { params: Promise<{ id: string }> },
) {
  const { id } = await segmentCtx.params
  const { user } = await getRequestAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  const { data: profile } = await service
    .from('profiles')
    .select('role, sede_id')
    .eq('id', user.id)
    .single()

  const isMaster = isMasterAdminRole(profile?.role)
  const isAdminSede = isSedePrivilegedRole(profile?.role)
  if (!isMaster && !isAdminSede) {
    return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
  }
  if (isAdminSede && !isMaster && profile?.sede_id !== id) {
    return NextResponse.json({ error: 'Accesso negato a questa sede' }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as {
    threshold?: number
    require_approval?: boolean
    auto_register_fatture?: boolean
  }

  const threshold = Number(body.threshold ?? 500)
  if (!Number.isFinite(threshold) || threshold < 0) {
    return NextResponse.json({ error: 'Soglia non valida' }, { status: 400 })
  }
  const requireApproval = body.require_approval !== false
  const autoRegisterFatture = body.auto_register_fatture === true

  const { data, error } = await service
    .from('approval_settings')
    .upsert(
      {
        sede_id: id,
        threshold,
        require_approval: requireApproval,
        auto_register_fatture: autoRegisterFatture,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'sede_id' },
    )
    .select('id, sede_id, threshold, require_approval, auto_register_fatture')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, settings: data })
}
