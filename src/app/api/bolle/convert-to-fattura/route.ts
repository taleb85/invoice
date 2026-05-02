import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient, getProfile } from '@/utils/supabase/server'
import { isMasterAdminRole, isSedePrivilegedRole } from '@/lib/roles'

export const dynamic = 'force-dynamic'

async function countTable(
  supabase: SupabaseClient,
  table: string,
  match: Record<string, string>,
): Promise<number> {
  const col = Object.keys(match)[0]!
  const val = match[col]!
  const { count, error } = await supabase.from(table).select(col, { count: 'exact', head: true }).eq(col, val)
  if (error) return 0
  return count ?? 0
}

async function canMigrateBollaToFattura(supabase: SupabaseClient, bollaId: string): Promise<boolean> {
  if ((await countTable(supabase, 'fatture', { bolla_id: bollaId })) > 0) return false
  if ((await countTable(supabase, 'fattura_bolle', { bolla_id: bollaId })) > 0) return false
  return true
}

function isMissingColumnError(err: { message?: string } | null, col: string): boolean {
  const m = (err?.message ?? '').toLowerCase()
  return m.includes(col.toLowerCase()) && m.includes('does not exist')
}

/**
 * POST { bolla_id }
 * Sposta manualmente una riga `bolle` → `fatture` (stessi campi economici / allegato), senza OCR.
 * Solo admin / admin_sede (come fix-ocr-dates).
 */
export async function POST(req: NextRequest) {
  const profile = await getProfile()
  if (!profile) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  const role = String(profile.role ?? '').toLowerCase()
  if (role === 'operatore') {
    return NextResponse.json({ error: 'Operatore: non autorizzato' }, { status: 403 })
  }
  if (!isMasterAdminRole(profile.role) && !isSedePrivilegedRole(profile.role)) {
    return NextResponse.json({ error: 'Solo amministratore o responsabile sede' }, { status: 403 })
  }

  let bollaId = ''
  try {
    const body = (await req.json()) as { bolla_id?: string }
    bollaId = (body.bolla_id ?? '').trim()
  } catch {
    return NextResponse.json({ error: 'Body JSON non valido' }, { status: 400 })
  }
  if (!bollaId) {
    return NextResponse.json({ error: 'bolla_id richiesto' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data: b, error: bErr } = await service
    .from('bolle')
    .select('id, fornitore_id, sede_id, data, file_url, importo, numero_bolla')
    .eq('id', bollaId)
    .maybeSingle()

  if (bErr || !b) {
    return NextResponse.json({ error: 'Bolla non trovata' }, { status: 404 })
  }
  if (!b.file_url?.trim()) {
    return NextResponse.json({ error: 'Bolla senza allegato' }, { status: 400 })
  }

  if (isSedePrivilegedRole(profile.role) && b.sede_id !== profile.sede_id) {
    return NextResponse.json({ error: 'Sede non consentita' }, { status: 403 })
  }

  if (!(await canMigrateBollaToFattura(service, bollaId))) {
    return NextResponse.json(
      {
        error:
          'Spostamento non possibile: esiste già una fattura collegata a questa bolla o un collegamento in fattura_bolle.',
      },
      { status: 409 },
    )
  }

  const ownerUserId = profile.id
  const payload = {
    user_id: ownerUserId,
    fornitore_id: b.fornitore_id,
    bolla_id: null as string | null,
    sede_id: b.sede_id,
    data: b.data,
    file_url: b.file_url,
    importo: b.importo,
    numero_fattura: b.numero_bolla?.trim() || null,
  }

  let insRes = await service.from('fatture').insert([payload]).select('id').single()
  if (insRes.error && isMissingColumnError(insRes.error, 'user_id')) {
    const { user_id: _drop, ...rest } = payload
    void _drop
    insRes = await service.from('fatture').insert([rest]).select('id').single()
  }
  if (insRes.error) {
    return NextResponse.json({ error: insRes.error.message }, { status: 500 })
  }
  const ins = insRes.data as { id: string }

  const { error: delErr } = await service.from('bolle').delete().eq('id', bollaId)
  if (delErr) {
    await service.from('fatture').delete().eq('id', ins.id)
    return NextResponse.json({ error: delErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, fattura_id: ins.id })
}
