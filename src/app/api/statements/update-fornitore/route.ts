import { NextResponse } from 'next/server'
import { createServiceClient, getRequestAuth, getProfile } from '@/utils/supabase/server'
import { isSedePrivilegedRole } from '@/lib/roles'

export async function POST(req: Request) {
  const auth = await getRequestAuth()
  if (!auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getProfile()
  if (!profile || !isSedePrivilegedRole(profile.role)) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }

  const body = await req.json()
  const { rowId, fornitore_id } = body

  if (!rowId || !fornitore_id) {
    return NextResponse.json({ error: 'rowId e fornitore_id obbligatori' }, { status: 400 })
  }

  const service = createServiceClient()

  const { error } = await service
    .from('statement_rows')
    .update({ fornitore_id })
    .eq('id', rowId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, message: 'Fornitore aggiornato' })
}
