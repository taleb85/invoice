import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServiceClient, getProfile } from '@/utils/supabase/server'
import { isAdminTecnicoRole, isMasterAdminRole } from '@/lib/roles'

export const dynamic = 'force-dynamic'

const CLEANUP_ACTION = 'email.scan.revisione_cleanup'

function startOfUtcDay(d: Date): string {
  const x = new Date(d)
  x.setUTCHours(0, 0, 0, 0)
  return x.toISOString()
}

export async function GET() {
  const profile = await getProfile()
  const master = isMasterAdminRole(profile?.role)
  const tecnico = isAdminTecnicoRole(profile?.role)
  if (!master && !tecnico) {
    return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
  }

  let scopeSedeId: string | null = profile?.sede_id ?? null
  if (master && !scopeSedeId) {
    const cookieStore = await cookies()
    const adminPick = cookieStore.get('admin-sede-id')?.value?.trim() || null
    if (adminPick) scopeSedeId = adminPick
  }

  const service = createServiceClient()

  let qLast = service
    .from('activity_log')
    .select('id, created_at, metadata')
    .eq('action', CLEANUP_ACTION)
    .order('created_at', { ascending: false })
    .limit(1)
  if (scopeSedeId) qLast = qLast.eq('sede_id', scopeSedeId) as typeof qLast

  const { data: lastRows, error: e1 } = await qLast
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })

  const last = (lastRows?.[0] ?? null) as {
    created_at: string
    metadata: { processed?: number; scanned?: number; error_sample?: string[] } | null
  } | null

  const dayStart = startOfUtcDay(new Date())
  let qDay = service
    .from('activity_log')
    .select('metadata')
    .eq('action', CLEANUP_ACTION)
    .gte('created_at', dayStart)
  if (scopeSedeId) qDay = qDay.eq('sede_id', scopeSedeId) as typeof qDay

  const { data: dayRows, error: e2 } = await qDay
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })

  let processedToday = 0
  for (const row of dayRows ?? []) {
    const m = (row as { metadata?: { processed?: number } | null }).metadata
    const p = typeof m?.processed === 'number' ? m.processed : 0
    processedToday += p
  }

  const lastMeta = last?.metadata
  const lastErrors = Array.isArray(lastMeta?.error_sample) ? lastMeta!.error_sample : []

  return NextResponse.json({
    lastCleanupAt: last?.created_at ?? null,
    lastCleanupProcessed: typeof lastMeta?.processed === 'number' ? lastMeta.processed : null,
    lastCleanupScanned: typeof lastMeta?.scanned === 'number' ? lastMeta.scanned : null,
    lastCycleErrors: lastErrors,
    documentsAutoProcessedToday: processedToday,
    scopeSedeId,
  })
}
