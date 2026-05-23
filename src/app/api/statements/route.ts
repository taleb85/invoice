/**
 * GET  /api/statements?sede_id=xxx           — list all statements for a branch
 * GET  /api/statements?sede_id=xxx&id=yyy    — get rows for a specific statement
 * POST /api/statements/[id]/recheck          — (handled inline below via ?action=recheck&id=yyy)
 *
 * The `statements` and `statement_rows` tables are created by the SQL migration
 * in supabase/migrations/add-statements.sql.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getRequestAuth } from '@/utils/supabase/server'
import { runTripleCheck } from '@/lib/triple-check'
import { statementOfficialDateIso } from '@/lib/statement-official-date'

export async function GET(req: NextRequest) {
  const { user } = await getRequestAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })



  const service = createServiceClient()
  const supabase = createServiceClient()
  const { searchParams } = new URL(req.url)
  const sedeId      = searchParams.get('sede_id')
  const fornitoreId = searchParams.get('fornitore_id')
  const statementId = searchParams.get('id')
  const action      = searchParams.get('action')
  const listLimit   = fornitoreId ? 500 : 200

  // ── Get rows for one statement ──────────────────────────────────────────
  if (statementId && action !== 'recheck') {
    const { data: rows, error } = await supabase
      .from('statement_rows')
      .select('id, numero_doc, importo, data_doc, check_status, delta_importo, fattura_id, fattura_numero, bolle_json, fornitore_id')
      .eq('statement_id', statementId)
      .order('data_doc', { ascending: true, nullsFirst: true })
      .order('numero_doc', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Resolve fornitore names separately to avoid FK join cache issues
    const fIds = [...new Set((rows ?? []).map((r: { fornitore_id: string | null }) => r.fornitore_id).filter(Boolean))]
    const fMap: Record<string, { id: string; nome: string; email: string | null }> = {}
    if (fIds.length) {
      const { data: fRows } = await service.from('fornitori').select('id, nome, email').in('id', fIds)
      for (const f of fRows ?? []) fMap[f.id] = f
    }

    // Resolve fattura dates separately (same reason — avoid FK join issues)
    const fatturaIds = [...new Set((rows ?? []).map((r: { fattura_id: string | null }) => r.fattura_id).filter(Boolean))]
    const fatturaDateMap: Record<string, string> = {}
    if (fatturaIds.length) {
      const { data: fRows } = await service.from('fatture').select('id, data').in('id', fatturaIds)
      for (const f of fRows ?? []) fatturaDateMap[f.id] = f.data
    }

    const enriched = (rows ?? []).map((r: Record<string, unknown>) => ({
      ...r,
      fornitori: fMap[(r.fornitore_id as string) ?? ''] ?? null,
      fattura_data: fatturaDateMap[(r.fattura_id as string) ?? ''] ?? null,
    }))

    return NextResponse.json(enriched)
  }

  // ── Recheck: re-run triple-check on a statement's rows ─────────────────
  if (statementId && action === 'recheck') {
    const { data: stmt } = await supabase
      .from('statements')
      .select('id, sede_id, fornitore_id')
      .eq('id', statementId)
      .single()

    if (!stmt) return NextResponse.json({ error: 'Statement non trovato' }, { status: 404 })

    const { data: existingRows } = await supabase
      .from('statement_rows')
      .select('numero_doc, importo')
      .eq('statement_id', statementId)

    if (!existingRows?.length) {
      await service.from('statements').update({ status: 'error' }).eq('id', statementId)
      return NextResponse.json({ ok: true, rechecked: 0, status: 'error' })
    }

    const lines = existingRows.map(r => ({ numero: r.numero_doc, importo: Number(r.importo) }))
    const { results } = await runTripleCheck(supabase, lines, stmt.sede_id, stmt.fornitore_id)

    // Single upsert replaces R sequential UPDATE calls (N+1 pattern).
    // Conflict target: the (statement_id, numero_doc) unique constraint on statement_rows.
    await service.from('statement_rows').upsert(
      results.map((r) => ({
        statement_id:   statementId,
        numero_doc:     r.numero,
        check_status:   r.status,
        delta_importo:  r.deltaImporto,
        fattura_id:     r.fattura?.id ?? null,
        fattura_numero: r.fattura?.numero_fattura ?? null,
        fornitore_id:   r.fornitore?.id ?? null,
        bolle_json:     r.bolle.length ? r.bolle : null,
      })),
      { onConflict: 'statement_id,numero_doc' },
    )

    const missingRows = results.filter(r => r.status !== 'ok').length
    await service.from('statements').update({
      status:       'done',
      missing_rows: missingRows,
    }).eq('id', statementId)

    return NextResponse.json({ ok: true, rechecked: results.length, missing_rows: missingRows })
  }

  // ── List statements for a sede ─────────────────────────────────────────
  // Avoid FK join (fornitori) to sidestep PostgREST schema-cache issues on
  // freshly-created tables. We resolve the supplier name in a second query.
  const baseColumns = [
    'id',
    'sede_id',
    'fornitore_id',
    'file_url',
    'document_date',
    'extracted_pdf_dates',
    'periodo',
    'totale_outstanding',
    'created_at',
    'email_reference_id',
    'email_subject',
    'received_at',
    'status',
    'total_rows',
    'missing_rows',
  ]

  async function runListQuery(columns: string[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (supabase as any)
      .from('statements')
      .select(columns.join(', '))
      .order('received_at', { ascending: false })
      .limit(listLimit)
    if (sedeId)      q = q.eq('sede_id',      sedeId)
    if (fornitoreId) q = q.eq('fornitore_id', fornitoreId)
    // Esclude statement con errori di parsing.
    q = q.neq('status', 'error')
    return q
  }

  // Tenta con `linked_fattura_id`; se la colonna non esiste (migration non
  // ancora applicata), ricade automaticamente sulla query base.
  let { data, error } = await runListQuery([...baseColumns, 'linked_fattura_id'])
  const isMissingLinkedColumn = (e: unknown): boolean => {
    if (!e || typeof e !== 'object') return false
    const obj = e as { code?: string; message?: string }
    if (obj.code === '42703') return true
    const msg = (obj.message ?? '').toLowerCase()
    return msg.includes('linked_fattura_id') && (msg.includes('does not exist') || msg.includes('non esiste') || msg.includes('column'))
  }
  if (error && isMissingLinkedColumn(error)) {
    console.warn('[GET /api/statements] linked_fattura_id mancante — fallback su select base (applica supabase/migrations/20260523000000_statements_linked_fattura.sql)')
    const fallback = await runListQuery(baseColumns)
    data = fallback.data
    error = fallback.error
  }
  if (error) {
    const errObj = error as { code?: string; message?: string }
    if (errObj.code === '42P01') {
      return NextResponse.json({ statements: [], needsMigration: true })
    }
    console.error('[GET /api/statements]', errObj.code, errObj.message)
    return NextResponse.json({ error: errObj.message ?? 'Errore lettura statements' }, { status: 500 })
  }

  // Resolve supplier names in a separate query (avoids FK join issues)
  type StmtRow = { fornitore_id: string | null }
  const fornitoreIds: string[] = [...new Set(
    (data as StmtRow[]).map(s => s.fornitore_id).filter((id): id is string => !!id)
  )]
  const nomeMap: Record<string, string> = {}
  if (fornitoreIds.length) {
    const { data: fRows } = await supabase
      .from('fornitori').select('id, nome').in('id', fornitoreIds)
    for (const f of (fRows ?? []) as { id: string; nome: string }[]) nomeMap[f.id] = f.nome
  }

  const statements = (data ?? []).map((s: Record<string, unknown>) => ({
    ...s,
    fornitore_nome: nomeMap[(s.fornitore_id as string) ?? ''] ?? null,
  }))

  // Deduplica per file_url: stesso documento fisico non deve apparire piu' volte
  const seen = new Set<string>()
  const dedupedByFile = statements.filter((s: Record<string, unknown>) => {
    const key = (s.file_url as string) ?? (s.id as string)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // Stesso oggetto email + fornitore + periodo → tieni solo l'ultima ricezione (reinvii)
  type StmtListRow = Record<string, unknown> & {
    id: string
    fornitore_id?: string | null
    email_subject?: string | null
    received_at?: string | null
    document_date?: string | null
    extracted_pdf_dates?: unknown
    missing_rows?: number | null
  }
  const subjectBest = new Map<string, StmtListRow>()
  const noSubject: StmtListRow[] = []
  for (const s of dedupedByFile as StmtListRow[]) {
    const subject = (s.email_subject ?? '').trim().toLowerCase()
    const period =
      statementOfficialDateIso({
        document_date: s.document_date as string | null | undefined,
        extracted_pdf_dates: s.extracted_pdf_dates as { issued_date?: string | null } | null | undefined,
      }) ?? ''
    if (!subject) {
      noSubject.push(s)
      continue
    }
    const key = `${String(s.fornitore_id ?? '')}:${subject}:${period}`
    const prev = subjectBest.get(key)
    if (!prev || String(s.received_at ?? '') > String(prev.received_at ?? '')) {
      subjectBest.set(key, s)
    }
  }
  const deduped = [...subjectBest.values(), ...noSubject].sort(
    (a, b) => String(b.received_at ?? '').localeCompare(String(a.received_at ?? '')),
  )

  const hasMissing = deduped.some((s) => ((s.missing_rows as number | null) ?? 0) > 0)

  // Pulizia automatica: elimina statement errati e converte in fatture quelli con soggetto invoice.
  // Fire-and-forget per non rallentare la risposta.
  cleanupBadStatements(service).catch(() => {})
  autoConvertInvoiceStatements(service).catch(() => {})

  return NextResponse.json({ statements: deduped, hasMissing })
}

/**
 * Soggetti email che identificano con certezza una fattura (non una bolla/DDT/ordine).
 * Usato solo per l'auto-conversione retroattiva — esclude i pattern di bolla/DDT
 * per non spostare in fatture documenti che appartengono alla coda bolle.
 */
