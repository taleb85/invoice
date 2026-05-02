import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/utils/supabase/server'
import { logActivity } from '@/lib/activity-logger'
import { recordManualSupplierAssociation } from '@/lib/mittente-fornitore-assoc'
import { mergeFornitoreMissingFromDocMetadata } from '@/lib/fornitore-merge-from-doc-metadata'
import { recordLearnedKindFromDocMetadata } from '@/lib/fornitore-doc-type-hints'
import {
  FATTURA_DUPLICATE_SANS_NUMERO_IMPORTO_IT,
  FATTURA_DUPLICATE_USER_MESSAGE_IT,
  findDuplicateFatturaId,
  findDuplicateFatturaSansNumeroByImporto,
  normalizeNumeroFattura,
  numeroFatturaFromDocMetadata,
} from '@/lib/fattura-duplicate-check'
import type { SupabaseClient } from '@supabase/supabase-js'
import { DOCUMENTI_PENDING_FILTER_STATES } from '@/lib/documenti-queue-stato'
import { OcrInvoiceConfigurationError } from '@/lib/ocr-invoice'
import { processLegacyPendingDoc, type LegacyPendingDocRow } from '@/lib/reprocess-pending-docs-ocr'
import { safeDate } from '@/lib/safe-date'

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
  userId?: string,
): Promise<NextResponse> {
  const meta =
    doc.metadata && typeof doc.metadata === 'object' && !Array.isArray(doc.metadata)
      ? (doc.metadata as Record<string, unknown>)
      : {}
  let tipo = meta.pending_kind as string | undefined
  if (
    tipo !== 'bolla' &&
    tipo !== 'fattura' &&
    tipo !== 'statement' &&
    tipo !== 'ordine' &&
    tipo !== 'listino'
  ) {
    tipo = doc.is_statement ? 'statement' : undefined
  }
  if (
    tipo !== 'bolla' &&
    tipo !== 'fattura' &&
    tipo !== 'statement' &&
    tipo !== 'ordine' &&
    tipo !== 'listino'
  ) {
    return NextResponse.json(
      { error: 'Imposta il tipo di documento (estratto, bolla, fattura, listino o ordine).' },
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

  /** Listino prezzi: registra come fattura tecnica (stesso percorso «Analizza» listino sul PDF). */
  if (tipo === 'fattura' || tipo === 'listino') {
    const numeroNorm =
      typeof m.numero_fattura === 'string' && m.numero_fattura.trim()
        ? normalizeNumeroFattura(m.numero_fattura)
        : null
    if (numeroNorm) {
      const dupId = await findDuplicateFatturaId(supabase, {
        sedeId: sedeDefinitiva,
        fornitoreId: doc.fornitore_id,
        data: dataDoc,
        numeroFattura: numeroNorm,
      })
      if (dupId) {
        return NextResponse.json({ error: FATTURA_DUPLICATE_USER_MESSAGE_IT, code: 'duplicate_fattura' }, { status: 409 })
      }
    } else if (m.totale_iva_inclusa != null) {
      const imp = Number(m.totale_iva_inclusa)
      if (Number.isFinite(imp)) {
        const dupSans = await findDuplicateFatturaSansNumeroByImporto(supabase, {
          sedeId: sedeDefinitiva,
          fornitoreId: doc.fornitore_id,
          data: dataDoc,
          importo: imp,
        })
        if (dupSans) {
          return NextResponse.json(
            { error: FATTURA_DUPLICATE_SANS_NUMERO_IMPORTO_IT, code: 'duplicate_fattura_sans_numero_importo' },
            { status: 409 },
          )
        }
      }
    }
    const fatturaImporto = m.totale_iva_inclusa != null ? Number(m.totale_iva_inclusa) : null

    // Determine approval_status before insert
    let approvalStatus = 'pending'
    if (sedeDefinitiva && fatturaImporto != null) {
      const { data: approvalSettings } = await supabase
        .from('approval_settings')
        .select('threshold, require_approval')
        .eq('sede_id', sedeDefinitiva)
        .maybeSingle()
      const requireApproval = approvalSettings?.require_approval !== false
      const threshold = Number(approvalSettings?.threshold ?? 500)
      if (!requireApproval || fatturaImporto < threshold) {
        approvalStatus = 'approved'
      }
    } else {
      // No importo known yet — auto-approve (can be re-evaluated later)
      approvalStatus = 'approved'
    }

    const { data: fattura, error: insErr } = await supabase
      .from('fatture')
      .insert([{
        fornitore_id: doc.fornitore_id,
        bolla_id: null,
        sede_id: sedeDefinitiva,
        data: dataDoc,
        file_url: doc.file_url,
        importo: fatturaImporto,
        verificata_estratto_conto: false,
        numero_fattura: numeroNorm,
        approval_status: approvalStatus,
        ...(approvalStatus === 'approved' ? { approved_at: new Date().toISOString() } : {}),
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
    // Fire-and-forget: check price anomalies (solo documenti fiscali, non listino comunicazioni prezzi)
    if (tipo === 'fattura' && fattura.id && doc.fornitore_id) {
      const baseUrl =
        (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '') || 'http://localhost:3000'
      fetch(`${baseUrl}/api/price-anomalies/check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.CRON_SECRET
            ? { Authorization: `Bearer ${process.env.CRON_SECRET}` }
            : {}),
        },
        body: JSON.stringify({ fattura_id: fattura.id, fornitore_id: doc.fornitore_id }),
      }).catch(() => {})
    }
    if (userId) {
      logActivity(createServiceClient(), {
        userId,
        sedeId: sedeDefinitiva,
        action: 'fattura.created',
        entityType: 'fattura',
        entityId: fattura.id,
        entityLabel: numeroNorm ?? undefined,
        metadata: { fornitore_id: doc.fornitore_id ?? undefined },
      }).catch(() => {})
    }
    return NextResponse.json({ ok: true, fattura_id: fattura.id })
  }

  if (tipo === 'ordine') {
    const titoloOrdine =
      (typeof m.numero_fattura === 'string' && m.numero_fattura.trim() ? m.numero_fattura.trim() : null) ||
      (typeof doc.oggetto_mail === 'string' && doc.oggetto_mail.trim() ? doc.oggetto_mail.trim() : null)

    // Righe prodotto salvate durante la scansione IMAP in metadata.rekki_lines
    const righe = Array.isArray((meta as { rekki_lines?: unknown }).rekki_lines)
      ? (meta as { rekki_lines: unknown[] }).rekki_lines
      : null

    const { error: coErr } = await supabase.from('conferme_ordine').insert([
      {
        fornitore_id: doc.fornitore_id,
        sede_id: sedeDefinitiva,
        file_url: doc.file_url,
        file_name: doc.file_name ?? null,
        titolo: titoloOrdine,
        data_ordine: dataDoc,
        note: null,
        ...(righe ? { righe } : {}),
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
//   stati         comma-separated stato values  (default: see below)
//   sede_id       restrict to a specific sede   (optional)
//   fornitore_id  restrict to a specific supplier (optional)
//   total=1       add header `X-Total-Count` = rows matching filters (lista resta max 200)

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
    : [...DOCUMENTI_PENDING_FILTER_STATES, 'in_attesa']

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

  const wantsTotal =
    searchParams.get('total') === '1' || searchParams.get('include_total') === '1'

  let totalMatching: number | null = null
  if (wantsTotal) {
    let countQ = service
      .from('documenti_da_processare')
      .select('*', { count: 'exact', head: true })
      .in('stato', stati)
    if (fornitoreId) {
      countQ = countQ.eq('fornitore_id', fornitoreId)
    }
    if (fromDate) {
      countQ = countQ.gte('created_at', fromDate)
    }
    if (toDate) {
      countQ = countQ.lt('created_at', toDate)
    }
    if (sedeId) {
      countQ = countQ.eq('sede_id', sedeId)
    } else if (!isMasterAdmin && profile?.sede_id) {
      countQ = countQ.or(`sede_id.eq.${profile.sede_id},sede_id.is.null`)
    }
    const { count: ctot, error: countErr } = await countQ
    if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 })
    totalMatching = typeof ctot === 'number' && Number.isFinite(ctot) ? ctot : 0
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

  const res = NextResponse.json(data ?? [])
  if (totalMatching != null) {
    res.headers.set('x-total-count', String(totalMatching))
  }
  return res
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
    azione:
      | 'associa'
      | 'scarta'
      | 'aggiorna_fornitore'
      | 'mark_statement'
      | 'set_pending_kind'
      | 'finalizza_tipo'
      | 'rianalizza_ocr'
      /** Allinea `data_documento` a `metadata.data_fattura` (stessa data mostrata nella card OCR). */
      | 'sync_data_documento_da_ocr'
    bolla_id?: string          // legacy single-bolla
    bolla_ids?: string[]       // new multi-bolla
    fornitore_id?: string
    is_statement?: boolean
    /** document classification: statement vs delivery note vs invoice vs order (pending queue UI) */
    kind?: 'statement' | 'bolla' | 'fattura' | 'ordine' | 'listino'
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
      kind === 'statement' ||
      kind === 'bolla' ||
      kind === 'fattura' ||
      kind === 'ordine' ||
      kind === 'listino'
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
  if (
    kind !== 'statement' &&
    kind !== 'bolla' &&
    kind !== 'fattura' &&
    kind !== 'ordine' &&
    kind !== 'listino'
  ) {
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

  // ── sync_data_documento_da_ocr — persist `data_documento` dalla data OCR in metadata ──────────
  if (azioneNorm === 'sync_data_documento_da_ocr') {
    const pendingLikeStatiSync = [
      ...DOCUMENTI_PENDING_FILTER_STATES,
      'in_attesa',
      'mittente_sconosciuto',
    ] as string[]

    const { data: docRow, error: readErr } = await supabase
      .from('documenti_da_processare')
      .select('metadata, data_documento, sede_id, stato')
      .eq('id', id)
      .maybeSingle()
    if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 })
    if (!docRow) return NextResponse.json({ error: 'Documento non trovato' }, { status: 404 })
    const st = docRow.stato as string | null
    if (!st || !pendingLikeStatiSync.includes(st)) {
      return NextResponse.json({ error: 'Documento già processato' }, { status: 400 })
    }

    const { data: profileS } = await supabase.from('profiles').select('role, sede_id').eq('id', user.id).single()
    const isMasterSync = profileS?.role === 'admin'
    if (!isMasterSync && profileS?.sede_id) {
      const ds = docRow.sede_id as string | null
      if (ds != null && ds !== profileS.sede_id) {
        return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
      }
    }

    const meta =
      docRow.metadata && typeof docRow.metadata === 'object' && !Array.isArray(docRow.metadata)
        ? (docRow.metadata as Record<string, unknown>)
        : {}
    const rawDf = typeof meta.data_fattura === 'string' ? meta.data_fattura.trim() : ''
    if (!rawDf) {
      return NextResponse.json({ error: 'Nessuna data documento nell’estrazione OCR' }, { status: 400 })
    }
    const target = safeDate(rawDf)
    if (!target) {
      return NextResponse.json({ error: 'Data OCR non leggibile nel formato atteso' }, { status: 400 })
    }

    const current = typeof docRow.data_documento === 'string' ? docRow.data_documento.trim() : ''
    if (current === target) {
      return NextResponse.json({ ok: true, unchanged: true, data_documento: target })
    }

    const { error: syncErr } = await supabase
      .from('documenti_da_processare')
      .update({ data_documento: target })
      .eq('id', id)
    if (syncErr) return NextResponse.json({ error: syncErr.message }, { status: 500 })
    return NextResponse.json({ ok: true, data_documento: target })
  }

  // ── rianalizza_ocr — riesegue OCR + abbinamento fornitore (mittente, P.IV.A, nome) ──
  if (azioneNorm === 'rianalizza_ocr') {
    const { data: docRow, error: dre } = await supabase
      .from('documenti_da_processare')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (dre || !docRow) return NextResponse.json({ error: 'Documento non trovato' }, { status: 404 })

    /** Stati da cui è consentito rieseguire OCR (legacy `mittente_sconosciuto` / `in_attesa`). */
    const reanalyzeAllowedStati = [
      ...DOCUMENTI_PENDING_FILTER_STATES,
      'in_attesa',
      'mittente_sconosciuto',
    ] as string[]
    if (!docRow.stato || !reanalyzeAllowedStati.includes(docRow.stato)) {
      return NextResponse.json({ error: 'Documento già processato' }, { status: 400 })
    }

    const { data: profileR } = await supabase.from('profiles').select('role, sede_id').eq('id', user.id).single()
    const isMasterAdminR = profileR?.role === 'admin'
    if (!isMasterAdminR && profileR?.sede_id) {
      const ds = (docRow as { sede_id?: string | null }).sede_id
      if (ds != null && ds !== profileR.sede_id) {
        return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
      }
    }

    try {
      const r = await processLegacyPendingDoc(supabase, docRow as LegacyPendingDocRow, { ignoreLinkedFornitore: true })
      if (r.status === 'error') {
        return NextResponse.json({ error: r.message }, { status: 422 })
      }
      return NextResponse.json({ ok: true, category: r.category })
    } catch (e) {
      if (e instanceof OcrInvoiceConfigurationError) {
        return NextResponse.json({ error: e.message }, { status: 503 })
      }
      throw e
    }
  }

  // ── Recupera il documento ─────────────────────────────────────────────────
  const { data: doc, error: docError } = await supabase
    .from('documenti_da_processare')
    .select('*')
    .eq('id', id)
    .single()

  if (docError || !doc) return NextResponse.json({ error: 'Documento non trovato' }, { status: 404 })
  const processableStates = [...DOCUMENTI_PENDING_FILTER_STATES, 'in_attesa']
  if (!processableStates.includes(doc.stato)) {
    return NextResponse.json({ error: 'Documento già processato' }, { status: 400 })
  }

  // ── finalizza_tipo — alias esplicito (stessa logica di associa + finalizza_da_tipo) ──
  if (azioneNorm === 'finalizza_tipo') {
    return finalizePendingByTipo(supabase, id, doc as DocRowFinalizza, user.id)
  }

  // ── scarta ────────────────────────────────────────────────────────────────
  if (azioneNorm === 'scarta') {
    await supabase.from('documenti_da_processare').update({ stato: 'scartato' }).eq('id', id)
    return NextResponse.json({ ok: true })
  }

  // ── associa ───────────────────────────────────────────────────────────────
  if (azioneNorm === 'associa') {
    if (body.finalizza_da_tipo === true) {
      return finalizePendingByTipo(supabase, id, doc as DocRowFinalizza, user.id)
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
    const dataFatturaAssocia = doc.data_documento ?? oggi
    const numeroDaMeta = numeroFatturaFromDocMetadata(doc.metadata)
    if (numeroDaMeta) {
      const dupId = await findDuplicateFatturaId(supabase, {
        sedeId: sedeDefinitiva,
        fornitoreId: primaBolla.fornitore_id,
        data: dataFatturaAssocia,
        numeroFattura: numeroDaMeta,
      })
      if (dupId) {
        return NextResponse.json({ error: FATTURA_DUPLICATE_USER_MESSAGE_IT, code: 'duplicate_fattura' }, { status: 409 })
      }
    } else {
      const insImporto = importoTotale > 0 ? importoTotale : null
      if (insImporto != null) {
        const dupSans = await findDuplicateFatturaSansNumeroByImporto(supabase, {
          sedeId: sedeDefinitiva,
          fornitoreId: primaBolla.fornitore_id,
          data: dataFatturaAssocia,
          importo: insImporto,
        })
        if (dupSans) {
          return NextResponse.json(
            { error: FATTURA_DUPLICATE_SANS_NUMERO_IMPORTO_IT, code: 'duplicate_fattura_sans_numero_importo' },
            { status: 409 },
          )
        }
      }
    }

    // Create one fattura covering all selected bolle.
    // bolla_id is set to the first bolla for backward-compatibility (schema has single FK).
    const associaImporto = importoTotale > 0 ? importoTotale : null

    // Determine approval_status for associa path
    let associaApprovalStatus = 'pending'
    if (sedeDefinitiva && associaImporto != null) {
      const { data: approvalSettingsA } = await supabase
        .from('approval_settings')
        .select('threshold, require_approval')
        .eq('sede_id', sedeDefinitiva)
        .maybeSingle()
      const requireApprovalA = approvalSettingsA?.require_approval !== false
      const thresholdA = Number(approvalSettingsA?.threshold ?? 500)
      if (!requireApprovalA || associaImporto < thresholdA) {
        associaApprovalStatus = 'approved'
      }
    } else {
      associaApprovalStatus = 'approved'
    }

    const { data: fattura, error: insertError } = await supabase
      .from('fatture')
      .insert([{
        fornitore_id:             primaBolla.fornitore_id,
        bolla_id:                 primaBolla.id,
        sede_id:                  sedeDefinitiva,
        data:                     dataFatturaAssocia,
        file_url:                 doc.file_url,
        importo:                  associaImporto,
        verificata_estratto_conto: false,
        approval_status:          associaApprovalStatus,
        ...(associaApprovalStatus === 'approved' ? { approved_at: new Date().toISOString() } : {}),
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

    logActivity(createServiceClient(), {
      userId: user.id,
      sedeId: sedeDefinitiva,
      action: 'fattura.associated',
      entityType: 'fattura',
      entityId: fattura.id,
      metadata: { fornitore_id: fornitoreMergeId ?? undefined, bolle_count: bollaIds.length },
    }).catch(() => {})

    return NextResponse.json({ ok: true, fattura_id: fattura.id, bolleCount: bollaIds.length })
  }

  return NextResponse.json({ error: 'Azione non valida' }, { status: 400 })
}
