import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getProfile } from '@/utils/supabase/server'
import { isMasterAdminRole, isSedePrivilegedRole } from '@/lib/roles'
import { logActivity, type ActivityAction } from '@/lib/activity-logger'

export const dynamic = 'force-dynamic'

const LIST_SELECT = `
  id, data_ricezione, canale, nome_azienda, nome_contatto, email_contatto,
  partita_iva, settore_merceologico, tipologia_prodotto, fascia_prezzo,
  score_totale, stato, data_assegnazione, assegnato_a, esito, data_esito, nota_esito,
  fornitore_creato_id, created_at, updated_at
`

type Row = Record<string, unknown>

function calcolaScoreTotale(body: Row): number | null {
  const criteri = [
    { key: 'score_qualita', peso: 0.30 },
    { key: 'score_prezzi', peso: 0.25 },
    { key: 'score_certificazioni', peso: 0.15 },
    { key: 'score_referenze', peso: 0.10 },
    { key: 'score_documentazione', peso: 0.10 },
    { key: 'score_affidabilita', peso: 0.10 },
  ]
  let numeratore = 0
  let denominatore = 0
  for (const c of criteri) {
    const v = body[c.key]
    if (typeof v === 'number' && v >= 1 && v <= 5) {
      numeratore += c.peso * v
      denominatore += c.peso
    }
  }
  if (denominatore === 0) return null
  return Math.round(((numeratore / denominatore) * 20) * 100) / 100
}

// ── GET /api/potential-suppliers?stato=da_valutare&assegnato_a=<id> ──────────
export async function GET(req: NextRequest) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const service = createServiceClient()
  const { searchParams } = new URL(req.url)
  const stato = searchParams.get('stato')
  const assegnatoA = searchParams.get('assegnato_a')

  let q = service.from('comunicazioni_fornitori_potenziali').select(`
    id, data_ricezione, canale, nome_azienda, nome_contatto, email_contatto,
    partita_iva, settore_merceologico, tipologia_prodotto, fascia_prezzo,
    score_totale, stato, data_assegnazione, assegnato_a, esito, data_esito, nota_esito,
    fornitore_creato_id, created_at, updated_at,
    cataloghi: cataloghi_fornitori_potenziali(file_url, tipo_documento, nome_file)
  `)
  if (stato) q = q.eq('stato', stato)
  if (assegnatoA) q = q.eq('assegnato_a', assegnatoA)
  q = q.order('data_ricezione', { ascending: false })

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// ── POST /api/potential-suppliers ──────────────────────────────────────────
export async function POST(req: NextRequest) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  if (!isMasterAdminRole(profile.role) && !isSedePrivilegedRole(profile.role)) {
    return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
  }

  const service = createServiceClient()
  let body: Row
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Body JSON non valido' }, { status: 400 }) }

  if (!body.nome_azienda?.toString().trim()) {
    return NextResponse.json({ error: 'nome_azienda obbligatorio' }, { status: 400 })
  }

  const scoreTotale = calcolaScoreTotale(body)

  const { data, error } = await service
    .from('comunicazioni_fornitori_potenziali')
    .insert({
      canale: body.canale ?? 'email',
      nome_azienda: body.nome_azienda.toString().trim(),
      nome_contatto: body.nome_contatto?.toString().trim() ?? null,
      email_contatto: body.email_contatto?.toString().trim().toLowerCase() ?? null,
      telefono_contatto: body.telefono_contatto?.toString().trim() ?? null,
      email_ricevente: body.email_ricevente?.toString().trim() ?? null,
      oggetto_email: body.oggetto_email?.toString().trim() ?? null,
      corpo_email: body.corpo_email?.toString() ?? null,
      partita_iva: body.partita_iva?.toString().trim() ?? null,
      sede_legale: body.sede_legale?.toString().trim() ?? null,
      paese: body.paese?.toString().trim() ?? 'IT',
      settore_merceologico: body.settore_merceologico?.toString().trim() ?? null,
      tipologia_prodotto: Array.isArray(body.tipologia_prodotto) ? body.tipologia_prodotto : [],
      fascia_prezzo: body.fascia_prezzo?.toString() ?? null,
      score_qualita: typeof body.score_qualita === 'number' ? body.score_qualita : null,
      score_prezzi: typeof body.score_prezzi === 'number' ? body.score_prezzi : null,
      score_certificazioni: typeof body.score_certificazioni === 'number' ? body.score_certificazioni : null,
      score_referenze: typeof body.score_referenze === 'number' ? body.score_referenze : null,
      score_documentazione: typeof body.score_documentazione === 'number' ? body.score_documentazione : null,
      score_affidabilita: typeof body.score_affidabilita === 'number' ? body.score_affidabilita : null,
      score_totale: scoreTotale,
      stato: 'da_valutare',
      data_scadenza_risposta: body.data_scadenza_risposta ?? null,
    })
    .select(LIST_SELECT)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logActivity(service, {
    userId: profile.id,
    sedeId: profile.sede_id,
    action: 'potential_supplier.created',
    entityType: 'comunicazioni_fornitori_potenziali',
    entityId: (data as Row).id as string,
    entityLabel: (data as Row).nome_azienda as string,
  })

  return NextResponse.json(data, { status: 201 })
}

