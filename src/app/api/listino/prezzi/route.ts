import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient, createServiceClient, getProfile } from '@/utils/supabase/server'
import type { Profile } from '@/types'
import { isMasterAdminRole } from '@/lib/roles'
import { compareIsoDateStrings, isDocumentDateAtLeastLatestListino } from '@/lib/listino-document-date'

function canManageListino(
  profile: Profile,
  fornitoreSedeId: string | null
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

async function fornitoreSede(
  service: SupabaseClient,
  fornitoreId: string
): Promise<{ sede_id: string | null } | null> {
  const { data, error } = await service.from('fornitori').select('sede_id').eq('id', fornitoreId).maybeSingle()
  if (error || !data) return null
  return { sede_id: data.sede_id as string | null }
}

type InsertRow = {
  prodotto: string
  prezzo: number
  data_prezzo: string
  note?: string | null
  rekki_product_id?: string | null
  /** Inserisci anche se `data_prezzo` è precedente all’ultimo aggiornamento listino (conferma esplicita in UI). */
  force_outdated?: boolean
}

/**
 * Inserimento listino con service role dopo verifica sede/ruolo.
 * Evita errori RLS se sul DB mancano ancora le policy su `listino_prezzi`.
 *
 * **Protezione date:** per ogni prodotto si considera la `data_ultimo_prezzo` (max `data_prezzo`
 * già salvata per quel `prodotto` + `fornitore_id`). Se `data_prezzo` della riga in ingresso è
 * **anteriore** a quell’ultima data, la riga viene **saltata** salvo `force_outdated` (operatore con accesso al listino).
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  let body: { fornitore_id?: string; rows?: InsertRow[]; force_outdated_all?: boolean }
  try {
    body = (await req.json()) as { fornitore_id?: string; rows?: InsertRow[]; force_outdated_all?: boolean }
  } catch {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 })
  }

  const fornitoreId = body.fornitore_id?.trim()
  const rows = body.rows
  if (!fornitoreId || !Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'fornitore_id e rows richiesti' }, { status: 400 })
  }
  if (rows.length > 500) {
    return NextResponse.json({ error: 'Troppe righe in un solo salvataggio' }, { status: 400 })
  }

  const service = createServiceClient()
  const fRow = await fornitoreSede(service, fornitoreId)
  if (!fRow) return NextResponse.json({ error: 'Fornitore non trovato' }, { status: 404 })

  const gate = canManageListino(profile, fRow.sede_id)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const parsed: Array<{
    fornitore_id: string
    prodotto: string
    prezzo: number
    data_prezzo: string
    note: string | null
    rekki_product_id: string | null
    force_outdated: boolean
  }> = []

  for (const r of rows) {
    const prodotto = String(r.prodotto ?? '').trim()
    const prezzo = typeof r.prezzo === 'number' ? r.prezzo : parseFloat(String(r.prezzo))
    const data_prezzo = String(r.data_prezzo ?? '').trim()
    const note = r.note != null && String(r.note).trim() !== '' ? String(r.note).trim() : null
    const rekki_product_id = r.rekki_product_id != null && String(r.rekki_product_id).trim() !== '' ? String(r.rekki_product_id).trim() : null
    if (!prodotto || Number.isNaN(prezzo) || !data_prezzo) continue
    parsed.push({
      fornitore_id: fornitoreId,
      prodotto,
      prezzo,
      data_prezzo,
      note,
      rekki_product_id,
      force_outdated: Boolean(r.force_outdated) || Boolean(body.force_outdated_all),
    })
  }

  if (parsed.length === 0) {
    return NextResponse.json({ error: 'Nessuna riga valida (prodotto, prezzo, data)' }, { status: 400 })
  }

  const distinctProducts = [...new Set(parsed.map((p) => p.prodotto))]
  const { data: existingRows, error: exErr } = await service
    .from('listino_prezzi')
    .select('prodotto, data_prezzo')
    .eq('fornitore_id', fornitoreId)
    .in('prodotto', distinctProducts)

  if (exErr) return NextResponse.json({ error: exErr.message }, { status: 500 })

  const maxByProduct = new Map<string, string>()
  for (const row of existingRows ?? []) {
    const p = String(row.prodotto).trim()
    const d = String(row.data_prezzo).slice(0, 10)
    const cur = maxByProduct.get(p)
    if (!cur || compareIsoDateStrings(d, cur) > 0) maxByProduct.set(p, d)
  }

  const skipped: { prodotto: string; reason: 'document_date_before_latest' }[] = []
  const toInsert: Array<{ fornitore_id: string; prodotto: string; prezzo: number; data_prezzo: string; note: string | null; rekki_product_id: string | null }> = []
  const workingMax = new Map(maxByProduct)

  for (const r of parsed) {
    const latest = workingMax.get(r.prodotto) ?? null
    const allowed = isDocumentDateAtLeastLatestListino(r.data_prezzo, latest)
    if (!allowed) {
      if (r.force_outdated) {
        toInsert.push({
          fornitore_id: r.fornitore_id,
          prodotto: r.prodotto,
          prezzo: r.prezzo,
          data_prezzo: r.data_prezzo,
          note: r.note,
          rekki_product_id: r.rekki_product_id,
        })
        const d = r.data_prezzo.slice(0, 10)
        const wm = workingMax.get(r.prodotto)
        if (!wm || compareIsoDateStrings(d, wm) > 0) workingMax.set(r.prodotto, d)
      } else {
        skipped.push({ prodotto: r.prodotto, reason: 'document_date_before_latest' })
      }
      continue
    }
    toInsert.push({
      fornitore_id: r.fornitore_id,
      prodotto: r.prodotto,
      prezzo: r.prezzo,
      data_prezzo: r.data_prezzo,
      note: r.note,
      rekki_product_id: r.rekki_product_id,
    })
    const d = r.data_prezzo.slice(0, 10)
    const wm = workingMax.get(r.prodotto)
    if (!wm || compareIsoDateStrings(d, wm) > 0) workingMax.set(r.prodotto, d)
  }

  if (toInsert.length === 0) {
    return NextResponse.json(
      {
        error:
          'Nessuna riga inserita: la data documento è precedente all’ultimo aggiornamento listino per tutti i prodotti selezionati.',
        skipped,
      },
      { status: 400 },
    )
  }

  const { error } = await service.from('listino_prezzi').insert(toInsert)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, inserted: toInsert.length, skipped })
}

/**
 * Eliminazione riga listino: verifica che la riga appartenga al fornitore indicato e che l’utente possa gestire quel fornitore.
 */
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')?.trim()
  const fornitoreIdParam = req.nextUrl.searchParams.get('fornitore_id')?.trim()
  if (!id) return NextResponse.json({ error: 'id richiesto' }, { status: 400 })

  const service = createServiceClient()
  const { data: row, error: rowErr } = await service
    .from('listino_prezzi')
    .select('fornitore_id')
    .eq('id', id)
    .maybeSingle()

  if (rowErr || !row) return NextResponse.json({ error: 'Riga non trovata' }, { status: 404 })

  if (fornitoreIdParam && row.fornitore_id !== fornitoreIdParam) {
    return NextResponse.json({ error: 'Riga non coerente con il fornitore' }, { status: 403 })
  }

  const fRow = await fornitoreSede(service, row.fornitore_id as string)
  if (!fRow) return NextResponse.json({ error: 'Fornitore non trovato' }, { status: 404 })

  const gate = canManageListino(profile, fRow.sede_id)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const { error: delErr } = await service.from('listino_prezzi').delete().eq('id', id)
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
