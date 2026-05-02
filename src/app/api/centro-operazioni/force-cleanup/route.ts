import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getProfile } from '@/utils/supabase/server'
import { isMasterAdminRole, isSedePrivilegedRole } from '@/lib/roles'
import { retroactiveCleanupDaRevisionare } from '@/lib/documenti-revisione-auto'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const master = isMasterAdminRole(profile.role)
  const sedeRole = isSedePrivilegedRole(profile.role)
  if (!master && !sedeRole) {
    return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
  }

  let bodySede: string | undefined
  try {
    const j = (await req.json()) as { sede_id?: string }
    bodySede = typeof j.sede_id === 'string' ? j.sede_id.trim() : undefined
  } catch {
    bodySede = undefined
  }

  let sedeFilter: string | null
  if (master) {
    sedeFilter = bodySede && bodySede.length > 0 ? bodySede : null
  } else {
    sedeFilter = profile.sede_id ?? null
    if (!sedeFilter) {
      return NextResponse.json({ error: 'Profilo senza sede' }, { status: 400 })
    }
  }

  const service = createServiceClient()
  const result = await retroactiveCleanupDaRevisionare(service, { sedeId: sedeFilter, maxRows: 200 })

  const logSede = sedeFilter ?? profile.sede_id ?? null
  void service
    .from('activity_log')
    .insert([
      {
        user_id: profile.id,
        sede_id: logSede,
        action: 'email.scan.revisione_cleanup',
        entity_type: 'system',
        entity_id: null,
        entity_label: `Cleanup manuale centro operazioni: ${result.processed} processati / ${result.scanned} esaminati`,
        metadata: {
          processed: result.processed,
          scanned: result.scanned,
          error_sample: result.errors.slice(0, 24),
          manual: true,
        },
      },
    ])
    .then(() => {}, () => {})

  return NextResponse.json(result)
}
