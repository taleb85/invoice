import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getProfile } from '@/utils/supabase/server'
import { isMasterAdminRole, isAdminSedeRole } from '@/lib/roles'
import { activityLabel, activityIcon, type ActivityAction } from '@/lib/activity-logger'

export type ActivityLogRow = {
  id: string
  action: string
  actionLabel: string
  actionIcon: string
  entityType: string
  entityLabel: string | null
  entityId: string | null
  actorName: string | null
  sedeNome: string | null
  createdAt: string
  metadata: Record<string, unknown> | null
}

export async function GET(req: NextRequest) {
  const profile = await getProfile()
  const isMaster = isMasterAdminRole(profile?.role)
  const isAdminSede = isAdminSedeRole(profile?.role)
  if (!isMaster && !isAdminSede) {
    return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const sedeIdParam = searchParams.get('sede_id')
  const userIdParam = searchParams.get('user_id')
  const fornitoreIdParam = searchParams.get('fornitore_id')
  const actionFilter = searchParams.get('action')
  const dateFrom = searchParams.get('date_from')
  const dateTo = searchParams.get('date_to')
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
  const offset = (page - 1) * limit

  const service = createServiceClient()

  let q = service
    .from('activity_log')
    .select(
      'id, action, entity_type, entity_label, entity_id, metadata, created_at, profiles(full_name), sedi(nome)',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  // Scope to own sede for admin_sede
  if (!isMaster && profile?.sede_id) {
    q = q.eq('sede_id', profile.sede_id) as typeof q
  } else if (isMaster && sedeIdParam) {
    q = q.eq('sede_id', sedeIdParam) as typeof q
  }

  if (userIdParam) q = q.eq('user_id', userIdParam) as typeof q
  if (actionFilter) q = q.eq('action', actionFilter) as typeof q
  if (dateFrom) q = q.gte('created_at', dateFrom) as typeof q
  if (dateTo) q = q.lte('created_at', dateTo + 'T23:59:59Z') as typeof q

  // Filter by fornitore: same id as entity (fornitore.*) OR metadata (fatture/doc flows).
  // Avoid `metadata->>fornitore_id` inside `.or()` — some clients/PostgREST URLs misparsed; use @> (cs) on jsonb.
  if (fornitoreIdParam) {
    const containsFornitore = JSON.stringify({ fornitore_id: fornitoreIdParam })
    q = q.or(`entity_id.eq.${fornitoreIdParam},metadata.cs.${containsFornitore}`) as typeof q
  }

  const { data, count, error } = await q

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  type RawRow = {
    id: string
    action: string
    entity_type: string
    entity_label: string | null
    entity_id: string | null
    metadata: Record<string, unknown> | null
    created_at: string
    profiles: { full_name: string | null } | null
    sedi: { nome: string | null } | null
  }

  const activities: ActivityLogRow[] = ((data ?? []) as unknown as RawRow[]).map((row) => ({
    id: row.id,
    action: row.action,
    actionLabel: activityLabel(row.action as ActivityAction),
    actionIcon: activityIcon(row.action as ActivityAction),
    entityType: row.entity_type,
    entityLabel: row.entity_label,
    entityId: row.entity_id,
    actorName: row.profiles?.full_name ?? null,
    sedeNome: row.sedi?.nome ?? null,
    createdAt: row.created_at,
    metadata: row.metadata,
  }))

  return NextResponse.json({ activities, total: count ?? 0, page, limit })
}
