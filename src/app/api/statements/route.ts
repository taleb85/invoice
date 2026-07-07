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
import { findStatementRowByNumeroDoc } from '@/lib/fattura-duplicate-check'
import { CREDIT_NOTE_PREFIX, runTripleCheck } from '@/lib/triple-check' // bolle obbligatorie v2
import {
  attachStatementAnomalyPreviews,
  fetchAnomalyByStatusMap,
} from '@/lib/statement-anomaly-preview'
import { hideSupersededStatementsForList } from '@/lib/statement-content-dedup'
import { dedupeStatementsForList, type StatementListRow } from '@/lib/statement-list-dedup'
import type { StatementExtractedPdfDates } from '@/lib/statement-official-date'
import { downloadStorageObjectByFileUrl } from '@/lib/documenti-storage-url'
import { ocrInvoice, OcrInvoiceConfigurationError } from '@/lib/ocr-invoice'

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

  // ── Batch conteggi anomalie per tipologia (fallback lista client) ───────
  if (action === 'anomaly_summary' && !statementId) {
    const ids = (searchParams.get('ids') ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, 500)
    if (!ids.length) {
      return NextResponse.json({ by_statement_id: {} as Record<string, unknown[]> })
    }
    const by_statement_id = await fetchAnomalyByStatusMap(supabase, ids)
    return NextResponse.json({ by_statement_id })
  }

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

    // Resolve fattura dates, importo and file_url separately (same reason — avoid FK join issues)
    const fatturaIds = [...new Set((rows ?? []).map((r: { fattura_id: string | null }) => r.fattura_id).filter(Boolean))]
    const fatturaDateMap: Record<string, string> = {}
    const fatturaFileUrlMap: Record<string, string | null> = {}
    const fatturaImportoMap: Record<string, number | null> = {}
    if (fatturaIds.length) {
      const { data: fRows } = await service.from('fatture').select('id, data, file_url, importo').in('id', fatturaIds)
      for (const f of fRows ?? []) {
        fatturaDateMap[f.id] = f.data
        fatturaFileUrlMap[f.id] = f.file_url ?? null
        fatturaImportoMap[f.id] = f.importo
      }
    }

    const enriched = (rows ?? []).map((r: Record<string, unknown>) => ({
      ...r,
      fornitori: fMap[(r.fornitore_id as string) ?? ''] ?? null,
      fattura_data: fatturaDateMap[(r.fattura_id as string) ?? ''] ?? null,
      fattura_file_url: fatturaFileUrlMap[(r.fattura_id as string) ?? ''] ?? null,
      fattura_importo: fatturaImportoMap[(r.fattura_id as string) ?? ''] ?? null,
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
      .select('id, numero_doc, importo, data_doc')
      .eq('statement_id', statementId)

    if (!existingRows?.length) {
      await service.from('statements').update({ status: 'error' }).eq('id', statementId)
      return NextResponse.json({ ok: true, rechecked: 0, status: 'error' })
    }

    // Leggi flag `emette_bolle` del fornitore (default true se NULL o colonna
    // non ancora migrata). Quando false NON forziamo 'ok'→'bolle_mancanti'.
    let emetteBolleForRecheck = true
    if (stmt.fornitore_id) {
      const { data: fornForRecheck } = await supabase
        .from('fornitori')
        .select('emette_bolle')
        .eq('id', stmt.fornitore_id)
        .maybeSingle()
      if (fornForRecheck && (fornForRecheck as { emette_bolle?: boolean | null }).emette_bolle === false) {
        emetteBolleForRecheck = false
      }
    }

    const lines = existingRows.map(r => ({
      numero: r.numero_doc ?? '',
      importo: Number(r.importo),
      data: r.data_doc ?? null,
    }))
    const { results: rawResults } = await runTripleCheck(supabase, lines, stmt.sede_id, stmt.fornitore_id)

    // Per fornitori che emettono DDT, manteniamo lo storico: una 'ok' senza
    // bolle viene forzata a 'bolle_mancanti'. Per fornitori "no-DDT" la
    // 'ok' resta valida. Le note di credito sono escluse (non richiedono bolle).
    const results = emetteBolleForRecheck
      ? rawResults.map(r =>
          r.status === 'ok' && r.bolle.length === 0 && !CREDIT_NOTE_PREFIX.test(r.numero)
            ? { ...r, status: 'bolle_mancanti' as const }
            : r
        )
      : rawResults

    for (const r of results) {
      const existingRow = findStatementRowByNumeroDoc(existingRows, r.numero)
      if (!existingRow) continue

      const bolle_json =
        r.bolle.length > 0
          ? r.bolle.map((b) => ({
              id: b.id,
              numero_bolla: b.numero_bolla,
              importo: b.importo,
              data: b.data,
            }))
          : null

      await service
        .from('statement_rows')
        .update({
          check_status: r.status,
          delta_importo: r.deltaImporto,
          fattura_id: r.fattura?.id ?? null,
          fattura_numero: r.fattura?.numero_fattura ?? null,
          fornitore_id: r.fornitore?.id ?? stmt.fornitore_id ?? null,
          bolle_json,
        })
        .eq('id', existingRow.id)

    }

    // OCR fatture senza importo (dopo il loop): scarica il PDF ed estrai l'importo reale
    const fattureDaOcr = results.filter(r => r.fattura?.id && r.fattura.importo == null)
    for (const fr of fattureDaOcr) {
      try {
        const { data: fatturaRow } = await service.from('fatture').select('file_url').eq('id', fr.fattura!.id).maybeSingle()
        if (!fatturaRow?.file_url) {
          await service.from('fatture').update({ importo: fr.importoStatement }).eq('id', fr.fattura!.id)
          continue
        }
        const dl = await downloadStorageObjectByFileUrl(service, fatturaRow.file_url)
        if ('error' in dl) {
          await service.from('fatture').update({ importo: fr.importoStatement }).eq('id', fr.fattura!.id)
          continue
        }
        const contentType = fatturaRow.file_url.toLowerCase().includes('.pdf') ? 'application/pdf' : (dl.contentType ?? 'application/octet-stream')
        if (contentType !== 'application/pdf' && !contentType.startsWith('image/')) {
          await service.from('fatture').update({ importo: fr.importoStatement }).eq('id', fr.fattura!.id)
          continue
        }
        const ocr = await ocrInvoice(new Uint8Array(dl.data), contentType)
        const ocrImporto = ocr.totale_iva_inclusa != null && Number.isFinite(Number(ocr.totale_iva_inclusa))
          ? Number(ocr.totale_iva_inclusa)
          : fr.importoStatement
        await service.from('fatture').update({ importo: ocrImporto }).eq('id', fr.fattura!.id)
      } catch {
        await service.from('fatture').update({ importo: fr.importoStatement }).eq('id', fr.fattura!.id)
      }
    }

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
      .order('document_date', { ascending: false, nullsFirst: false })
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

  type StmtListRow = StatementListRow & {
    fornitore_nome?: string | null
    missing_rows?: number | null
  }

  const statements: StmtListRow[] = (data ?? []).map((s: Record<string, unknown>) => ({
    ...s,
    id: s.id as string,
    fornitore_nome: nomeMap[(s.fornitore_id as string) ?? ''] ?? null,
    extracted_pdf_dates: (s.extracted_pdf_dates ?? null) as StatementExtractedPdfDates | null,
  }))

  let deduped = dedupeStatementsForList(statements)
  if (deduped.length > 1) {
    deduped = await hideSupersededStatementsForList(supabase, deduped)
  }

  const hasMissing = deduped.some((s) => ((s.missing_rows as number | null) ?? 0) > 0)

  const statementsOut = hasMissing
    ? await attachStatementAnomalyPreviews(
        supabase,
        deduped as Array<StmtListRow & { id: string }>,
      )
    : (deduped as StmtListRow[]).map((s) => ({ ...s, anomaly_by_status: [] as const }))

  // Pulizia automatica: fire-and-forget, non blocca la risposta.
  cleanupBadStatements(service).catch(() => {})
  cleanupDuplicateStatementsByPeriod(service, sedeId ?? undefined).catch(() => {})
  autoConvertInvoiceStatements(service).catch(() => {})
  autoCleanupDuplicateFatture(service).catch(() => {})

  return NextResponse.json({ statements: statementsOut, hasMissing })
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

    // Calcola l'importo totale dalle righe dello statement
    const { data: stmtRows } = await supabase
      .from('statement_rows')
      .select('importo')
      .eq('statement_id', stmt.id)
    const stmtImporto = stmtRows?.reduce((s, r) => s + (r.importo ?? 0), 0) ?? 0

    // OCR del PDF per estrarre l'importo reale della fattura
    let ocrImporto: number | null = null
    if (stmt.file_url) {
      try {
        const dl = await downloadStorageObjectByFileUrl(supabase, stmt.file_url)
        if (!('error' in dl)) {
          const contentType = stmt.file_url.toLowerCase().includes('.pdf') ? 'application/pdf' : (dl.contentType ?? 'application/octet-stream')
          if (contentType === 'application/pdf' || contentType.startsWith('image/')) {
            const ocr = await ocrInvoice(new Uint8Array(dl.data), contentType)
            if (ocr.totale_iva_inclusa != null && Number.isFinite(Number(ocr.totale_iva_inclusa))) {
              ocrImporto = Number(ocr.totale_iva_inclusa)
            }
          }
        }
      } catch (e) {
        console.warn('[autoConvertInvoiceStatements] OCR fallito, uso somma righe:', e instanceof Error ? e.message : e)
      }
    }
    const fatturaImporto = ocrImporto ?? (stmtImporto || null)

    if (!sameFileExists && !sameShellExists) {
      const { error: insErr } = await supabase.from('fatture').insert([{
        fornitore_id: stmt.fornitore_id,
        sede_id: stmt.sede_id,
        data: dataDoc,
        file_url: stmt.file_url,
        importo: fatturaImporto,
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

/**
 * Elimina statement duplicati (stesso fornitore + stessa data documento), mantiene
 * l’ultima ricezione. Tipico quando email_subject è null e ogni scan crea un file_url nuovo.
 */
async function cleanupDuplicateStatementsByPeriod(
  supabase: ReturnType<typeof createServiceClient>,
  sedeId?: string,
) {
  let q = supabase
    .from('statements')
    .select('id, sede_id, fornitore_id, document_date, received_at, created_at')
    .neq('status', 'error')
    .not('fornitore_id', 'is', null)
    .not('document_date', 'is', null)
    .order('received_at', { ascending: false })
    .limit(800)
  if (sedeId) q = q.eq('sede_id', sedeId)

  const { data: rows } = await q
  if (!rows?.length) return

  const bestByKey = new Map<string, string>()
  const toDelete: string[] = []

  for (const row of rows) {
    const key = `${row.sede_id ?? ''}:${row.fornitore_id ?? ''}:${row.document_date ?? ''}`
    if (!bestByKey.has(key)) {
      bestByKey.set(key, row.id)
      continue
    }
    toDelete.push(row.id)
  }

  if (!toDelete.length) return

  for (const id of toDelete) {
    await supabase.from('statement_rows').delete().eq('statement_id', id)
    await supabase.from('statements').delete().eq('id', id)
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

/**
 * Elimina automaticamente le fatture duplicate certe (nessuna decisione umana necessaria):
 *  1. Stesso file_url → stesso PDF caricato più volte.
 *  2. Stesso (fornitore, data, numero_fattura) → stessa fattura registrata più volte.
 * Per ogni gruppo mantiene la fattura "più forte" (con bolla, numero, importo; a parità
 * la più vecchia per created_at). Non tocca i cluster ambigui (stesso giorno, importi diversi).
 * Fire-and-forget: viene chiamata senza await.
 */
async function autoCleanupDuplicateFatture(supabase: ReturnType<typeof createServiceClient>) {
  const { data: rows } = await supabase
    .from('fatture')
    .select('id, file_url, fornitore_id, sede_id, data, importo, numero_fattura, bolla_id, created_at')
    .not('fornitore_id', 'is', null)
    .order('created_at', { ascending: true })
    .limit(5_000)

  if (!rows?.length) return

  type FRow = {
    id: string
    file_url: string | null
    fornitore_id: string
    sede_id: string | null
    data: string | null
    importo: number | null
    numero_fattura: string | null
    bolla_id: string | null
    created_at: string
  }

  function score(f: FRow): number {
    let s = 0
    if (f.bolla_id) s += 1000
    if (f.numero_fattura?.trim()) s += 100
    if (f.importo != null) s += 10
    return s
  }

  function pickKeepId(group: FRow[]): string {
    return [...group].sort((a, b) => {
      const d = score(b) - score(a)
      return d !== 0 ? d : a.created_at.localeCompare(b.created_at)
    })[0]!.id
  }

  const toDelete: string[] = []
  const r = rows as FRow[]

  // ── 1. Stesso file_url ────────────────────────────────────────────────
  const byFile = new Map<string, FRow[]>()
  for (const f of r) {
    if (!f.file_url) continue
    const arr = byFile.get(f.file_url) ?? []
    arr.push(f)
    byFile.set(f.file_url, arr)
  }
  const usedIds = new Set<string>()
  for (const group of byFile.values()) {
    if (group.length < 2) continue
    const keep = pickKeepId(group)
    group.forEach(f => { if (f.id !== keep) { toDelete.push(f.id); usedIds.add(f.id) } })
    usedIds.add(keep)
  }

  // ── 2. Stesso (fornitore, data, numero_fattura) ───────────────────────
  const byNumero = new Map<string, FRow[]>()
  for (const f of r) {
    if (usedIds.has(f.id)) continue
    const numero = (f.numero_fattura ?? '').trim()
    if (!numero || !f.data) continue
    const k = `${f.fornitore_id}|${f.sede_id ?? ''}|${f.data}|${numero.toLowerCase()}`
    const arr = byNumero.get(k) ?? []
    arr.push(f)
    byNumero.set(k, arr)
  }
  for (const group of byNumero.values()) {
    if (group.length < 2) continue
    const keep = pickKeepId(group)
    group.forEach(f => { if (f.id !== keep) toDelete.push(f.id) })
  }

  if (!toDelete.length) return

  // Sgancia statement_rows prima di eliminare
  await supabase.from('statement_rows').update({ fattura_id: null, fattura_numero: null }).in('fattura_id', toDelete)

  const CHUNK = 200
  for (let i = 0; i < toDelete.length; i += CHUNK) {
    await supabase.from('fatture').delete().in('id', toDelete.slice(i, i + CHUNK))
  }
}
