/**
 * POST /api/process-pending-statements
 *
 * Finds all documents in `documenti_da_processare` that are flagged as
 * statements (is_statement = true) but have no corresponding record in the
 * `statements` table, then:
 *   1. Downloads the file from Storage
 *   2. Runs ocrStatement to extract rows
 *   3. Saves to `statements` + `statement_rows`
 *   4. Runs the triple-check and stores results per row
 *
 * Safe to call multiple times — already-processed docs are skipped.
 *
 * Body (optional):
 *   sede_id      — limit to a specific branch
 *   fornitore_id — limit to a specific supplier
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getRequestAuth } from '@/utils/supabase/server'
import { downloadStorageObjectByFileUrl } from '@/lib/documenti-storage-url'
import { extractedPdfDatesToJson, ocrStatement } from '@/lib/ocr-statement'
import { runTripleCheck } from '@/lib/triple-check'

export async function POST(req: NextRequest) {
  const { user } = await getRequestAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })



  const service = createServiceClient()
  const body = await req.json().catch(() => ({})) as {
    sede_id?:      string | null
    fornitore_id?: string | null
  }
  const { sede_id, fornitore_id } = body

  const supabase = createServiceClient()

  // ── Check that the statements table exists ──────────────────────────────
  const { error: tableCheck } = await supabase
    .from('statements')
    .select('id')
    .limit(1)

  if (tableCheck?.code === '42P01') {
    return NextResponse.json({
      error: 'needsMigration',
      message: 'Le tabelle statements/statement_rows non sono ancora state create. Esegui la migrazione SQL.',
    }, { status: 409 })
  }

  // ── Find unprocessed statement docs ────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let docsQuery = (supabase as any)
    .from('documenti_da_processare')
    .select('id, file_url, file_name, content_type, oggetto_mail, fornitore_id, sede_id, created_at')
    .eq('is_statement', true)
    .order('created_at', { ascending: false })

  if (sede_id)      docsQuery = docsQuery.eq('sede_id', sede_id)
  if (fornitore_id) docsQuery = docsQuery.eq('fornitore_id', fornitore_id)

  const { data: allDocs } = await docsQuery as { data: {
    id: string; file_url: string; file_name: string | null; content_type: string | null
    oggetto_mail: string | null; fornitore_id: string | null; sede_id: string | null
    created_at: string
  }[] | null }

  if (!allDocs?.length) {
    return NextResponse.json({ processed: 0, skipped: 0, errors: [], message: 'Nessun documento statement in attesa.' })
  }

  // ── Find which file_urls are already processed (avoids schema-cache issues on doc_id) ──
  const { data: existingStmts } = await supabase
    .from('statements')
    .select('file_url')
    .in('file_url', allDocs.map(d => d.file_url))

  const alreadyProcessedUrls = new Set((existingStmts ?? []).map((s: { file_url: string | null }) => s.file_url))
  const pending = allDocs.filter(d => !alreadyProcessedUrls.has(d.file_url))

  if (!pending.length) {
    return NextResponse.json({ processed: 0, skipped: allDocs.length, errors: [], message: 'Tutti i documenti sono già stati processati.' })
  }

  const errors: string[] = []
  const results: { id: string; total: number; missing: number }[] = []

  for (const doc of pending) {
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
      console.error(`[PENDING-STMT] ${msg}`)
      errors.push(msg)
      continue
    }

    // ── 2. OCR — extract statement rows + optional PDF header dates ─────────
    const ocr = await ocrStatement(buffer, contentType)
    const rows = ocr.rows
    const extractedPdfDates = extractedPdfDatesToJson(ocr.extractedPdfDates)
    if (!rows.length) {
      const msg = `Nessuna riga estratta dal PDF per doc ${doc.id}`
      console.warn(`[PENDING-STMT] ${msg}`)
      errors.push(msg)
      // Still create a statement record so we don't retry indefinitely
    }

    const sedeId      = doc.sede_id
    const fornitoreId = doc.fornitore_id

    // ── 3. Create statement record ──────────────────────────────────────────
    const { data: stmtRow, error: stmtErr } = await supabase
      .from('statements')
      .insert([{
        sede_id:              sedeId,
        fornitore_id:         fornitoreId,
        email_subject:        doc.oggetto_mail,
        received_at:          doc.created_at,
        file_url:             doc.file_url,
        status:               rows.length ? 'processing' : 'error',
        total_rows:           rows.length,
        missing_rows:         0,
        extracted_pdf_dates:  extractedPdfDates,
      }])
      .select('id')
      .single()

    if (stmtErr || !stmtRow) {
      const msg = `Errore creazione statement per doc ${doc.id}: ${stmtErr?.message}`
      console.error(`[PENDING-STMT] ${msg}`)
      errors.push(msg)
      continue
    }

    const statementId = stmtRow.id

    if (!rows.length) continue

    // ── 4. Run triple-check ──────────────────────────────────────────────────
    const lines = rows.map(r => ({ numero: r.numero, importo: r.importo, data: r.data }))
    const { results: checkResults } = await runTripleCheck(supabase, lines, sedeId, fornitoreId)

    // ── 5. Insert statement_rows ────────────────────────────────────────────
    const rowInserts = checkResults.map(r => ({
      statement_id:   statementId,
      numero_doc:     r.numero,
      importo:        r.importoStatement,
      data_doc:       rows.find(row => row.numero === r.numero)?.data ?? null,
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
      console.error(`[PENDING-STMT] Errore insert rows per ${statementId}:`, rowsErr.message)
      errors.push(`Errore salvataggio righe: ${rowsErr.message}`)
      await service.from('statements').update({ status: 'error' }).eq('id', statementId)
      continue
    }

    // ── 6. Update summary counts ─────────────────────────────────────────────
    const missingRows = checkResults.filter(r => r.status !== 'ok').length
    await service.from('statements').update({
      status:       'done',
      total_rows:   checkResults.length,
      missing_rows: missingRows,
    }).eq('id', statementId)

    results.push({ id: statementId, total: checkResults.length, missing: missingRows })
  }

  return NextResponse.json({
    processed:  results.length,
    skipped:    alreadyProcessedUrls.size,
    errors,
    statements: results,
    message: results.length
      ? `Elaborati ${results.length} statement — clicca per vedere i risultati.`
      : 'Nessun nuovo statement da elaborare.',
  })
}
