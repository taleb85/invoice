import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/utils/supabase/server'
import { recordManualSupplierAssociation, senderAlreadyLinkedToFornitore } from '@/lib/mittente-fornitore-assoc'

// ── GET /api/documenti-da-processare ──────────────────────────────────────────
// Returns pending documents using the service client to bypass RLS.
// This is necessary because documents can have sede_id = NULL (global IMAP /
// unknown sender), which is invisible via user-level RLS:  NULL ≠ sede_id.
//
// Query params:
//   stati        comma-separated stato values  (default: in_attesa,da_associare)
//   sede_id      restrict to a specific sede   (optional)
//   fornitore_id restrict to a specific supplier (optional)

export async function GET(req: NextRequest) {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const statiParam   = searchParams.get('stati')
  const sedeId       = searchParams.get('sede_id')
  const fornitoreId  = searchParams.get('fornitore_id')
  const fromDate     = searchParams.get('from')
  const toDate       = searchParams.get('to')

  const stati: string[] = statiParam
    ? statiParam.split(',').map(s => s.trim()).filter(Boolean)
    : ['in_attesa', 'da_associare']

  const service = createServiceClient()

  // Fetch user's profile to enforce per-sede access for non-admin operators
  const { data: profile } = await service
    .from('profiles')
    .select('role, sede_id')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  let query = service
    .from('documenti_da_processare')
    .select('*, fornitore:fornitori(nome, email)')
    .in('stato', stati)
    .order('created_at', { ascending: false })
    .limit(200)

  if (fornitoreId) {
    // Fornitore-specific filter (fornitore detail page)
    query = query.eq('fornitore_id', fornitoreId) as typeof query
  }

  if (fromDate) {
    query = query.gte('created_at', fromDate) as typeof query
  }
  if (toDate) {
    query = query.lt('created_at', toDate) as typeof query
  }

  if (sedeId) {
    // Explicit sede filter (sede-specific pages)
    query = query.eq('sede_id', sedeId) as typeof query
  } else if (!isAdmin && profile?.sede_id) {
    // Operators only see their sede's docs + docs with no sede (NULL)
    query = query.or(`sede_id.eq.${profile.sede_id},sede_id.is.null`) as typeof query
  }
  // Admins with no sedeId filter see everything

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  // Auth check con il client cookie-based (rispetta sessione utente)
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  // Tutte le operazioni DB usano il service client per bypassare RLS:
  // evita il blocco su record con sede_id = NULL (NULL = sede_utente → NULL, non TRUE).
  const supabase = createServiceClient()

  const body = await req.json()
  const { id, azione, bolla_id, bolla_ids, fornitore_id, is_statement } = body as {
    id: string
    azione: 'associa' | 'scarta' | 'aggiorna_fornitore' | 'mark_statement'
    bolla_id?: string          // legacy single-bolla
    bolla_ids?: string[]       // new multi-bolla
    fornitore_id?: string
    is_statement?: boolean
  }
  // Normalise: support both bolla_id (legacy) and bolla_ids (new)
  const bollaIds: string[] = bolla_ids?.length
    ? bolla_ids
    : bolla_id ? [bolla_id] : []

  if (!id || !azione) return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 })

  // ── mark_statement ───────────────────────────────────────────────────────
  if (azione === 'mark_statement') {
    const { error } = await supabase
      .from('documenti_da_processare')
      .update({ is_statement: is_statement ?? true })
      .eq('id', id)
    // Tolerate error if the column doesn't exist yet (migration not applied)
    if (error && !error.message.includes('column')) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  // ── aggiorna_fornitore ────────────────────────────────────────────────────
  if (azione === 'aggiorna_fornitore') {
    if (!fornitore_id) return NextResponse.json({ error: 'fornitore_id richiesto' }, { status: 400 })
    const { data: docRow } = await supabase
      .from('documenti_da_processare')
      .select('mittente')
      .eq('id', id)
      .maybeSingle()
    // Aggiorna anche sede_id prendendo quello del fornitore scelto
    const { data: fornitore } = await supabase
      .from('fornitori')
      .select('sede_id')
      .eq('id', fornitore_id)
      .single()
    const { error } = await supabase
      .from('documenti_da_processare')
      .update({
        fornitore_id,
        // "adotta" la sede del fornitore se il documento ne era privo
        ...(fornitore?.sede_id && { sede_id: fornitore.sede_id }),
      })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    let suggestRememberAssociation = false
    let mittenteEmail: string | null = null
    if (docRow?.mittente?.trim()) {
      const norm = docRow.mittente.trim().toLowerCase()
      mittenteEmail = norm.includes('@') ? norm : null
      const { suggestRemember } = await recordManualSupplierAssociation(supabase, {
        mittente: docRow.mittente,
        fornitoreId: fornitore_id,
      })
      suggestRememberAssociation = suggestRemember
    }

    return NextResponse.json({
      ok: true,
      suggestRememberAssociation,
      mittenteEmail,
    })
  }

  // ── Recupera il documento ─────────────────────────────────────────────────
  const { data: doc, error: docError } = await supabase
    .from('documenti_da_processare')
    .select('*')
    .eq('id', id)
    .single()

  if (docError || !doc) return NextResponse.json({ error: 'Documento non trovato' }, { status: 404 })
  // Allow 'in_attesa' and 'da_associare' — both mean "awaiting manual association"
  const processableStates = ['in_attesa', 'da_associare']
  if (!processableStates.includes(doc.stato)) {
    return NextResponse.json({ error: 'Documento già processato' }, { status: 400 })
  }

  // ── scarta ────────────────────────────────────────────────────────────────
  if (azione === 'scarta') {
    await supabase.from('documenti_da_processare').update({ stato: 'scartato' }).eq('id', id)
    return NextResponse.json({ ok: true })
  }

  // ── associa ───────────────────────────────────────────────────────────────
  if (azione === 'associa') {
    if (!bollaIds.length) return NextResponse.json({ error: 'Nessuna bolla selezionata' }, { status: 400 })

    // Fetch all selected bolle
    const { data: bolleRows, error: bolleErr } = await supabase
      .from('bolle')
      .select('id, data, stato, fornitore_id, sede_id, importo, numero_bolla')
      .in('id', bollaIds)

    if (bolleErr || !bolleRows?.length) return NextResponse.json({ error: 'Bolle non trovate' }, { status: 404 })

    // Validate each bolla is still in attesa
    const notInAttesa = bolleRows.filter(b => b.stato !== 'in attesa')
    if (notInAttesa.length) {
      return NextResponse.json({
        error: `Le seguenti bolle non sono più in attesa: ${notInAttesa.map(b => b.numero_bolla ?? b.id).join(', ')}`,
      }, { status: 400 })
    }

    const primaBolla  = bolleRows[0]
    const oggi        = new Date().toISOString().split('T')[0]
    const sedeDefinitiva  = primaBolla.sede_id ?? doc.sede_id ?? null
    const importoTotale   = bolleRows.reduce((s, b) => s + (b.importo ?? 0), 0)

    // Create one fattura covering all selected bolle.
    // bolla_id is set to the first bolla for backward-compatibility (schema has single FK).
    const { data: fattura, error: insertError } = await supabase
      .from('fatture')
      .insert([{
        fornitore_id:             primaBolla.fornitore_id,
        bolla_id:                 primaBolla.id,
        sede_id:                  sedeDefinitiva,
        data:                     doc.data_documento ?? oggi,
        file_url:                 doc.file_url,
        importo:                  importoTotale > 0 ? importoTotale : null,
        verificata_estratto_conto: false,
      }])
      .select('id')
      .single()

    if (insertError) {
      return NextResponse.json({ error: `Errore inserimento fattura: ${insertError.message}` }, { status: 500 })
    }

    // Mark all bolle as completato
    await supabase.from('bolle').update({ stato: 'completato' }).in('id', bollaIds)

    // Update document
    await supabase.from('documenti_da_processare').update({
      stato:      'associato',
      bolla_id:   primaBolla.id,
      fattura_id: fattura.id,
      ...(doc.fornitore_id == null && { fornitore_id: primaBolla.fornitore_id }),
      ...(doc.sede_id == null && sedeDefinitiva && { sede_id: sedeDefinitiva }),
    }).eq('id', id)

    return NextResponse.json({ ok: true, fattura_id: fattura.id, bolleCount: bollaIds.length })
  }

  return NextResponse.json({ error: 'Azione non valida' }, { status: 400 })
}
