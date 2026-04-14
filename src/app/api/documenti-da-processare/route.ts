import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/utils/supabase/server'
import { recordManualSupplierAssociation } from '@/lib/mittente-fornitore-assoc'
import { mergeFornitoreMissingFromDocMetadata } from '@/lib/fornitore-merge-from-doc-metadata'
import { recordLearnedKindFromDocMetadata } from '@/lib/fornitore-doc-type-hints'
import type { SupabaseClient } from '@supabase/supabase-js'

type DocRowFinalizza = {
  fornitore_id: string | null
  sede_id: string | null
  data_documento: string | null
  file_url: string
  file_name?: string | null
  oggetto_mail?: string | null
  mittente?: string | null
  is_statement: boolean
  metadata: unknown
}

/**
 * Migrazione `conferme_ordine` non applicata o tabella non in cache PostgREST:
 * non restituire 500 (evita toast/banner rossi); il documento viene comunque segnato associato.
 */
function confermeOrdineTableUnavailable(err: { message?: string; code?: string }): boolean {
  if (err.code === '42P01') return true
  const m = (err.message ?? '').toLowerCase()
  if (!m.includes('conferme_ordine')) return false
  return (
    m.includes('schema cache') ||
    m.includes('could not find') ||
    m.includes('does not exist') ||
    m.includes('not found')
  )
}

