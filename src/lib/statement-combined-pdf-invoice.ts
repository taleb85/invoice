import type { SupabaseClient } from '@supabase/supabase-js'
import {
  detectPdfMultiSegments,
  fiscalSegmentsBeyondPrimary,
  PDF_MULTI_DETECT_MIN_PAGES,
  type OcrPdfSegment,
} from '@/lib/ocr-pdf-multi'
import { extractPdfTextDetailed } from '@/lib/pdf-parse-utils'
import { insertEmailAutoFattura } from '@/lib/email-sync-auto-register-core'
import { normalizeNumeroFattura } from '@/lib/fattura-duplicate-check'
import { fatturaNumeroIsMisusedUkAccount } from '@/lib/uk-account-invoice-guard'
import { safeDate } from '@/lib/safe-date'
import { logger } from '@/lib/logger'

export type CombinedInvoiceDetectInput = {
  pdfBuffer: Buffer
  contentType: string
  segmentiPdf?: OcrPdfSegment[] | null
  docMetadata?: Record<string, unknown> | null
  emailBodyText?: string | null
  fileLabel?: string | null
}

export type CombinedInvoiceFields = {
  numero_fattura: string
  importo: number | null
  data: string
  segment: OcrPdfSegment
}

function metaSegmenti(docMetadata?: Record<string, unknown> | null): OcrPdfSegment[] | null {
  const raw = docMetadata?.segmenti_pdf
  if (!Array.isArray(raw) || !raw.length) return null
  return raw as OcrPdfSegment[]
}

/** Segmento fiscale (Tax Invoice) distinto dall'estratto nello stesso PDF. */
export function pickInvoiceSegmentFromPdfSegments(segments: OcrPdfSegment[]): OcrPdfSegment | null {
  if (!segments.length) return null

  const extra = fiscalSegmentsBeyondPrimary(segments, 'estratto_conto', null)
  if (extra[0]) return extra[0]

  const stmt = segments.find((s) => s.tipo_documento === 'estratto_conto')
  const inv = segments.find(
    (s) =>
      s.tipo_documento === 'fattura' &&
      !!s.numero_fattura?.trim() &&
      !s.numero_e_account_no,
  )
  if (stmt && inv) return inv

  return null
}

export async function resolvePdfSegmentsForCombinedInvoice(
  input: CombinedInvoiceDetectInput,
): Promise<OcrPdfSegment[]> {
  const fromMeta = input.segmentiPdf?.length
    ? input.segmentiPdf
    : metaSegmenti(input.docMetadata)
  if (fromMeta?.length) return fromMeta

  const isPdf =
    input.contentType === 'application/pdf' ||
    input.contentType.toLowerCase().includes('pdf')
  if (!isPdf) return []

  let pageCount: number | null = null
  try {
    const parsed = await extractPdfTextDetailed(input.pdfBuffer)
    pageCount = parsed.pageCount
  } catch {
    pageCount = null
  }

  if (pageCount != null && pageCount >= PDF_MULTI_DETECT_MIN_PAGES) {
    const multi = await detectPdfMultiSegments(input.pdfBuffer, {
      pageCount,
      fileLabel: input.fileLabel ?? undefined,
      emailBodyText: input.emailBodyText ?? undefined,
    })
    if (multi.segmenti.length) return multi.segmenti
  }

  return []
}