// ── PATCH /api/potential-suppliers?id=<id> ─────────────────────────────────
export async function PATCH(req: NextRequest) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  if (!isMasterAdminRole(profile.role) && !isSedePrivilegedRole(profile.role)) {
    return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id richiesto' }, { status: 400 })

  const service = createServiceClient()
  let body: Row
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Body JSON non valido' }, { status: 400 }) }

  const updates: Row = {}
  if (body.stato) updates.stato = body.stato
  if (body.esito) updates.esito = body.esito
  if (body.nota_esito !== undefined) updates.nota_esito = body.nota_esito?.toString() ?? null
  if (body.assegnato_a !== undefined) {
    updates.assegnato_a = body.assegnato_a?.toString() ?? null
    if (body.assegnato_a) updates.data_assegnazione = new Date().toISOString()
  }
  if (body.fornitore_creato_id !== undefined) updates.fornitore_creato_id = body.fornitore_creato_id?.toString() ?? null
  if (body.data_scadenza_risposta !== undefined) updates.data_scadenza_risposta = body.data_scadenza_risposta ?? null
  if (body.esito) updates.data_esito = new Date().toISOString()
  if (body.score_qualita !== undefined) updates.score_qualita = body.score_qualita
  if (body.score_prezzi !== undefined) updates.score_prezzi = body.score_prezzi
  if (body.score_certificazioni !== undefined) updates.score_certificazioni = body.score_certificazioni
  if (body.score_referenze !== undefined) updates.score_referenze = body.score_referenze
  if (body.score_documentazione !== undefined) updates.score_documentazione = body.score_documentazione
  if (body.score_affidabilita !== undefined) updates.score_affidabilita = body.score_affidabilita
  if (body.settore_merceologico !== undefined) updates.settore_merceologico = body.settore_merceologico?.toString() ?? null
  if (body.fascia_prezzo !== undefined) updates.fascia_prezzo = body.fascia_prezzo?.toString() ?? null
  if (body.tipologia_prodotto !== undefined) updates.tipologia_prodotto = Array.isArray(body.tipologia_prodotto) ? body.tipologia_prodotto : []
  if (body.nome_contatto !== undefined) updates.nome_contatto = body.nome_contatto?.toString().trim() ?? null
  if (body.email_contatto !== undefined) updates.email_contatto = body.email_contatto?.toString().trim().toLowerCase() ?? null

  // Ricalcola score totale se cambiano i punteggi
  const merged = { ...body, ...updates }
  updates.score_totale = calcolaScoreTotale(merged)

  const { data, error } = await service
    .from('comunicazioni_fornitori_potenziali')
    .update(updates)
    .eq('id', id)
    .select(LIST_SELECT)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (body.stato) {
    const azioni: Record<string, ActivityAction> = {
      da_valutare: 'potential_supplier.stato.da_valutare',
      in_valutazione: 'potential_supplier.stato.in_valutazione',
      approfondimento: 'potential_supplier.stato.approfondimento',
      approvato: 'potential_supplier.stato.approvato',
      rifiutato: 'potential_supplier.stato.rifiutato',
      archiviato: 'potential_supplier.stato.archiviato',
    }
    const action = azioni[String(body.stato)] ?? 'potential_supplier.created'
    await logActivity(service, {
      userId: profile.id,
      sedeId: profile.sede_id,
      action,
      entityType: 'comunicazioni_fornitori_potenziali',
      entityId: id,
      entityLabel: (data as Row).nome_azienda as string,
    })
  }

  return NextResponse.json(data)
}

// ── DELETE /api/potential-suppliers?id=<id> ────────────────────────────────
export async function DELETE(req: NextRequest) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  if (!isMasterAdminRole(profile.role) && !isSedePrivilegedRole(profile.role)) {
    return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id richiesto' }, { status: 400 })

  const service = createServiceClient()

  // Delete related cataloghi first
  await service.from('cataloghi_fornitori_potenziali').delete().eq('comunicazione_id', id)

  // Delete the comunicazione
  const { error } = await service.from('comunicazioni_fornitori_potenziali').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
