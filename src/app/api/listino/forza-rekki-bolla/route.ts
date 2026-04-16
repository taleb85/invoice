import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient, getProfile } from '@/utils/supabase/server'
import { isAdminSedeRole, isMasterAdminRole } from '@/lib/roles'
import { getBollaForViewer } from '@/lib/supabase-detail-for-viewer'
import { executeListinoPrezziInsert, type ParsedListinoInsertRow } from '@/lib/listino-prezzi-insert'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile } from '@/types'

type BolleElem = {
  id?: string
  rekki_meta?: {
    prezzo_da_verificare?: boolean
    prodotto?: string
    prezzo_unitario?: number
  }
}

function collectRekkiListinoRowsFromBolleJson(
  bolleJson: unknown,
  bollaId: string,
  fornitoreId: string,
  dataBolla: string,
): ParsedListinoInsertRow[] {
  if (!Array.isArray(bolleJson)) return []
  const out: ParsedListinoInsertRow[] = []
  for (const raw of bolleJson) {
    if (!raw || typeof raw !== 'object') continue
    const elem = raw as BolleElem
    if (String(elem.id ?? '') !== bollaId) continue
    const m = elem.rekki_meta
    if (!m?.prezzo_da_verificare || !m.prodotto) continue
    const prezzo = Number(m.prezzo_unitario)
    if (Number.isNaN(prezzo)) continue
    out.push({
      fornitore_id: fornitoreId,
      prodotto: String(m.prodotto).trim(),
      prezzo,
      data_prezzo: String(dataBolla).slice(0, 10),
      note: 'Rekki — aggiornamento listino forzato da scheda bolla/fattura',
      force_outdated: true,
    })
  }
  return out
}

function stripRekkiVerifyOnBolla(bolleJson: unknown, bollaId: string): { next: unknown[]; changed: boolean } {
  if (!Array.isArray(bolleJson)) return { next: [], changed: false }
  let changed = false
  const next = bolleJson.map((raw) => {
    if (!raw || typeof raw !== 'object') return raw
    const elem = raw as BolleElem
    if (String(elem.id ?? '') !== bollaId) return raw
    const m = elem.rekki_meta
    if (!m?.prezzo_da_verificare) return raw
    changed = true
    return {
      ...elem,
      rekki_meta: { ...m, prezzo_da_verificare: false },
    }
  })
  return { next, changed }
}

async function fornitoreSede(service: SupabaseClient, fornitoreId: string) {
  const { data, error } = await service.from('fornitori').select('sede_id').eq('id', fornitoreId).maybeSingle()
  if (error || !data) return null
  return { sede_id: data.sede_id as string | null }
}

function canManageListino(
  profile: Profile,
  fornitoreSedeId: string | null,
): { ok: true } | { ok: false; status: number; error: string } {
  if (isMasterAdminRole(profile.role)) return { ok: true }
  if (!profile.sede_id) {
    return { ok: false, status: 403, error: 'Profilo senza sede assegnata.' }
  }
  if (!fornitoreSedeId) {
    return {
      ok: false,
      status: 403,
      error: 'Il fornitore non ha sede: aggiorna l’anagrafica fornitore e riprova.',
    }
  }
  if (fornitoreSedeId !== profile.sede_id) {
    return { ok: false, status: 403, error: 'Non autorizzato sul listino di questo fornitore.' }
  }
  return { ok: true }
}

/**
 * Admin: applica i prezzi unitari Rekki (`rekki_meta` su `statement_rows.bolle_json`) al listino,
 * ignorando la protezione data (`data_ultimo_prezzo` = max `data_prezzo` per prodotto), e rimuove il flag verifica.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  if (!isMasterAdminRole(profile.role) && !isAdminSedeRole(profile.role)) {
    return NextResponse.json({ error: 'Solo amministratori possono forzare il listino da qui.' }, { status: 403 })
  }

  let body: { bolla_id?: string }
  try {
    body = (await req.json()) as { bolla_id?: string }
  } catch {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 })
  }

  const bollaId = body.bolla_id?.trim()
  if (!bollaId) return NextResponse.json({ error: 'bolla_id richiesto' }, { status: 400 })

  const bolla = await getBollaForViewer(bollaId)
  if (!bolla) return NextResponse.json({ error: 'Bolla non trovata o accesso negato' }, { status: 404 })

  const fornitoreId = bolla.fornitore_id as string
  const service = createServiceClient()
  const fRow = await fornitoreSede(service, fornitoreId)
  if (!fRow) return NextResponse.json({ error: 'Fornitore non trovato' }, { status: 404 })

  const gate = canManageListino(profile, fRow.sede_id)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const { data: srows, error: srErr } = await service
    .from('statement_rows')
    .select('id, bolle_json')
    .eq('fornitore_id', fornitoreId)

  if (srErr) return NextResponse.json({ error: srErr.message }, { status: 500 })

  const merged: ParsedListinoInsertRow[] = []
  for (const sr of srows ?? []) {
    merged.push(...collectRekkiListinoRowsFromBolleJson(sr.bolle_json, bollaId, fornitoreId, String(bolla.data)))
  }

  const byProduct = new Map<string, ParsedListinoInsertRow>()
  for (const r of merged) {
    if (!r.prodotto) continue
    byProduct.set(r.prodotto, r)
  }
  const deduped = [...byProduct.values()]
  if (deduped.length === 0) {
    return NextResponse.json({ error: 'Nessun prezzo Rekki da verificare collegato a questa bolla.' }, { status: 404 })
  }

  const ins = await executeListinoPrezziInsert(service, fornitoreId, deduped, true)
  if (!ins.ok) {
    return NextResponse.json({ error: ins.error, skipped: ins.skipped }, { status: 400 })
  }

  for (const sr of srows ?? []) {
    const { next, changed } = stripRekkiVerifyOnBolla(sr.bolle_json, bollaId)
    if (!changed) continue
    const { error: upErr } = await service.from('statement_rows').update({ bolle_json: next }).eq('id', sr.id)
    if (upErr) console.warn('[forza-rekki-bolla] update bolle_json:', upErr.message)
  }

  return NextResponse.json({ ok: true, inserted: ins.inserted, skipped: ins.skipped })
}
