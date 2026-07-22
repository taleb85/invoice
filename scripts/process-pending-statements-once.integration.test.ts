/**
 * Elabora documenti con is_statement=true (una tantum da CLI).
 *
 *   npx vitest run scripts/process-pending-statements-once.integration.test.ts
 *
 * Env: SEDE_ID obbligatorio; FORNITORE_ID opzionale.
 */
import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { downloadStorageObjectByFileUrl } from '@/lib/documenti-storage-url'
import { extractedPdfDatesToJson, ocrStatement } from '@/lib/ocr-statement'
import { resolveStatementDocumentDate } from '@/lib/statement-official-date'
import { runTripleCheck } from '@/lib/triple-check'
import { autoRegisterCombinedPdfInvoiceAfterStatement } from '@/lib/statement-combined-pdf-invoice'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const sedeId = process.env.SEDE_ID?.trim()
const fornitoreId = process.env.FORNITORE_ID?.trim() || null
const enabled = process.env.PROCESS_PENDING_STMT_ONCE === '1'

describe.skipIf(!enabled)('process-pending-statements-once', () => {
  it(
    'parsa PDF in coda statement',
    async () => {
      if (!url || !key || !sedeId) {
        throw new Error('Mancano NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SEDE_ID')
      }
      if (!process.env.GEMINI_API_KEY?.trim()) {
        throw new Error('Manca GEMINI_API_KEY')
      }

      const supabase = createClient(url, key)
      let docsQuery = supabase
        .from('documenti_da_processare')
        .select(
          'id, file_url, file_name, content_type, oggetto_mail, fornitore_id, sede_id, data_documento, metadata, created_at',
        )
        .eq('is_statement', true)
        .eq('sede_id', sedeId)
        .order('created_at', { ascending: false })

      if (fornitoreId) docsQuery = docsQuery.eq('fornitore_id', fornitoreId)

      const { data: allDocs, error } = await docsQuery
      expect(error).toBeNull()
      if (!allDocs?.length) {
        console.log('Nessun documento statement in coda.')
        return
      }

      const { data: allStmts } = await supabase
        .from('statements')
        .select('file_url')
        .eq('sede_id', sedeId)
      const existingFileUrls = new Set((allStmts ?? []).map((s) => s.file_url).filter(Boolean))

      const seen = new Set<string>()
      const pending = allDocs.filter((d) => {
        if (!d.file_url || existingFileUrls.has(d.file_url) || seen.has(d.file_url)) return false
        seen.add(d.file_url)
        return true
      })

      console.log(`Elaborazione ${pending.length} PDF statement…`)
      let processed = 0

      for (const doc of pending) {
        const dl = await downloadStorageObjectByFileUrl(supabase, doc.file_url)
        if ('error' in dl) {
          console.warn(`Skip ${doc.file_name}: ${dl.error}`)
          continue
        }
        const contentType = doc.content_type ?? dl.contentType ?? 'application/pdf'
        const ocr = await ocrStatement(dl.data, contentType)
        const rows = ocr.rows
        if (!rows.length) {
          console.warn(`Nessuna riga: ${doc.file_name}`)
          continue
        }

        const documentDate = resolveStatementDocumentDate(
          ocr.extractedPdfDates,
          doc.data_documento,
        )

        const { data: stmt, error: insErr } = await supabase
          .from('statements')
          .insert([
            {
              sede_id: doc.sede_id,
              fornitore_id: doc.fornitore_id,
              email_subject: doc.oggetto_mail,
              received_at: doc.created_at,
              document_date: documentDate,
              file_url: doc.file_url,
              status: 'processing',
              total_rows: rows.length,
              missing_rows: rows.length,
              extracted_pdf_dates: extractedPdfDatesToJson(ocr.extractedPdfDates),
            },
          ])
          .select('id')
          .single()

        if (insErr || !stmt) {
          console.warn(`Insert statement fallito ${doc.file_name}: ${insErr?.message}`)
          continue
        }

        const rowPayloads = rows.map((r, idx) => ({
          statement_id: stmt.id,
          row_index: idx,
          numero_doc: r.numero,
          importo: r.importo,
          data_doc: r.data,
          check_status: 'pending',
        }))
        await supabase.from('statement_rows').insert(rowPayloads)

        const { results } = await runTripleCheck(
          supabase,
          rows.map((r) => ({ numero: r.numero, importo: r.importo, data: r.data })),
          doc.sede_id,
          doc.fornitore_id,
        )
        const missing = results.filter((r) => r.status !== 'ok').length
        await supabase
          .from('statements')
          .update({ status: 'done', missing_rows: missing, total_rows: rows.length })
          .eq('id', stmt.id)

        if (process.env.GEMINI_API_KEY?.trim() && doc.fornitore_id) {
          let rowsSum: number | null = null
          {
            let sum = 0
            let n = 0
            for (const r of rows) {
              const v = r.importo != null ? Number(r.importo) : null
              if (v != null && Number.isFinite(v)) {
                sum += v
                n++
              }
            }
            if (n > 0) rowsSum = Math.round(sum * 100) / 100
          }
          try {
            await autoRegisterCombinedPdfInvoiceAfterStatement(supabase, {
              statementId: stmt.id,
              fornitoreId: doc.fornitore_id,
              sedeId: doc.sede_id,
              fileUrl: doc.file_url,
              documentDate: documentDate,
              pdfBuffer: dl.data,
              contentType,
              statementRowsSum: rowsSum,
              emailBodyText: doc.oggetto_mail,
              fileLabel: doc.file_name,
            })
          } catch {
            /* optional */
          }
        }

        await supabase
          .from('documenti_da_processare')
          .update({ is_statement: false, stato: 'associato' })
          .eq('file_url', doc.file_url)
          .eq('sede_id', sedeId)

        processed++
        console.log(`OK ${doc.file_name}: ${rows.length} righe, ${missing} anomalie`)
      }

      console.log(`Completato: ${processed}/${pending.length}`)
      expect(processed).toBeGreaterThan(0)
    },
    600_000,
  )
})
