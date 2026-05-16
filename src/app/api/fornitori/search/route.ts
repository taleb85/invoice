import { NextResponse } from 'next/server'
import { createServiceClient, getProfile, getRequestAuth } from '@/utils/supabase/server'
import { isSedePrivilegedRole } from '@/lib/roles'

export async function GET(req: Request) {
  const auth = await getRequestAuth()
  if (!auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getProfile()
  if (!profile || !isSedePrivilegedRole(profile.role)) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const sedeId = searchParams.get('sede_id')
  const q = searchParams.get('q') || ''

  const service = createServiceClient()

  let query = service
    .from('fornitori')
    .select('id, nome, piva')
    .order('nome')

  if (sedeId) query = query.eq('sede_id', sedeId)
  if (q) {
    query = query.or(
      `nome.ilike.%${q}%,piva.ilike.%${q}%`
    )
  }

  const { data, error } = await query.limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data || [])
}
