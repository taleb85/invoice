import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getProfile } from '@/utils/supabase/server'
import { isMasterAdminRole, isSedePrivilegedRole } from '@/lib/roles'
import type { Profile } from '@/types'
import { cookies } from 'next/headers'
import { suggestFornitoreForAuditRow } from '@/lib/inbox-audit-fornitore-suggest'
import { extractEmailFromSenderHeader } from '@/lib/sender-email'
import { isSharedBillingPlatformSenderEmail } from '@/lib/fornitore-resolve-scan-email'

export const dynamic = 'force-dynamic'

type AuditRow = {
  id: string
  mittente: string
  file_name: string | null
  file_url: string | null
  fattura_id: string | null
  bolla_id: string | null
  assigned_fornitore_id: string | null
  fornitore_fattura: string | null
  fornitore_bolla: string | null
  suggested_fornitore_id: string | null
  suggested_fornitore_nome: string | null
  suggested_from_hint: string | null
  supplier_mismatch: boolean
  billing_platform_sender: boolean
}

function resolveSedeId(profile: Profile, bodySede: string | undefined, cookieSede: string | null): string | null {
  const master = isMasterAdminRole(profile.role)
  const isAdminSede = isSedePrivilegedRole(profile.role)

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
  const sedeAdmin = isSedePrivilegedRole(profile.role)
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

  const sedeId = resolveSedeId(profile, bodySede, adminPick)

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

  const rows = (data ?? []) as Omit<
    AuditRow,
    'file_url' | 'suggested_fornitore_id' | 'suggested_fornitore_nome' | 'suggested_from_hint' | 'supplier_mismatch'
  >[]

  const ids = rows.map((r) => r.id).filter(Boolean)
  const docById = new Map<
    string,
    { file_url: string | null; oggetto_mail: string | null; metadata: unknown }
  >()
  if (ids.length > 0) {
    const { data: urlRows } = await service
      .from('documenti_da_processare')
      .select('id, file_url, oggetto_mail, metadata')
      .in('id', ids)
    for (const u of urlRows ?? []) {
      docById.set(u.id, {
        file_url: u.file_url?.trim() || null,
        oggetto_mail: u.oggetto_mail?.trim() || null,
        metadata: u.metadata,
      })
    }
  }

  const enriched: AuditRow[] = await Promise.all(
    rows.map(async (r) => {
      const doc = docById.get(r.id)
      const suggestion = await suggestFornitoreForAuditRow(service, sedeId, {
        file_name: r.file_name,
        oggetto_mail: doc?.oggetto_mail ?? null,
        metadata: doc?.metadata ?? null,
        fornitore_fattura: r.fornitore_fattura,
        fornitore_bolla: r.fornitore_bolla,
      })
      const billing_platform_sender = isSharedBillingPlatformSenderEmail(
        extractEmailFromSenderHeader(r.mittente),
      )
      return {
        ...r,
        file_url: doc?.file_url ?? null,
        ...suggestion,
        billing_platform_sender,
      }
    }),
  )

  const visibleRows = enriched.filter(
    (r) => !r.billing_platform_sender || r.supplier_mismatch,
  )

  return NextResponse.json({
    ok: true as const,
    sede_id: sedeId,
    rows: visibleRows,
  })
}
