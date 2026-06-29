import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getProfile, getRequestAuth } from '@/utils/supabase/server'
import { isMasterAdminRole } from '@/lib/roles'

async function canManageFornitore(service: ReturnType<typeof createServiceClient>, fornitoreId: string) {
  const profile = await getProfile()
  if (!profile) return { ok: false as const, error: 'Non autenticato', status: 401 }

  if (isMasterAdminRole(profile.role)) return { ok: true as const, profile }

  const { data: fornitore } = await service
    .from('fornitori')
    .select('sede_id')
    .eq('id', fornitoreId)
    .maybeSingle()
  if (!fornitore) return { ok: false as const, error: 'Fornitore non trovato', status: 404 }

  if (!fornitore.sede_id) return { ok: false as const, error: 'Il fornitore non ha sede', status: 403 }
  if (fornitore.sede_id !== profile.sede_id) return { ok: false as const, error: 'Non autorizzato', status: 403 }

  return { ok: true as const, profile }
}

/**
 * POST /api/listino/merge
 * Unisce due prodotti listino: tutte le righe di `source` vengono aggiornate a `target`,
 * poi le righe `source` vengono rinominate (non eliminate) per preservare lo storico.
 *
 * Body: { fornitore_id: string, source: string, target: string }
 */
export async function POST(req: NextRequest) {
  const { user } = await getRequestAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { fornitore_id?: string; source?: string; target?: string }
  try {
    body = (await req.json()) as { fornitore_id?: string; source?: string; target?: string }
  } catch {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 })
  }

  const fornitoreId = body.fornitore_id?.trim()
  const source = body.source?.trim()
  const target = body.target?.trim()

  if (!fornitoreId || !source || !target) {
    return NextResponse.json({ error: 'fornitore_id, source e target richiesti' }, { status: 400 })
  }
  if (source === target) {
    return NextResponse.json({ error: 'source e target devono essere diversi' }, { status: 400 })
  }

  const service = createServiceClient()
  const gate = await canManageFornitore(service, fornitoreId)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  // 1. Recupera righe source
  const { data: sourceRows, error: srcErr } = await service
    .from('listino_prezzi')
    .select('id, prodotto, prezzo, data_prezzo, note')
    .eq('fornitore_id', fornitoreId)
    .eq('prodotto', source)

  if (srcErr) return NextResponse.json({ error: srcErr.message }, { status: 500 })
  if (!sourceRows || sourceRows.length === 0) {
    return NextResponse.json({ error: `Nessuna riga trovata per "${source}"` }, { status: 404 })
  }

  // 2. Controlla se il target esiste già
  const { data: targetRows, error: tgtErr } = await service
    .from('listino_prezzi')
    .select('id, prodotto, prezzo, data_prezzo, note')
    .eq('fornitore_id', fornitoreId)
    .eq('prodotto', target)

  if (tgtErr) return NextResponse.json({ error: tgtErr.message }, { status: 500 })

  // 3. Rinomina tutte le righe source in target
  const { error: updErr } = await service
    .from('listino_prezzi')
    .update({ prodotto: target })
    .eq('fornitore_id', fornitoreId)
    .eq('prodotto', source)

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  const targetCount = targetRows?.length ?? 0
  const sourceCount = sourceRows.length

  return NextResponse.json({
    ok: true,
    merged: sourceCount,
    targetAlreadyHad: targetCount,
    source,
    target,
  })
}