function subjectIsInvoiceNotBolla(subject: string | null | undefined): boolean {
  const s = (subject ?? '').toLowerCase().replace(/[_.\-]/g, ' ')
  if (!s.trim()) return false
  return (
    /\binvoice\b/.test(s) ||
    /\bfattura\b/.test(s) ||
    /\bfacture\b/.test(s) ||
    /\bfactura\b/.test(s) ||
    /\brechnung\b/.test(s) ||
    /\btax\s?invoice\b/.test(s) ||
    /\bsales\s?invoice\b/.test(s) ||
    /\bvat\s?invoice\b/.test(s) ||
    /\bcredit\s?note\b/.test(s) ||
    /nota\s+credito/.test(s)
  )
}

/**
 * Converte automaticamente gli statement il cui oggetto email identifica chiaramente
 * una fattura (non un estratto conto). Inserisce la fattura se non esiste già e
 * rimuove lo statement dalla coda. Fire-and-forget: non blocca la risposta.
 */
async function autoConvertInvoiceStatements(supabase: ReturnType<typeof createServiceClient>) {
  type StmtCandidate = {
    id: string
    fornitore_id: string
    sede_id: string | null
    file_url: string
    document_date: string | null
    email_subject: string | null
    linked_fattura_id: string | null
  }

  // Prova con la colonna nuova; ricade su select base se la migration
  // 20260523000000_statements_linked_fattura.sql non è stata ancora applicata.
  let candidates: StmtCandidate[] | null = null
  {
    const { data, error } = await supabase
      .from('statements')
      .select('id, fornitore_id, sede_id, file_url, document_date, email_subject, linked_fattura_id')
      .neq('status', 'processing')
      .not('fornitore_id', 'is', null)
      .not('file_url', 'is', null)
      .limit(200)
    if (error && error.code === '42703') {
      const fallback = await supabase
        .from('statements')
        .select('id, fornitore_id, sede_id, file_url, document_date, email_subject')
        .neq('status', 'processing')
        .not('fornitore_id', 'is', null)
        .not('file_url', 'is', null)
        .limit(200)
      candidates = (fallback.data ?? []).map((s) => ({ ...(s as Omit<StmtCandidate, 'linked_fattura_id'>), linked_fattura_id: null }))
    } else {
      candidates = (data as StmtCandidate[] | null) ?? null
    }
  }

  if (!candidates?.length) return

  // Salta statement esplicitamente collegati a una fattura: il PDF contiene
  // sia estratto conto sia fattura, vanno tenuti entrambi.
  const allCandidates = candidates.filter(s => !s.linked_fattura_id)
  const invoiceStmts = allCandidates.filter(s => subjectIsInvoiceNotBolla(s.email_subject))

  // Pulizia secondaria: statement il cui file_url ha già una fattura corrispondente
  // (es. convertiti manualmente in passato ma non ancora rimossi dalla tabella).
  const allFileUrls = allCandidates.map(s => s.file_url)
  const { data: existingFattureAll } = allFileUrls.length
    ? await supabase
        .from('fatture')
        .select('file_url')
        .in('file_url', allFileUrls)
    : { data: [] as { file_url: string }[] }
  const alreadyFatturaUrls = new Set(
    (existingFattureAll ?? []).map((f: { file_url: string }) => f.file_url),
  )

  // Elimina gli statement che corrispondono già a una fattura ma non fanno parte degli invoiceStmts
  const orphanedStmts = allCandidates.filter(
    s => !subjectIsInvoiceNotBolla(s.email_subject) && alreadyFatturaUrls.has(s.file_url),
  )
  for (const stmt of orphanedStmts) {
    await supabase.from('statement_rows').delete().eq('statement_id', stmt.id)
    await supabase.from('statements').delete().eq('id', stmt.id)
  }

  if (!invoiceStmts.length) return

  const oggi = new Date().toISOString().split('T')[0]

  // Pre-carica le fatture esistenti per (fornitore, data) così evitiamo di
  // inserire 20 copie dello stesso PDF quando lo statement ha 20 ricezioni
  // email diverse con file_url diverso (caso reale: stesso "Invoice X" inviato
  // più volte). Il match è: stesso fornitore + stessa data documento + entrambi
  // privi di numero_fattura e importo (la firma di un'auto-conversione).
  const fornitoreIds = [...new Set(invoiceStmts.map(s => s.fornitore_id))]
  const { data: existingByFornitore } = fornitoreIds.length
    ? await supabase
        .from('fatture')
        .select('id, fornitore_id, data, numero_fattura, importo, file_url, sede_id')
        .in('fornitore_id', fornitoreIds)
    : { data: [] as Array<{ id: string; fornitore_id: string; data: string; numero_fattura: string | null; importo: number | null; file_url: string | null; sede_id: string | null }> }

  type ExistingFatturaRow = { id: string; fornitore_id: string; data: string; numero_fattura: string | null; importo: number | null; file_url: string | null; sede_id: string | null }

  /** Restituisce true se ESISTE già una fattura «vuota» (no numero, no importo)
   *  per lo stesso fornitore + data documento + sede; significa che una
   *  precedente esecuzione di autoConvert ha già creato la fattura «da statement». */
  function existsEmptyShellFatturaForSameDoc(stmt: typeof invoiceStmts[number], dataDoc: string): boolean {
    return (existingByFornitore as ExistingFatturaRow[] | null ?? []).some((f) => {
      if (f.fornitore_id !== stmt.fornitore_id) return false
      if (String(f.data) !== dataDoc) return false
      if ((f.sede_id ?? null) !== (stmt.sede_id ?? null)) return false
      const hasNumero = !!(f.numero_fattura && f.numero_fattura.trim())
      const hasImporto = f.importo != null
      return !hasNumero && !hasImporto
    })
  }

  for (const stmt of invoiceStmts) {
    const dataDoc = stmt.document_date?.trim() || oggi
    const sameFileExists = alreadyFatturaUrls.has(stmt.file_url)
    const sameShellExists = !sameFileExists && existsEmptyShellFatturaForSameDoc(stmt, dataDoc)

    if (!sameFileExists && !sameShellExists) {
      const { error: insErr } = await supabase.from('fatture').insert([{
        fornitore_id: stmt.fornitore_id,
        sede_id: stmt.sede_id,
        data: dataDoc,
        file_url: stmt.file_url,
        importo: null,
        verificata_estratto_conto: false,
      }])
      if (insErr) continue
      alreadyFatturaUrls.add(stmt.file_url) // riusa subito per i prossimi stmt nello stesso loop
    }
    // Rimuove le righe e lo statement (la fattura esiste già o è appena stata creata)
    await supabase.from('statement_rows').delete().eq('statement_id', stmt.id)
    await supabase.from('statements').delete().eq('id', stmt.id)
  }
}

