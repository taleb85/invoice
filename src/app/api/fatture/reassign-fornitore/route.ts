import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServiceClient, getProfile } from '@/utils/supabase/server'
import { logActivity } from '@/lib/activity-logger'
import { isMasterAdminRole, isSedePrivilegedRole } from '@/lib/roles'
import type { Profile } from '@/types'

export const dynamic = 'force-dynamic'

function resolveSedeId(profile: Profile, bodySede: string | undefined, cookieSede: string | null): string | null {
  const master = isMasterAdminRole(profile.role)
  const branch = isSedePrivilegedRole(profile.role)

  if (branch && profile.sede_id) {
    const fromBody = bodySede?.trim()
    if (fromBody && fromBody !== profile.sede_id) return null
    return profile.sede_id
  }

  if (!master) return null
  return bodySede?.trim() || cookieSede?.trim() || profile.sede_id?.trim() || null
}

/**
 * Correzione manuale `fornitore_id` su una fattura (es. OCR/email sbagliati → falsi duplicati).
 * Stessi permessi dell’audit documenti; il nuovo fornitore deve essere della stessa sede della fattura.
 */
export async function POST(req: NextRequest) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const master = isMasterAdminRole(profile.role)
  const privileged = isSedePrivilegedRole(profile.role)
  if (!master && !privileged) {
    return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
  }

  let body: { sede_id?: string; fattura_id?: string; nuovo_fornitore_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON non valido' }, { status: 400 })
  }

  const fattura_id = body.fattura_id?.trim()
  const nuovo_fornitore_id = body.nuovo_fornitore_id?.trim()

  const cookieStore = await cookies()
  const adminPick = cookieStore.get('admin-sede-id')?.value ?? null
  const sedeId = resolveSedeId(
    profile,
    typeof body.sede_id === 'string' ? body.sede_id : undefined,
    adminPick,
  )

  if (!sedeId) return NextResponse.json({ error: 'sede non selezionata' }, { status: 400 })
  if (!fattura_id || !nuovo_fornitore_id) {
    return NextResponse.json({ error: 'fattura_id e nuovo_fornitore_id richiesti' }, { status: 400 })
  }

  const service = createServiceClient()

  const { data: fat, error: fatErr } = await service
    .from('fatture')
    .select('id, sede_id, fornitore_id, fornitore:fornitori(sede_id)')
    .eq('id', fattura_id)
    .maybeSingle()

  if (fatErr || !fat) return NextResponse.json({ error: 'Fattura non trovata' }, { status: 404 })

  const fornitoreRow = fat.fornitore as { sede_id?: string | null } | null | undefined
  const invoiceSede = (fat.sede_id as string | null) ?? fornitoreRow?.sede_id ?? null
  if (!invoiceSede || invoiceSede !== sedeId) {
    return NextResponse.json({ error: 'La fattura non appartiene alla sede selezionata' }, { status: 403 })
  }

  if (fat.fornitore_id === nuovo_fornitore_id) {
    return NextResponse.json({ error: 'Il fornitore selezionato è già quello attuale' }, { status: 400 })
  }

  const { data: nuovoForn } = await service.from('fornitori').select('id, sede_id').eq('id', nuovo_fornitore_id).maybeSingle()
  if (!nuovoForn?.id) return NextResponse.json({ error: 'Fornitore non trovato' }, { status: 404 })
  if (nuovoForn.sede_id !== sedeId) {
    return NextResponse.json({ error: 'Il nuovo fornitore non appartiene a questa sede' }, { status: 403 })
  }

  const { error: uErr } = await service.from('fatture').update({ fornitore_id: nuovo_fornitore_id }).eq('id', fattura_id)
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 })

  await logActivity(service, {
    userId: profile.id,
    sedeId,
    action: 'fattura.reassigned',
    entityType: 'fattura',
    entityId: fattura_id,
    metadata: { nuovo_fornitore_id },
  })

  return NextResponse.json({ ok: true as const })
}