export function buildCombinedInvoiceFields(
  segment: OcrPdfSegment,
  opts: {
    documentDate: string | null
    statementRowsSum: number | null
    fornitoreNome?: string | null
  },
): CombinedInvoiceFields | null {
  const rawNum = segment.numero_fattura?.trim()
  if (!rawNum || segment.numero_e_account_no) return null

  const numeroNorm = normalizeNumeroFattura(rawNum) || rawNum
  if (fatturaNumeroIsMisusedUkAccount(numeroNorm, opts.fornitoreNome ?? segment.ragione_sociale)) {
    return null
  }

  const segDate = segment.data_fattura?.trim()
  const data =
    (segDate ? safeDate(segDate) : null) ??
    (opts.documentDate?.trim() && /^\d{4}-\d{2}-\d{2}$/.test(opts.documentDate.trim())
      ? opts.documentDate.trim()
      : null) ??
    new Date().toISOString().split('T')[0]

  const importoSeg =
    segment.totale_iva_inclusa != null && Number.isFinite(Number(segment.totale_iva_inclusa))
      ? Number(segment.totale_iva_inclusa)
      : null
  const importo = importoSeg ?? opts.statementRowsSum

  return {
    numero_fattura: numeroNorm,
    importo,
    data,
    segment,
  }
}

export type AutoRegisterCombinedInvoiceResult =
  | { ok: true; fattura_id: string; linked_existing?: boolean }
  | { ok: false; reason: string }

/**
 * Dopo l'ingest di uno statement: se lo stesso PDF contiene anche una fattura fiscale
 * (es. Eden Springs statement + Tax Invoice), crea la fattura e la collega a
 * statements.linked_fattura_id — equivalente al pulsante «Crea anche fattura».
 */
export async function autoRegisterCombinedPdfInvoiceAfterStatement(
  supabase: SupabaseClient,
  opts: {
    statementId: string
    fornitoreId: string
    sedeId: string | null
    fileUrl: string
    documentDate: string | null
    pdfBuffer: Buffer
    contentType: string
    statementRowsSum?: number | null
    segmentiPdf?: OcrPdfSegment[] | null
    docMetadata?: Record<string, unknown> | null
    emailBodyText?: string | null
    fileLabel?: string | null
    fornitoreNome?: string | null
  },
): Promise<AutoRegisterCombinedInvoiceResult> {
  const { data: stmt, error: stmtErr } = await supabase
    .from('statements')
    .select('id, linked_fattura_id')
    .eq('id', opts.statementId)
    .maybeSingle()

  if (stmtErr && stmtErr.code !== '42703') return { ok: false, reason: stmtErr.message }
  if (!stmt && stmtErr?.code !== '42703') return { ok: false, reason: 'statement_not_found' }
  const linkedId =
    stmt && 'linked_fattura_id' in stmt
      ? (stmt as { linked_fattura_id?: string | null }).linked_fattura_id
      : null
  if (linkedId) {
    return { ok: false, reason: 'already_linked' }
  }

  const segments = await resolvePdfSegmentsForCombinedInvoice({
    pdfBuffer: opts.pdfBuffer,
    contentType: opts.contentType,
    segmentiPdf: opts.segmentiPdf,
    docMetadata: opts.docMetadata,
    emailBodyText: opts.emailBodyText,
    fileLabel: opts.fileLabel,
  })

  const invoiceSegment = pickInvoiceSegmentFromPdfSegments(segments)
  if (!invoiceSegment) {
    return { ok: false, reason: 'no_fiscal_segment' }
  }

  const fields = buildCombinedInvoiceFields(invoiceSegment, {
    documentDate: opts.documentDate,
    statementRowsSum: opts.statementRowsSum ?? null,
    fornitoreNome: opts.fornitoreNome,
  })
  if (!fields) {
    return { ok: false, reason: 'invalid_invoice_number' }
  }

  const insertResult = await insertEmailAutoFattura(supabase, {
    fornitoreId: opts.fornitoreId,
    sedeId: opts.sedeId,
    dataDoc: fields.data,
    fileUrl: opts.fileUrl,
    meta: {
      numero_fattura: fields.numero_fattura,
      totale_iva_inclusa: fields.importo,
    },
  })

  let fatturaId: string | null = null
  let linkedExisting = false
  if ('id' in insertResult) {
    fatturaId = insertResult.id
  } else if ('duplicateId' in insertResult) {
    fatturaId = insertResult.duplicateId
    linkedExisting = true
  } else {
    return { ok: false, reason: insertResult.error }
  }

  const { error: linkErr } = await supabase
    .from('statements')
    .update({ linked_fattura_id: fatturaId })
    .eq('id', opts.statementId)
    .is('linked_fattura_id', null)

  if (linkErr) {
    if (linkErr.code === '42703') {
      logger.warn('[STMT-AUTO-INV] Migration linked_fattura_id mancante — fattura creata senza link', {
        statementId: opts.statementId,
        fatturaId,
      })
      return { ok: true, fattura_id: fatturaId, linked_existing: linkedExisting }
    }
    logger.warn('[STMT-AUTO-INV] Fattura creata ma link statement fallito', {
      statementId: opts.statementId,
      fatturaId,
      error: linkErr.message,
    })
    return { ok: false, reason: linkErr.message }
  }

  logger.info('[STMT-AUTO-INV] Fattura combinata registrata automaticamente', {
    statementId: opts.statementId,
    fatturaId,
    numero: fields.numero_fattura,
    linkedExisting,
  })

  return { ok: true, fattura_id: fatturaId, linked_existing: linkedExisting }
}

