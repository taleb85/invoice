import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getRequestAuth } from '@/utils/supabase/server'
import { downloadStorageObjectByFileUrl } from '@/lib/documenti-storage-url'
import { extractedPdfDatesToJson, ocrStatement } from '@/lib/ocr-statement'
import { resolveStatementDocumentDate } from '@/lib/statement-official-date'
import { runTripleCheck } from '@/lib/triple-check'
import { logActivity, ACTIVITY_ACTIONS } from '@/lib/activity-logger'
import { logger } from '@/lib/logger'
import {
  autoRegisterCombinedPdfInvoiceAfterStatement,
  backfillCombinedInvoicesForStatements,
} from '@/lib/statement-combined-pdf-invoice'
import { cleanupPendingStatementDuplicates } from '@/lib/statement-pending-queue-cleanup'
import { normalizeStatementFileUrl } from '@/lib/statement-list-dedup'
import { findUniqueFornitoreForPendingDoc } from '@/lib/auto-resolve-pending-doc'
import { extractStatementFromSupplierName } from '@/lib/statement-supplier-subject'

export async function POST(req: NextRequest) {
  const { user } = await getRequestAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const body = await req.json().catch(() => ({})) as {
    sede_id?:      string | null
    fornitore_id?: string | null
  }
  const { sede_id, fornitore_id } = body

  if (!sede_id) {
    return NextResponse.json({
      error: 'sede_id obbligatorio',
      message: 'Il parametro sede_id è obbligatorio per elaborare gli statement.',
    }, { status: 400 })
  }

  // ── Check that the statements table exists ──────────────────────────────
  const { error: tableCheck } = await supabase
    .from('statements')
    .select('id')
    .eq('sede_id', sede_id)
    .limit(1)

  if (tableCheck?.code === '42P01') {
    return NextResponse.json({
      error: 'needsMigration',
      message: 'Le tabelle statements/statement_rows non sono ancora state create. Esegui la migrazione SQL.',
    }, { status: 409 })
  }

  try {
    await cleanupPendingStatementDuplicates(supabase, {
      sedeId: sede_id,
      fornitoreId: fornitore_id ?? null,
    })
  } catch (cleanupErr) {
    logger.warn(
      `[PENDING-STMT] Cleanup coda statement duplicati: ${cleanupErr instanceof Error ? cleanupErr.message : cleanupErr}`,
    )
  }

  // ── Find unprocessed statement docs ────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let docsQuery = (supabase as any)
    .from('documenti_da_processare')
    .select('id, file_url, file_name, content_type, oggetto_mail, fornitore_id, sede_id, data_documento, metadata, created_at')
    .eq('is_statement', true)
    .eq('sede_id', sede_id)
    .order('created_at', { ascending: false })

  if (fornitore_id) docsQuery = docsQuery.eq('fornitore_id', fornitore_id)

  const { data: allDocs } = await docsQuery as { data: {
    id: string; file_url: string; file_name: string | null; content_type: string | null
    oggetto_mail: string | null; fornitore_id: string | null; sede_id: string | null
    data_documento: string | null; metadata: Record<string, unknown> | null; created_at: string
  }[] | null }

  if (!allDocs?.length) {
    return NextResponse.json({ processed: 0, skipped: 0, errors: [], message: 'Nessun documento statement in attesa.' })
  }

  // ── Find which file_urls / (fornitore + subject + data) sono già stati elaborati ──
  //
  // PROBLEMA STORICO: ogni rescan email rigenera `email_auto_<uuid>.pdf` per lo
  // stesso PDF allegato (scan-emails carica con nome random, mai content-hash).
  // Risultato: la dedup `file_url` non scatta mai per gli statement ricaricati
  // → si creano N copie dello stesso `statements` + N×rows duplicate (visti casi
  // di 14 copie dello stesso PDF). Aggiungiamo una seconda chiave di dedup
  // logica: (fornitore_id, document_date, normalized email_subject).
  //
  // Per essere conservativi consideriamo "duplicato logico" solo gli statement
  // che hanno almeno una riga (total_rows > 0) o status='done' — così non
  // blocchiamo il riprocesso di statement passati in error/processing vuoto.
  const { data: allStmts } = await supabase
    .from('statements')
    .select('file_url, fornitore_id, document_date, email_subject, status, total_rows')
    .eq('sede_id', sede_id)

  const stmtRecords = allStmts ?? []
  const existingFileUrls = new Set(
    stmtRecords.map((s: { file_url: string | null }) => normalizeStatementFileUrl(s.file_url)).filter(Boolean),
  )

  const normalizeSubject = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
  const tripleKey = (
    fornitoreId: string | null | undefined,
    docDate: string | null | undefined,
    subject: string | null | undefined,
  ) => `${fornitoreId ?? ''}|${docDate ?? ''}|${normalizeSubject(subject)}`

  const existingTriples = new Set(
    stmtRecords
      .filter((s) => (s.total_rows ?? 0) > 0 || s.status === 'done')
      .filter((s) => s.fornitore_id && s.document_date && s.email_subject)
      .map((s) => tripleKey(s.fornitore_id, s.document_date, s.email_subject)),
  )

  const alreadyProcessedUrls = new Set(
    allDocs.filter((d) => d.file_url && existingFileUrls.has(d.file_url)).map((d) => d.file_url),
  )

  const seenFileUrls = new Set<string>()
  const seenTriples = new Set<string>()
  const logicalDuplicateDocIds: string[] = []
  const pending = allDocs.filter((d) => {
    if (alreadyProcessedUrls.has(d.file_url)) return false
    if (!d.file_url || seenFileUrls.has(d.file_url)) return false

    const triple = tripleKey(d.fornitore_id, d.data_documento, d.oggetto_mail)
    if (d.fornitore_id && d.data_documento && d.oggetto_mail) {
      if (existingTriples.has(triple) || seenTriples.has(triple)) {
        // Stesso statement logico già presente in DB (o appena messo in questo batch):
        // skip per non gonfiare duplicati. Marco il documento come 'associato' in coda
        // per non riselezionarlo a ogni run successivo.
        logicalDuplicateDocIds.push(d.id)
        return false
      }
      seenTriples.add(triple)
    }

    seenFileUrls.add(d.file_url)
    return true
  })

  // Best-effort: sgancia subito i duplicati logici dalla coda statement.
  if (logicalDuplicateDocIds.length > 0) {
    const { error: dedupErr } = await supabase
      .from('documenti_da_processare')
      .update({ is_statement: false, stato: 'associato' })
      .in('id', logicalDuplicateDocIds)
    if (dedupErr) {
      logger.warn(`[PENDING-STMT] Impossibile sganciare duplicati logici: ${dedupErr.message}`)
    } else {
      logger.info(`[PENDING-STMT] Sganciati ${logicalDuplicateDocIds.length} duplicati logici (stesso fornitore+data+subject)`)
    }
  }

  if (!pending.length) {
    return NextResponse.json({ processed: 0, skipped: allDocs.length, errors: [], message: 'Tutti i documenti sono già stati processati.' })
  }

  /**
   * Dopo aver processato un file_url con successo o errore, marca tutte le righe
   * in documenti_da_processare con lo stesso file_url come "associato".
   * In questo modo:
   *  - Le righe duplicate vengono automaticamente rimosse dalla coda
   *  - Query future con is_statement = true non le includono più
   *  - Non serve più caricarli in memoria a ogni chiamata API
   */
  async function markDocRowsAsProcessed(fileUrl: string) {
    const { error: markErr } = await supabase
      .from('documenti_da_processare')
      .update({
        is_statement: false,
        stato: 'associato',
      })
      .eq('file_url', fileUrl)
      .eq('sede_id', sede_id)
      .in('stato', ['da_processare', 'da_associare', 'da_revisionare'])
    if (markErr) {
      logger.warn(`[PENDING-STMT] Impossibile marcare duplicati come processati per ${fileUrl}: ${markErr.message}`)
    }
  }

  const errors: string[] = []
  const results: { id: string; total: number; missing: number }[] = []

  // Elabora batch in parallelo: MAX_CONCURRENCY documenti alla volta.
  // Concorrenza 3 = ~5x più veloce del sequenziale (414 doc in ~15 min invece di ~1h),
  // senza sovraccaricare Gemini API o il DB.
  const MAX_CONCURRENCY = 3

  async function processSingleDoc(doc: typeof pending[number]): Promise<void> {
    if (alreadyProcessedUrls.has(doc.file_url)) return
    alreadyProcessedUrls.add(doc.file_url)

    // ── 1. Download file ──────────────────────────────────────────────────
    let buffer: Buffer
    let contentType: string

    try {
      const dl = await downloadStorageObjectByFileUrl(supabase, doc.file_url)
      if ('error' in dl) throw new Error(dl.error)
      buffer = dl.data
      contentType = doc.content_type ?? dl.contentType ?? 'application/pdf'
    } catch (err) {
      const msg = `Download fallito per doc ${doc.id}: ${(err as Error).message}`
      logger.error(`[PENDING-STMT] ${msg}`)
      errors.push(msg)
      return
    }

    // ── 2. OCR — extract statement rows + optional PDF header dates ─────────
    const ocr = await ocrStatement(buffer, contentType)
    const rows = ocr.rows
    const extractedPdfDates = extractedPdfDatesToJson(ocr.extractedPdfDates)
    if (!rows.length) {
      const msg = `Nessuna riga estratta dal PDF per doc ${doc.id}`
      logger.warn(`[PENDING-STMT] ${msg}`)
      errors.push(msg)
      await supabase
        .from('statements')
        .insert([{
          sede_id: doc.sede_id,
          fornitore_id: doc.fornitore_id,
          email_subject: doc.oggetto_mail,
          received_at: doc.created_at,
          document_date: doc.data_documento?.trim() || null,
          file_url: doc.file_url,
          status: 'error',
          total_rows: 0,
          missing_rows: 0,
        }])
      // Riporta il documento in coda come comunicazione invece di marcarlo associato.
      const meta = doc.metadata && typeof doc.metadata === 'object' && !Array.isArray(doc.metadata)
        ? { ...(doc.metadata as Record<string, unknown>), pending_kind: 'comunicazione' }
        : { pending_kind: 'comunicazione' }
      await supabase
        .from('documenti_da_processare')
        .update({ is_statement: false, metadata: meta })
        .eq('id', doc.id)
      return
    }

    const sedeId = doc.sede_id
    let fornitoreId = doc.fornitore_id
    if (doc.oggetto_mail && extractStatementFromSupplierName(doc.oggetto_mail)) {
      const fromSubject = await findUniqueFornitoreForPendingDoc(supabase, {
        docSedeId: doc.sede_id,
        oggetto_mail: doc.oggetto_mail,
        metadata: {},
        mittente: null,
      })
      if (fromSubject) {
        fornitoreId = fromSubject.id
        if (fromSubject.id !== doc.fornitore_id) {
          await supabase
            .from('documenti_da_processare')
            .update({ fornitore_id: fromSubject.id })
            .eq('id', doc.id)
        }
      }
    }

    // ── 3. Create statement record (safe concurrent insert) ──────────────────
    const docDate = resolveStatementDocumentDate(extractedPdfDates, doc.data_documento)
    const { data: stmtRow, error: stmtErr } = await supabase
      .from('statements')
      .insert([{
        sede_id:              sedeId,
        fornitore_id:         fornitoreId,
        email_subject:        doc.oggetto_mail,
        received_at:          doc.created_at,
        document_date:        docDate,
        file_url:             doc.file_url,
        status:               rows.length ? 'processing' : 'error',
        total_rows:           rows.length,
        missing_rows:         0,
        extracted_pdf_dates:  extractedPdfDates,
      }])
      .select('id')
      .maybeSingle()

    if (stmtErr || !stmtRow) {
      if (stmtErr?.message?.includes('unique') || stmtErr?.code === '23505') {
        logger.info(`[PENDING-STMT] Documento già processato da richiesta concorrente: ${doc.file_url}`)
        await markDocRowsAsProcessed(doc.file_url)
        errors.push(`Documento già processato: ${doc.file_name ?? doc.file_url}`)
        return
      }
      const msg = `Errore creazione statement per doc ${doc.id}: ${stmtErr?.message}`
      logger.error(`[PENDING-STMT] ${msg}`)
      errors.push(msg)
      return
    }

    const statementId = stmtRow.id

    // ── 4. Run triple-check ──────────────────────────────────────────────────
    const lines = rows.map(r => ({ numero: r.numero, importo: r.importo, data: r.data }))
    const { results: checkResults } = await runTripleCheck(supabase, lines, sedeId, fornitoreId)

    // ── 5. Insert statement_rows ────────────────────────────────────────────
    const rowsByNumero = new Map(rows.map(r => [r.numero, r]))
    const rowInserts = checkResults.map(r => ({
      statement_id:   statementId,
      numero_doc:     r.numero,
      importo:        r.importoStatement,
      data_doc:       rowsByNumero.get(r.numero)?.data ?? null,
      check_status:   r.status,
      delta_importo:  r.deltaImporto,
      fattura_id:     r.fattura?.id ?? null,
      fattura_numero: r.fattura?.numero_fattura ?? null,
      fornitore_id:   r.fornitore?.id ?? fornitoreId,
      bolle_json:     r.bolle.length ? r.bolle : null,
    }))

    const { error: rowsErr } = await supabase
      .from('statement_rows')
      .insert(rowInserts)

    if (rowsErr) {
      logger.error(`[PENDING-STMT] Errore insert rows per ${statementId}:`, rowsErr.message)
      errors.push(`Errore salvataggio righe: ${rowsErr.message}`)
      await markDocRowsAsProcessed(doc.file_url)
      return
    }

    // ── 6. Update summary counts ─────────────────────────────────────────────
    const missingRows = checkResults.filter(r => r.status !== 'ok').length
    await supabase.from('statements').update({
      status:       'done',
      total_rows:   checkResults.length,
      missing_rows: missingRows,
    }).eq('id', statementId)

    if (process.env.GEMINI_API_KEY?.trim() && fornitoreId) {
      let rowsSum: number | null = null
      {
        let sum = 0
        let n = 0
        for (const r of checkResults) {
          if (Number.isFinite(r.importoStatement)) {
            sum += r.importoStatement
            n++
          }
        }
        if (n > 0) rowsSum = Math.round(sum * 100) / 100
      }
      const docMeta =
        doc.metadata && typeof doc.metadata === 'object' && !Array.isArray(doc.metadata)
          ? (doc.metadata as Record<string, unknown>)
          : null
      const { data: fnRow } = await supabase
        .from('fornitori')
        .select('nome, display_name')
        .eq('id', fornitoreId)
        .maybeSingle()
      const fornitoreNome =
        (fnRow as { display_name?: string | null; nome?: string } | null)?.display_name ||
        (fnRow as { nome?: string } | null)?.nome ||
        null
      try {
        const autoInv = await autoRegisterCombinedPdfInvoiceAfterStatement(supabase, {
          statementId,
          fornitoreId,
          sedeId,
          fileUrl: doc.file_url,
          documentDate: docDate,
          pdfBuffer: buffer,
          contentType,
          statementRowsSum: rowsSum,
          docMetadata: docMeta,
          emailBodyText: doc.oggetto_mail,
          fileLabel: doc.file_name,
          fornitoreNome,
        })
        if (autoInv.ok) {
          logger.info(`[PENDING-STMT] Fattura combinata auto-registrata per statement ${statementId}`)
        }
      } catch (autoErr) {
        logger.warn(
          `[PENDING-STMT] Auto fattura combinata fallita per ${statementId}: ${autoErr instanceof Error ? autoErr.message : autoErr}`,
        )
      }
    }

    await markDocRowsAsProcessed(doc.file_url)

    results.push({ id: statementId, total: checkResults.length, missing: missingRows })
  }

  // Lancia tutti i documenti con un semaphore che limita la concorrenza
  const inFlight = new Set<Promise<void>>()
  for (const doc of pending) {
    const p = processSingleDoc(doc).finally(() => inFlight.delete(p))
    inFlight.add(p)
    if (inFlight.size >= MAX_CONCURRENCY) {
      await Promise.race(inFlight)
    }
  }
  await Promise.all(inFlight)

  const fornitoreIds = [...new Set(pending.map(d => d.fornitore_id).filter(Boolean) as string[])]
  let fornitoreNames: string[] = []
  if (fornitoreIds.length > 0) {
    const { data: fornitori } = await supabase
      .from('fornitori')
      .select('nome')
      .in('id', fornitoreIds)
    if (fornitori) fornitoreNames = fornitori.map(f => f.nome).filter(Boolean)
  }

  const realSkipped = allDocs.length - pending.length

  let backfillCombined = { attempted: 0, created: 0 }
  if (process.env.GEMINI_API_KEY?.trim()) {
    try {
      backfillCombined = await backfillCombinedInvoicesForStatements(supabase, {
        sedeId: sede_id,
        fornitoreId: fornitore_id ?? null,
        limit: fornitore_id ? 5 : 3,
      })
    } catch (backfillErr) {
      logger.warn(
        `[PENDING-STMT] Backfill fatture combinate fallito: ${backfillErr instanceof Error ? backfillErr.message : backfillErr}`,
      )
    }
  }

  await logActivity(supabase, {
    userId: user.id,
    sedeId: null,
    action: ACTIVITY_ACTIONS.DOCUMENTO_PROCESSED,
    entityType: 'statement',
    metadata: {
      statements: true,
      processed: results.length,
      skipped: realSkipped,
      errors: errors.length,
      fornitori: fornitoreNames,
    },
  })

  return NextResponse.json({
    processed:  results.length,
    skipped:    realSkipped,
    errors,
    statements: results,
    backfill_combined_invoices: backfillCombined,
    message: results.length
      ? `Elaborati ${results.length} statement — clicca per vedere i risultati.`
      : 'Nessun nuovo statement da elaborare.',
  })
}
