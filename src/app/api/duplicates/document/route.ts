import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getProfile } from '@/utils/supabase/server'
import { isMasterAdminRole, isAdminSedeRole } from '@/lib/roles'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

const VALID_ENTITIES = new Set(['fatture', 'bolle', 'fornitori'])

export async function GET(req: NextRequest) {
  const profile = await getProfile()
  const isMaster = isMasterAdminRole(profile?.role)
  const isAdminSede = isAdminSedeRole(profile?.role)

  if (!isMaster && !isAdminSede) {
    return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')?.trim()
  const entity = searchParams.get('entity')?.trim()

  if (!id || !entity || !VALID_ENTITIES.has(entity)) {
    return NextResponse.json({ error: 'Parametri mancanti o non validi' }, { status: 400 })
  }

  let sedeId = profile?.sede_id ?? null
  if (isMaster && !sedeId) {
    const cookieStore = await cookies()
    sedeId = cookieStore.get('admin-sede-id')?.value?.trim() || null
  }

  const service = createServiceClient()

  if (entity === 'fatture') {
    const { data, error } = await service
      .from('fatture')
      .select('*, fornitore:fornitori(id, nome, email, piva), sede:sedi(id, nome)')
      .eq('id', id)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Documento non trovato' }, { status: 404 })
    if (sedeId && data.sede_id !== sedeId) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
    }
    return NextResponse.json({ ok: true, entity: 'fatture', document: data })
  }

  if (entity === 'bolle') {
    const { data, error } = await service
      .from('bolle')
      .select('*, fornitore:fornitori(id, nome, email, piva), sede:sedi(id, nome)')
      .eq('id', id)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Documento non trovato' }, { status: 404 })
    if (sedeId && data.sede_id !== sedeId) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
    }
    const { count: fattureCount } = await service
      .from('fatture')
      .select('id', { count: 'exact', head: true })
      .eq('bolla_id', id)
    return NextResponse.json({
      ok: true,
      entity: 'bolle',
      document: { ...data, fatture_count: fattureCount ?? 0 },
    })
  }

  if (entity === 'fornitori') {
    const { data, error } = await service
      .from('fornitori')
      .select('*, sede:sedi(id, nome)')
      .eq('id', id)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Fornitore non trovato' }, { status: 404 })
    if (sedeId && data.sede_id !== sedeId) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
    }
    const [{ count: fattureCount }, { count: bolleCount }] = await Promise.all([
      service.from('fatture').select('id', { count: 'exact', head: true }).eq('fornitore_id', id),
      service.from('bolle').select('id', { count: 'exact', head: true }).eq('fornitore_id', id),
    ])
    return NextResponse.json({
      ok: true,
      entity: 'fornitori',
      document: { ...data, fatture_count: fattureCount ?? 0, bolle_count: bolleCount ?? 0 },
    })
  }

  return NextResponse.json({ error: 'Entity non valida' }, { status: 400 })
}
