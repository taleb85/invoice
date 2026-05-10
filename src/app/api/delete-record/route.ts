import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/utils/supabase/server'
import { requireAdmin } from '@/lib/api-auth'
import { isMasterAdminRole } from '@/lib/roles'
import { logActivity } from '@/lib/activity-logger'

const ALLOWED_TABLES = ['fatture', 'bolle'] as const
type AllowedTable = typeof ALLOWED_TABLES[number]

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { profile } = auth

  let body: { table?: string; id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON non valido' }, { status: 400 })
  }

  const table = body.table?.trim() as AllowedTable | undefined
  const id = body.id?.trim()

  if (!table || !id) {
    return NextResponse.json({ error: 'table e id richiesti' }, { status: 400 })
  }

  if (!ALLOWED_TABLES.includes(table)) {
    return NextResponse.json({ error: `Tabella non consentita: ${table}` }, { status: 403 })
  }

  const service = createServiceClient()

  const { data: entity } = await service
    .from(table)
    .select('id, sede_id, fornitore:fornitori(sede_id)')
    .eq('id', id)
    .maybeSingle()

  if (!entity) return NextResponse.json({ error: 'Record non trovato' }, { status: 404 })

  const entitySede = (entity.sede_id as string | null) ?? (
    entity.fornitore as { sede_id?: string | null } | null
  )?.sede_id ?? null

  if (!isMasterAdminRole(profile.role) && entitySede && profile.sede_id && entitySede !== profile.sede_id) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }

  const { error: delErr } = await service.from(table).delete().eq('id', id)
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

  await logActivity(service, {
    userId: profile.id,
    sedeId: entitySede,
    action: table === 'fatture' ? 'fattura.deleted' : 'bolla.deleted',
    entityType: table === 'fatture' ? 'fattura' : 'bolla',
    entityId: id,
    metadata: { deleted_from: table },
  })

  return NextResponse.json({ ok: true as const })
}
