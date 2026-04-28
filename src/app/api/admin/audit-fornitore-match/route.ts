import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getProfile } from '@/utils/supabase/server'
import { isMasterAdminRole, isAdminSedeRole } from '@/lib/roles'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

type AuditRow = {
  id: string
  mittente: string
  file_name: string | null
  fattura_id: string | null
  bolla_id: string | null
  assigned_fornitore_id: string | null
  fornitore_fattura: string | null
  fornitore_bolla: string | null
}

function resolveSedeId(
  profile: NonNullable<Awaited<ReturnType<typeof getProfile>>>,
  bodySede: string | undefined,
  cookieSede: string | null,
): string | null {
  const master = isMasterAdminRole(profile?.role)
  const isAdminSede = isAdminSedeRole(profile?.role)

  if (isAdminSede && profile.sede_id) {
    const fromBody = bodySede?.trim()
    if (fromBody && fromBody !== profile.sede_id) return null /* forbidden mismatch */
    return profile.sede_id
  }

  if (!master) return null

  return bodySede?.trim() || cookieSede?.trim() || profile.sede_id?.trim() || null
}

/**
 * Lista documenti in coda `associato` il cui mittente non è salvato tra le email alias del fornitore collegato.
 */
export async function POST(req: NextRequest) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const master = isMasterAdminRole(profile.role)
  const sedeAdmin = isAdminSedeRole(profile.role)
  if (!master && !sedeAdmin) {
    return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
  }

  let bodySede: string | undefined
  try {
    const b = await req.json()
    bodySede = typeof b?.sede_id === 'string' ? b.sede_id : undefined
  } catch {
    bodySede = undefined
  }

  const cookieStore = await cookies()
  const adminPick = cookieStore.get('admin-sede-id')?.value ?? null

  const sedeId = resolveSedeId(profile as NonNullable<Awaited<typeof getProfile>>, bodySede, adminPick)

  if (!sedeId) {
    return NextResponse.json({ error: 'sede non selezionata' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data, error } = await service.rpc('admin_audit_fornitore_match', {
    p_sede_id: sedeId,
  })

  if (error) {
    console.error('[admin_audit_fornitore_match]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = (data ?? []) as AuditRow[]

  return NextResponse.json({
    ok: true as const,
    sede_id: sedeId,
    rows,
  })
}