/** Statement già in DB senza fattura collegata — backfill limitato (es. apertura tab Verifica). */
export async function backfillCombinedInvoicesForStatements(
  supabase: SupabaseClient,
  opts: {
    sedeId: string
    fornitoreId?: string | null
    limit?: number
  },
): Promise<{ attempted: number; created: number }> {
  const limit = Math.min(Math.max(opts.limit ?? 3, 1), 10)

  let q = supabase
    .from('statements')
    .select('id, fornitore_id, sede_id, file_url, document_date, email_subject')
    .eq('sede_id', opts.sedeId)
    .eq('status', 'done')
    .is('linked_fattura_id', null)
    .not('file_url', 'is', null)
    .order('received_at', { ascending: false })
    .limit(limit)

  if (opts.fornitoreId) q = q.eq('fornitore_id', opts.fornitoreId)

  const { data: rows, error } = await q
  if (error || !rows?.length) return { attempted: 0, created: 0 }

  const { downloadStorageObjectByFileUrl } = await import('@/lib/documenti-storage-url')
  let created = 0

  for (const stmt of rows) {
    if (!stmt.file_url || !stmt.fornitore_id) continue

    const { data: rowSums } = await supabase
      .from('statement_rows')
      .select('importo')
      .eq('statement_id', stmt.id)
    let rowsSum: number | null = null
    if (rowSums?.length) {
      let sum = 0
      let n = 0
      for (const r of rowSums) {
        const v = r.importo != null ? Number(r.importo) : null
        if (v != null && Number.isFinite(v)) {
          sum += v
          n++
        }
      }
      if (n > 0) rowsSum = Math.round(sum * 100) / 100
    }

    const dl = await downloadStorageObjectByFileUrl(supabase, stmt.file_url)
    if ('error' in dl) continue

    const contentType = dl.contentType?.includes('pdf') ? 'application/pdf' : dl.contentType || 'application/pdf'

    const { data: fornitoreRow } = await supabase
      .from('fornitori')
      .select('nome, display_name')
      .eq('id', stmt.fornitore_id)
      .maybeSingle()
    const fornitoreNome =
      (fornitoreRow as { display_name?: string | null; nome?: string } | null)?.display_name ||
      (fornitoreRow as { nome?: string } | null)?.nome ||
      null

    const result = await autoRegisterCombinedPdfInvoiceAfterStatement(supabase, {
      statementId: stmt.id,
      fornitoreId: stmt.fornitore_id,
      sedeId: stmt.sede_id,
      fileUrl: stmt.file_url,
      documentDate: stmt.document_date,
      pdfBuffer: dl.data,
      contentType,
      statementRowsSum: rowsSum,
      emailBodyText: stmt.email_subject,
      fileLabel: stmt.email_subject ?? undefined,
      fornitoreNome,
    })

    if (result.ok) created++
  }

  return { attempted: rows.length, created }
}
