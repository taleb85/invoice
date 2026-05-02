import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { isMasterAdminRole } from '@/lib/roles'

/**
 * Lista operatori di sede per dropdown / cambio operatore.
 * Usa il client di sessione (RLS); non richiede SUPABASE_SERVICE_ROLE_KEY.
 *
 * Query: `sedeId` o `sede_id` (stesso significato). Senza sede: master → tutti i profili
 * eligible; altrimenti → solo utenti della sede del profilo.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autenticato.' }, { status: 401 })
  }

  const { data: profile, error: profileErr } = await supabase
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

  let q = supabase
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
