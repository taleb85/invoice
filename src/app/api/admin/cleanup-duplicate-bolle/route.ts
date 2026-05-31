import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServiceClient, getProfile } from '@/utils/supabase/server'
import { isMasterAdminRole, isSedePrivilegedRole } from '@/lib/roles'
import { cleanupDuplicateBolle } from '@/lib/check-duplicates'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * POST — elimina bolle duplicate in eccesso per **tutta la sede** (tutti i fornitori).
 * Body opzionale: `{ fornitore_id?, dry_run?: boolean }`
 */
export async function POST(req: NextRequest) {
  const profile = await getProfile()
  if (!profile) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }
  if (!isMasterAdminRole(profile.role) && !isSedePrivilegedRole(profile.role)) {
    return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
  }

  let sedeId = profile.sede_id?.trim() || null
  if (isMasterAdminRole(profile.role) && !sedeId) {
    const cookieStore = await cookies()
    sedeId = cookieStore.get('admin-sede-id')?.value?.trim() || null
  }
  if (!sedeId) {
    return NextResponse.json({ error: 'Sede non selezionata' }, { status: 400 })
  }

  let fornitoreId: string | null = null
  let dryRun = false
  try {
    const body = (await req.json().catch(() => ({}))) as {
      fornitore_id?: string
      dry_run?: boolean
    }
    fornitoreId = body.fornitore_id?.trim() || null
    dryRun = body.dry_run === true
  } catch {
    /* empty body ok */
  }

  const service = createServiceClient()
  if (fornitoreId && isSedePrivilegedRole(profile.role)) {
    const { data: f } = await service
      .from('fornitori')
      .select('sede_id')
      .eq('id', fornitoreId)
      .maybeSingle()
    if (!f || f.sede_id !== profile.sede_id) {
      return NextResponse.json({ error: 'Fornitore non nella sede' }, { status: 403 })
    }
  }

  const result = await cleanupDuplicateBolle(service, {
    sedeId,
    fornitoreId,
    dryRun,
  })

  return NextResponse.json({
    ok: true,
    sede_id: sedeId,
    fornitore_id: fornitoreId,
    dry_run: dryRun,
    ...result,
  })
}