/** Crea fattura senza bolla, bolla da allegato, o archivia estratto — dopo scelta tipo in coda. */
async function finalizePendingByTipo(
  supabase: SupabaseClient,
  id: string,
  doc: DocRowFinalizza,
): Promise<NextResponse> {
  const meta =
    doc.metadata && typeof doc.metadata === 'object' && !Array.isArray(doc.metadata)
      ? (doc.metadata as Record<string, unknown>)
      : {}
  let tipo = meta.pending_kind as string | undefined
  if (tipo !== 'bolla' && tipo !== 'fattura' && tipo !== 'statement' && tipo !== 'ordine') {
    tipo = doc.is_statement ? 'statement' : undefined
  }
  if (tipo !== 'bolla' && tipo !== 'fattura' && tipo !== 'statement' && tipo !== 'ordine') {
    return NextResponse.json(
      { error: 'Imposta il tipo di documento (estratto, bolla, fattura o ordine).' },
      { status: 400 },
    )
  }
  if (!doc.fornitore_id) {
    return NextResponse.json({ error: 'Associa un fornitore prima di finalizzare.' }, { status: 400 })
  }

  const oggi = new Date().toISOString().split('T')[0]
  const { data: fornitoreRow } = await supabase
    .from('fornitori')
    .select('sede_id')
    .eq('id', doc.fornitore_id)
    .maybeSingle()
  const sedeDefinitiva = fornitoreRow?.sede_id ?? doc.sede_id ?? null
  const dataDoc = doc.data_documento ?? oggi
  const m = meta as {
    totale_iva_inclusa?: number | null
    numero_fattura?: string | null
  }

  if (tipo === 'fattura') {
    const { data: fattura, error: insErr } = await supabase
      .from('fatture')
      .insert([{
        fornitore_id: doc.fornitore_id,
        bolla_id: null,
        sede_id: sedeDefinitiva,
        data: dataDoc,
        file_url: doc.file_url,
        importo: m.totale_iva_inclusa != null ? Number(m.totale_iva_inclusa) : null,
        verificata_estratto_conto: false,
        numero_fattura: typeof m.numero_fattura === 'string' && m.numero_fattura.trim() ? m.numero_fattura.trim() : null,
      }])
      .select('id')
      .single()
    if (insErr) {
      return NextResponse.json({ error: `Errore inserimento fattura: ${insErr.message}` }, { status: 500 })
    }
    await supabase
      .from('documenti_da_processare')
      .update({
        stato: 'associato',
        fattura_id: fattura.id,
        bolla_id: null,
        ...(sedeDefinitiva && !doc.sede_id ? { sede_id: sedeDefinitiva } : {}),
      })
      .eq('id', id)
    await mergeFornitoreMissingFromDocMetadata(supabase, doc.fornitore_id, doc.metadata, doc.mittente)
    await recordLearnedKindFromDocMetadata(supabase, {
      fornitoreId: doc.fornitore_id,
      metadata: doc.metadata,
      pendingKind: 'fattura',
    })
    return NextResponse.json({ ok: true, fattura_id: fattura.id })
  }

  if (tipo === 'ordine') {
    const titoloOrdine =
      (typeof m.numero_fattura === 'string' && m.numero_fattura.trim() ? m.numero_fattura.trim() : null) ||
      (typeof doc.oggetto_mail === 'string' && doc.oggetto_mail.trim() ? doc.oggetto_mail.trim() : null)
    const { error: coErr } = await supabase.from('conferme_ordine').insert([
      {
        fornitore_id: doc.fornitore_id,
        sede_id: sedeDefinitiva,
        file_url: doc.file_url,
        file_name: doc.file_name ?? null,
        titolo: titoloOrdine,
        data_ordine: dataDoc,
        note: null,
      },
    ])
    if (coErr && !confermeOrdineTableUnavailable(coErr)) {
      return NextResponse.json(
        { error: `Errore archiviazione ordine (tabella conferme_ordine): ${coErr.message}` },
        { status: 500 },
      )
    }
    await supabase
      .from('documenti_da_processare')
      .update({
        stato: 'associato',
        bolla_id: null,
        fattura_id: null,
        ...(sedeDefinitiva && !doc.sede_id ? { sede_id: sedeDefinitiva } : {}),
      })
      .eq('id', id)
    await recordLearnedKindFromDocMetadata(supabase, {
      fornitoreId: doc.fornitore_id,
      metadata: doc.metadata,
      pendingKind: 'ordine',
    })
    return NextResponse.json({ ok: true })
  }

  if (tipo === 'bolla') {
    const numBolla =
      typeof m.numero_fattura === 'string' && m.numero_fattura.trim() ? m.numero_fattura.trim() : null
    const { data: bolla, error: insErr } = await supabase
      .from('bolle')
      .insert([{
        fornitore_id: doc.fornitore_id,
        sede_id: sedeDefinitiva,
        data: dataDoc,
        file_url: doc.file_url,
        stato: 'in attesa',
        numero_bolla: numBolla,
        importo: m.totale_iva_inclusa != null ? Number(m.totale_iva_inclusa) : null,
      }])
      .select('id')
      .single()
    if (insErr) {
      return NextResponse.json({ error: `Errore inserimento bolla: ${insErr.message}` }, { status: 500 })
    }
    await supabase
      .from('documenti_da_processare')
      .update({
        stato: 'associato',
        bolla_id: bolla.id,
        ...(sedeDefinitiva && !doc.sede_id ? { sede_id: sedeDefinitiva } : {}),
      })
      .eq('id', id)
    await mergeFornitoreMissingFromDocMetadata(supabase, doc.fornitore_id, doc.metadata, doc.mittente)
    await recordLearnedKindFromDocMetadata(supabase, {
      fornitoreId: doc.fornitore_id,
      metadata: doc.metadata,
      pendingKind: 'bolla',
    })
    return NextResponse.json({ ok: true, bolla_id: bolla.id })
  }

  await supabase
    .from('documenti_da_processare')
    .update({
      stato: 'associato',
      ...(sedeDefinitiva && !doc.sede_id ? { sede_id: sedeDefinitiva } : {}),
    })
    .eq('id', id)
  await recordLearnedKindFromDocMetadata(supabase, {
    fornitoreId: doc.fornitore_id,
    metadata: doc.metadata,
    pendingKind: 'statement',
  })
  return NextResponse.json({ ok: true })
}

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

  const isMasterAdmin = profile?.role === 'admin'
  const isAdminSede = profile?.role === 'admin_sede'

  if (isAdminSede && sedeId && profile?.sede_id && sedeId !== profile.sede_id) {
    return NextResponse.json({ error: 'sede_id non consentito' }, { status: 403 })
  }

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
  } else if (!isMasterAdmin && profile?.sede_id) {
    // Operators only see their sede's docs + docs with no sede (NULL)
    query = query.or(`sede_id.eq.${profile.sede_id},sede_id.is.null`) as typeof query
  }
  // Admin Master with no sedeId filter sees everything

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
  const { id, azione, bolla_id, bolla_ids, fornitore_id, is_statement, kind } = body as {
    id: string
    azione: 'associa' | 'scarta' | 'aggiorna_fornitore' | 'mark_statement' | 'set_pending_kind' | 'finalizza_tipo'
    bolla_id?: string          // legacy single-bolla
    bolla_ids?: string[]       // new multi-bolla
    fornitore_id?: string
    is_statement?: boolean
    /** document classification: statement vs delivery note vs invoice vs order (pending queue UI) */
    kind?: 'statement' | 'bolla' | 'fattura' | 'ordine'
    /** Usato con azione `associa` per finalizzare senza bolle (stesso handler già deployato ovunque). */
    finalizza_da_tipo?: boolean
  }
  const azioneNorm = String(azione ?? '').trim()
  // Normalise: support both bolla_id (legacy) and bolla_ids (new)
  const bollaIds: string[] = bolla_ids?.length
    ? bolla_ids
    : bolla_id ? [bolla_id] : []

  if (!id || !azioneNorm) return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 })

  // ── mark_statement ───────────────────────────────────────────────────────
  if (azioneNorm === 'mark_statement') {
    // Classificazione Estratto / Bolla / Fattura: stessa logica di set_pending_kind così
    // funziona anche su deploy che non espongono ancora l’azione dedicata (evita «Azione non valida»).
    const classifies =
      kind === 'statement' || kind === 'bolla' || kind === 'fattura' || kind === 'ordine'
    if (classifies) {
      const { data: row, error: readErr } = await supabase
        .from('documenti_da_processare')
        .select('metadata')
        .eq('id', id)
        .maybeSingle()
      if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 })
      if (!row) return NextResponse.json({ error: 'Documento non trovato' }, { status: 404 })
      const prevMeta = row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
        ? { ...(row.metadata as Record<string, unknown>) }
        : {}
      prevMeta.pending_kind = kind
      const stmt = kind === 'statement'
      const { error } = await supabase
        .from('documenti_da_processare')
        .update({
          is_statement: stmt,
          metadata: prevMeta,
        })
        .eq('id', id)
      if (error && !error.message.includes('column')) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ ok: true })
    }

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

  // ── set_pending_kind — estratto / bolla / fattura (metadata + is_statement) ──
  if (azioneNorm === 'set_pending_kind') {
    if (kind !== 'statement' && kind !== 'bolla' && kind !== 'fattura' && kind !== 'ordine') {
      return NextResponse.json({ error: 'kind non valido' }, { status: 400 })
    }
    const { data: row, error: readErr } = await supabase
      .from('documenti_da_processare')
      .select('metadata')
      .eq('id', id)
      .maybeSingle()
    if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 })
    if (!row) return NextResponse.json({ error: 'Documento non trovato' }, { status: 404 })
    const prevMeta = row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? { ...(row.metadata as Record<string, unknown>) }
      : {}
    prevMeta.pending_kind = kind
    const { error } = await supabase
      .from('documenti_da_processare')
      .update({
        is_statement: kind === 'statement',
        metadata: prevMeta,
      })
      .eq('id', id)
    if (error && !error.message.includes('column')) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  // ── aggiorna_fornitore ────────────────────────────────────────────────────
  if (azioneNorm === 'aggiorna_fornitore') {
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

  // ── finalizza_tipo — alias esplicito (stessa logica di associa + finalizza_da_tipo) ──
  if (azioneNorm === 'finalizza_tipo') {
    return finalizePendingByTipo(supabase, id, doc as DocRowFinalizza)
  }

  // ── scarta ────────────────────────────────────────────────────────────────
  if (azioneNorm === 'scarta') {
    await supabase.from('documenti_da_processare').update({ stato: 'scartato' }).eq('id', id)
    return NextResponse.json({ ok: true })
  }

  // ── associa ───────────────────────────────────────────────────────────────
  if (azioneNorm === 'associa') {
    if (body.finalizza_da_tipo === true) {
      return finalizePendingByTipo(supabase, id, doc as DocRowFinalizza)
    }
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

    const fornitoreMergeId = doc.fornitore_id ?? primaBolla.fornitore_id
    await mergeFornitoreMissingFromDocMetadata(supabase, fornitoreMergeId, doc.metadata, doc.mittente)
    await recordLearnedKindFromDocMetadata(supabase, {
      fornitoreId: fornitoreMergeId,
      metadata: doc.metadata,
      pendingKind: 'fattura',
    })

    return NextResponse.json({ ok: true, fattura_id: fattura.id, bolleCount: bollaIds.length })
  }

  return NextResponse.json({ error: 'Azione non valida' }, { status: 400 })
}
