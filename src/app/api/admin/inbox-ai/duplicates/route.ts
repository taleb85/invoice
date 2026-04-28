import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getProfile } from '@/utils/supabase/server'
import { isMasterAdminRole, isAdminSedeRole } from '@/lib/roles'
import { cookies } from 'next/headers'
import {
  fetchEnrichedDuplicateBolleGroups,
  fetchEnrichedDuplicateFattureGroups,
} from '@/lib/inbox-ai-duplicate-groups'

export const dynamic = 'force-dynamic'

/**
 * GET — gruppi di fatture/bolle duplicate con dettaglio (bolla_id, fattura collegata a bolla).
 * Stesso modello di autorizzazione di `/api/duplicates/detect`.
 */
export async function GET(req: NextRequest) {
  const profile = await getProfile()
  const isMaster = isMasterAdminRole(profile?.role)
  const isAdminSede = isAdminSedeRole(profile?.role)

  if (!isMaster && !isAdminSede) {
    return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
  }

  const url = new URL(req.url)
  let sedeId = url.searchParams.get('sede_id')?.trim() || null

  if (isAdminSede && profile?.sede_id) {
    if (sedeId && sedeId !== profile.sede_id) {
      return NextResponse.json({ error: 'Sede non consentita' }, { status: 403 })
    }
    sedeId = profile.sede_id
  }

  if (isMaster && !sedeId) {
    const cookieStore = await cookies()
    const adminPick = cookieStore.get('admin-sede-id')?.value?.trim() || null
    if (adminPick) sedeId = adminPick
  }

  if (!sedeId) {
    return NextResponse.json({ error: 'Sede non selezionata' }, { status: 400 })
  }

  const service = createServiceClient()
  const [fatture_groups, bolle_groups] = await Promise.all([
    fetchEnrichedDuplicateFattureGroups(service, sedeId),
    fetchEnrichedDuplicateBolleGroups(service, sedeId),
  ])

  return NextResponse.json({
    ok: true as const,
    sede_id: sedeId,
    fatture_groups,
    bolle_groups,
  })
}
