import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getProfile, getRequestAuth } from '@/utils/supabase/server'
import { isMasterAdminRole, isAdminSedeRole } from '@/lib/roles'
import { logActivity } from '@/lib/activity-logger'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

type DeleteBody = {
  ids: string[]
  entity: 'fatture' | 'bolle' | 'fornitori'
}

const VALID_ENTITIES = new Set(['fatture', 'bolle', 'fornitori'])

export async function POST(req: NextRequest) {
  const profile = await getProfile()
  const isMaster = isMasterAdminRole(profile?.role)
  const isAdminSede = isAdminSedeRole(profile?.role)

  if (!isMaster && !isAdminSede) {
    return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
  }

  let body: DeleteBody
  try {
    body = (await req.json()) as DeleteBody
  } catch {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 })
  }

  const { ids, entity } = body
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids mancanti' }, { status: 400 })
  }
  if (!entity || !VALID_ENTITIES.has(entity)) {
    return NextResponse.json({ error: 'entity non valida' }, { status: 400 })
  }

  // Limit bulk deletions for safety
  if (ids.length > 500) {
    return NextResponse.json({ error: 'Troppi ID (max 500 per richiesta)' }, { status: 400 })
  }

  // Determine sedeId
  let sedeId = profile?.sede_id ?? null
  if (isMaster && !sedeId) {
    const cookieStore = await cookies()
    const adminPick = cookieStore.get('admin-sede-id')?.value?.trim() || null
    if (adminPick) sedeId = adminPick
  }

  const service = createServiceClient()

  // Verify all IDs belong to the acting sede (security check)
  if (sedeId) {
    const { data: check, error: checkErr } = await service
      .from(entity)
      .select('id')
      .in('id', ids)
      .eq('sede_id', sedeId)
    if (checkErr) {
      return NextResponse.json({ error: checkErr.message }, { status: 500 })
    }
    // For fornitori, sede_id check is available
    const foundIds = new Set((check ?? []).map((r: { id: string }) => r.id))
    const invalid = ids.filter((id) => !foundIds.has(id))
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: `${invalid.length} ID non appartengono alla sede corrente` },
        { status: 403 },
      )
    }
  }

  const { error: deleteError } = await service.from(entity).delete().in('id', ids)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  // Log the bulk deletion
  const { user } = await getRequestAuth()
  if (user) {
    const entityLabels: Record<string, string> = {
      fatture: 'fatture',
      bolle: 'bolle',
      fornitori: 'fornitori',
    }
    await logActivity(service, {
      userId: user.id,
      sedeId,
      action: 'duplicate.bulk_deleted',
      entityType: entity,
      entityLabel: `${ids.length} ${entityLabels[entity] ?? entity} duplicati eliminati`,
      metadata: { count: ids.length, entity, ids },
    })
  }

  return NextResponse.json({ ok: true, deleted: ids.length })
}
