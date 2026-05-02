import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getRequestAuth } from '@/utils/supabase/server'
import { isMasterAdminRole } from '@/lib/roles'

/**
 * Lista operatori di sede per dropdown / cambio operatore.
 * Service role dopo auth; non richiede RLS sul profilo in lettura.
 *
 * Query: `sedeId` o `sede_id` (stesso significato). Senza sede: master → tutti i profili
 * eligible; altrimenti → solo utenti della sede del profilo.
 */
export async function GET(req: NextRequest) {
  const { user } = await getRequestAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: profile, error: profileErr } = await service
    .from('profiles')
    .select('role, sede_id')
    .eq('id', user.id)
    .maybeSingle()

  if (profileErr || !profile) {
    return NextResponse.json({ error: 'Profilo non disponibile.' }, { status: 403 })
  }

  const rawSede =
    req.nextUrl.searchParams.get('sedeId')?.trim() ||
    req.nextUrl.searchParams.get('sede_id')?.trim() ||
    null
  const master = isMasterAdminRole(profile.role)
  const ownSede =
    profile.sede_id && String(profile.sede_id).trim() !== '' ? String(profile.sede_id).trim() : null

  let targetSede: string | null = null
  if (rawSede) {
    if (!master && ownSede !== rawSede) {
      return NextResponse.json({ error: 'Non autorizzato per questa sede.' }, { status: 403 })
    }
    targetSede = rawSede
  } else if (!master) {
    targetSede = ownSede
  }

  let q = service
    .from('profiles')
    .select('id, full_name, role')
    .in('role', ['operatore', 'admin_sede', 'admin_tecnico'])
    .order('full_name')

  if (targetSede) {
    q = q.eq('sede_id', targetSede)
  }

  const { data, error } = await q
  if (error) {
    console.error('[operators-for-sede]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ operators: data ?? [] })
}