/** Trova statement con status=error e total_rows=0, li elimina e ripristina i documenti originali. */
async function cleanupBadStatements(supabase: ReturnType<typeof createServiceClient>) {
  const { data: badStmts } = await supabase
    .from('statements')
    .select('id, file_url, sede_id, email_subject')
    .eq('status', 'error')
    .eq('total_rows', 0)
    .limit(200)

  if (!badStmts?.length) return

  const fileUrls = [...new Set(badStmts.map(s => s.file_url).filter(Boolean))]

  // Elimina le righe e gli statement errati
  for (const stmt of badStmts) {
    await supabase.from('statement_rows').delete().eq('statement_id', stmt.id)
    await supabase.from('statements').delete().eq('id', stmt.id)
  }

  if (fileUrls.length) {
    // Ripristina i documenti originali: toglie is_statement e marca come comunicazione
    const { data: docs } = await supabase
      .from('documenti_da_processare')
      .select('id, is_statement, metadata')
      .in('file_url', fileUrls)

    if (docs?.length) {
      for (const doc of docs) {
        const meta = doc.metadata && typeof doc.metadata === 'object' && !Array.isArray(doc.metadata)
          ? { ...(doc.metadata as Record<string, unknown>), pending_kind: 'comunicazione' }
          : { pending_kind: 'comunicazione' }

        await supabase
          .from('documenti_da_processare')
          .update({
            is_statement: false,
            metadata: meta,
          })
          .eq('id', doc.id)
      }
    }
  }
}
