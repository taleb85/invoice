import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getProfile } from '@/utils/supabase/server'
import { isMasterAdminRole, isAdminSedeRole } from '@/lib/roles'
import type { Profile } from '@/types'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

function resolveSedeId(profile: Profile, bodySede: string | undefined, cookieSede: string | null): string | null {
  const master = isMasterAdminRole(profile.role)
  const isAdminSede = isAdminSedeRole(profile.role)

  if (isAdminSede && profile.sede_id) {
    const fromBody = bodySede?.trim()
    if (fromBody && fromBody !== profile.sede_id) return null
    return profile.sede_id
  }

  if (!master) return null
  return bodySede?.trim() || cookieSede?.trim() || profile.sede_id?.trim() || null
}

/** Aggiorna `fornitore_id` sulla fattura e/o sulla bolla collegate al documento in coda. */
export async function POST(req: NextRequest) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const master = isMasterAdminRole(profile.role)
  const sedeAdmin = isAdminSedeRole(profile.role)
  if (!master && !sedeAdmin) {
    return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
  }

  let body: { sede_id?: string; documento_id?: string; nuovo_fornitore_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON non valido' }, { status: 400 })
  }

  const documento_id = body.documento_id?.trim()
  const nuovo_fornitore_id = body.nuovo_fornitore_id?.trim()

  const cookieStore = await cookies()
  const adminPick = cookieStore.get('admin-sede-id')?.value ?? null
  const sedeId = resolveSedeId(
    profile,
    typeof body.sede_id === 'string' ? body.sede_id : undefined,
    adminPick,
  )

  if (!sedeId) return NextResponse.json({ error: 'sede non selezionata' }, { status: 400 })
  if (!documento_id || !nuovo_fornitore_id) {
    return NextResponse.json({ error: 'documento_id e nuovo_fornitore_id richiesti' }, { status: 400 })
  }

  const service = createServiceClient()

  const { data: doc, error: docErr } = await service
    .from('documenti_da_processare')
    .select('id, sede_id, fattura_id, bolla_id')
    .eq('id', documento_id)
    .maybeSingle()

  if (docErr || !doc) return NextResponse.json({ error: 'Documento non trovato' }, { status: 404 })
  if (doc.sede_id !== sedeId) return NextResponse.json({ error: 'Sede documento non coerente' }, { status: 403 })

  const { data: nuovoForn } = await service.from('fornitori').select('id, sede_id').eq('id', nuovo_fornitore_id).maybeSingle()
  if (!nuovoForn?.id) return NextResponse.json({ error: 'Fornitore non trovato' }, { status: 404 })
  if (nuovoForn.sede_id !== sedeId) {
    return NextResponse.json({ error: 'Il nuovo fornitore non appartiene a questa sede' }, { status: 403 })
  }

  if (!doc.fattura_id && !doc.bolla_id) {
    return NextResponse.json({ error: 'Nessuna fattura o bolla collegata da aggiornare' }, { status: 400 })
  }

  if (doc.fattura_id) {
    const { error: uFat } = await service
      .from('fatture')
      .update({ fornitore_id: nuovo_fornitore_id })
      .eq('id', doc.fattura_id)
    if (uFat) return NextResponse.json({ error: uFat.message }, { status: 500 })
  }
  if (doc.bolla_id) {
    const { error: uBol } = await service
      .from('bolle')
      .update({ fornitore_id: nuovo_fornitore_id })
      .eq('id', doc.bolla_id)
    if (uBol) return NextResponse.json({ error: uBol.message }, { status: 500 })
  }

  await service
    .from('documenti_da_processare')
    .update({ fornitore_id: nuovo_fornitore_id })
    .eq('id', documento_id)

  return NextResponse.json({ ok: true as const })
}
