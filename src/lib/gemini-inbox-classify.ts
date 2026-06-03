import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  geminiGenerateVision,
  GeminiConfigurationError,
  GeminiTransientError,
} from '@/lib/gemini-vision'
import { downloadStorageObjectByFileUrl } from '@/lib/documenti-storage-url'
import { inferContentTypeFromBuffer } from '@/lib/fix-ocr-dates-helpers'
import { validateDocument, logValidationWarnings } from '@/lib/document-validator'
import { logger } from '@/lib/logger'
import { ocrInvoice, OcrInvoiceConfigurationError, OcrTransientError } from '@/lib/ocr-invoice'
import {
  documentOcrContextSuggestsQuotation,
  inferPendingDocumentKindForQueueRow,
} from '@/lib/document-bozza-routing'
import { normalizeTipoDocumento } from '@/lib/ocr-tipo-documento'
import { coerceInboxTipoFromSignals } from '@/lib/inbox-ai-tipo-coerce'
import { mapInboxTipoToPendingKind } from '@/lib/inbox-ai-suggested-kind'
import type { GeminiInboxClassification } from '@/lib/inbox-ai-classify-shared'

export type { GeminiInboxClassification } from '@/lib/inbox-ai-classify-shared'
export {
  GEMINI_AUTO_DISCARD_ALTRIO_MIN_CONF,
  inboxClassificationShouldAutoDiscard,
} from '@/lib/inbox-ai-classify-shared'

const CLASSIFY_SYSTEM = `Sei un assistente per documenti contabili italiani (ristorazione / fornitori).
Analizza il documento allegato e rispondi SOLO con un oggetto JSON valido, senza markdown, senza testo fuori dal JSON.

Chiavi obbligatorie:
- "tipo_suggerito": uno tra "fattura" | "nota_credito" | "bolla" | "ddt" | "estratto_conto" | "ordine" | "listino" | "altro"

When to choose each type — read carefully (English hints for common filenames/emails):

• Use "ordine" for purchase orders, sales orders, order confirmations, PO acknowledgements — titles like "Sales Order", "Sales Order Confirmation", "Purchase Order", "Order Confirmation", "Conferma ordine", "Auftragsbestätigung". NOT a tax invoice and NOT a delivery note (DDT).

• NEVER use "ordine" for quotations / quotes / preventivi — documents titled "Quotation", "Sales Quotation", "Preventivo", "Price Quotation", "Offerta" are offers, not confirmed orders. Use "altro" even if the PDF shows line totals or an "Order Date" field.

• Use "listino" ONLY for supplier PRICE COMMUNICATIONS (prices, catalogue lines, tariffs for products you buy). Never use "listino" for personal documents.

• NEVER use "listino" for: CV / curriculum vitae / résumé / resume, job applications, cover letters, «modulo di candidatura», recruitment, staff hiring documents — those are always "altro".

• Use "fattura" ONLY for VAT/tax invoices / proper fiscal invoices.

• Use "nota_credito" for CREDIT NOTES / credit memos / note di credito / credit note documents. These are documents that reduce or cancel a previous invoice — they typically have negative amounts, the heading "Credit Note" / "Nota di Credito" / "Avoir" / "Gutschrift", and reference the original invoice number. Never classify a credit note as "fattura".

• Use "bolla" or "ddt" for delivery notes / transport documents without full tax invoice layout.

• Use "altro" for CVs, resumes, contracts that are not invoices, internal memos, or anything that does not match the types above.

Also in Italian:
- "ordine" per ordini d'acquisto, sales order, conferme ordine (non fattura, non DDT). Mai per Quotation / Preventivo / Offerta.
- "listino" SOLO per comunicazioni prezzi fornitori / listini acquisto. Mai per CV, curriculum, candidature lavoro, lettere di presentazione: per quelli usa "altro".
- "nota_credito" per Note di Credito, documenti con importi negativi che rettificano una fattura precedente. Mai classificarle come "fattura".

- "fornitore_suggerito": nome leggibile sul documento, oppure null
- "azione_consigliata": breve frase (italiano ok)
- "confidenza": numero tra 0 e 1

Se il file non è leggibile: tipo_suggerito "altro", fornitore_suggerito null, confidenza bassa.`

export { coerceInboxTipoFromSignals, coerceListinoFromSignals } from '@/lib/inbox-ai-tipo-coerce'

type InferredPendingKind = ReturnType<typeof inferPendingDocumentKindForQueueRow>

function pendingKindToInboxTipo(kind: InferredPendingKind): string {
  if (!kind) return 'altro'
  const map: Record<NonNullable<InferredPendingKind>, string> = {
    fattura: 'fattura',
    bolla: 'bolla',
    nota_credito: 'nota_credito',
    ordine: 'ordine',
    statement: 'estratto_conto',
    listino: 'listino',
    comunicazione: 'altro',
  }
  return map[kind] ?? 'altro'
}

function azioneForInboxTipo(tipo: string, quotation = false): string {
  if (quotation) {
    return 'Preventivo/quotazione — non è un ordine; verifica o scarta'
  }
  const labels: Record<string, string> = {
    ordine: 'Registra come ordine / conferma ordine',
    fattura: 'Registra come fattura',
    nota_credito: 'Registra come nota di credito',
    bolla: 'Registra come bolla / DDT',
    ddt: 'Registra come bolla / DDT',
    estratto_conto: 'Registra come estratto conto',
    listino: 'Registra come listino prezzi',
    altro: 'Documento non fiscale — verifica o scarta',
  }
  return labels[tipo] ?? `Tipo letto: ${tipo}`
}

function parseJsonObject(raw: string): Record<string, unknown> {
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  const slice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned
  return JSON.parse(slice) as Record<string, unknown>
}

function clamp01(n: unknown): number {
  const x = typeof n === 'number' ? n : parseFloat(String(n))
  if (!Number.isFinite(x)) return 0.5
  return Math.min(1, Math.max(0, x))
}

function strOrNull(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s ? s : null
}

const MAX_BYTES = 18 * 1024 * 1024

type ClassifyRow = {
  id: string
  file_url: string | null
  file_name?: string | null
  content_type?: string | null
  oggetto_mail?: string | null
}

async function persistInboxClassificationMetadata(
  service: SupabaseClient,
  docId: string,
  classification: GeminiInboxClassification,
  extras?: { tipo_documento?: string | null },
): Promise<void> {
  const { data } = await service
    .from('documenti_da_processare')
    .select('metadata')
    .eq('id', docId)
    .maybeSingle()

  const base =
    data?.metadata && typeof data.metadata === 'object' && !Array.isArray(data.metadata)
      ? { ...(data.metadata as Record<string, unknown>) }
      : {}

  const pendingKind = mapInboxTipoToPendingKind(classification.tipo_suggerito)
  const tipoDoc =
    extras?.tipo_documento?.trim() ||
    (pendingKind === 'ordine' ? 'ordine' : null)

  const next: Record<string, unknown> = {
    ...base,
    ai_tipo_suggerito: classification.tipo_suggerito,
    ai_confidenza: classification.confidenza,
    ai_fornitore_suggerito: classification.fornitore_suggerito,
    ai_azione_consigliata: classification.azione_consigliata,
  }
  if (tipoDoc) next.tipo_documento = tipoDoc
  if (pendingKind && pendingKind !== 'comunicazione') {
    next.pending_kind = pendingKind
  }

  const { error } = await service
    .from('documenti_da_processare')
    .update({ metadata: next })
    .eq('id', docId)
  if (error) {
    logger.warn(`[Classify] persist metadata ${docId}: ${error.message}`)
  }
}

/**
 * Stessa pipeline OCR delle tabelle fornitori / reprocess legacy (`ocrInvoice` + routing coda).
 */
async function classifyFromOcrInvoice(
  service: SupabaseClient,
  row: ClassifyRow,
  data: Buffer,
  mime: string,
): Promise<GeminiInboxClassification | null> {
  const ctxLabel = row.file_name ?? row.id ?? 'unknown'
  try {
    const ocr = await ocrInvoice(data, mime, undefined, {
      logContext: {
        supabase: service,
        mittente: 'inbox-ai-classify',
        oggetto_mail: row.oggetto_mail ?? null,
        file_name: row.file_name ?? null,
        file_url: row.file_url,
        fornitore_id: null,
        sede_id: null,
      },
    })

    const ocrMeta = {
      tipo_documento: ocr.tipo_documento,
      ragione_sociale: ocr.ragione_sociale,
      numero_fattura: ocr.numero_fattura,
      totale_iva_inclusa: ocr.totale_iva_inclusa ?? null,
      note_corpo_mail: ocr.note_corpo_mail,
    }

    const isQuotation = documentOcrContextSuggestsQuotation(ocrMeta, {
      oggetto_mail: row.oggetto_mail,
      file_name: row.file_name,
    })

    let inferred = inferPendingDocumentKindForQueueRow({
      oggetto_mail: row.oggetto_mail,
      file_name: row.file_name,
      metadata: ocrMeta,
    })

    const ocrNorm = normalizeTipoDocumento(ocr.tipo_documento)
    if (!inferred && ocrNorm === 'ordine' && !isQuotation) inferred = 'ordine'

    let tipo_suggerito = isQuotation ? 'altro' : pendingKindToInboxTipo(inferred)
    if (!isQuotation && tipo_suggerito === 'altro' && ocrNorm === 'ordine') tipo_suggerito = 'ordine'

    let confidenza = isQuotation ? 0.92 : 0.88
    if (!isQuotation && ocrNorm && inferred) confidenza = 0.94
    else if (!isQuotation && inferred) confidenza = 0.91
    else if (!isQuotation && ocrNorm) confidenza = 0.9

    const coerced = coerceInboxTipoFromSignals(
      row.file_name,
      tipo_suggerito,
      confidenza,
      azioneForInboxTipo(tipo_suggerito, isQuotation),
      row.oggetto_mail,
    )

    logger.info(
      `[Classify] OCR ${ctxLabel}: tipo=${coerced.tipo_suggerito} ocr_tipo=${ocr.tipo_documento ?? '—'} inferred=${inferred ?? '—'}`,
    )

    const result: GeminiInboxClassification = {
      doc_id: row.id,
      tipo_suggerito: coerced.tipo_suggerito,
      fornitore_suggerito: ocr.ragione_sociale?.trim() || null,
      azione_consigliata: azioneForInboxTipo(coerced.tipo_suggerito, isQuotation),
      confidenza: clamp01(coerced.confidenza),
    }
    await persistInboxClassificationMetadata(service, row.id, result, {
      tipo_documento: isQuotation
        ? 'quotation'
        : ocr.tipo_documento ?? (coerced.tipo_suggerito === 'ordine' ? 'ordine' : null),
    })
    return result
  } catch (e) {
    if (e instanceof OcrInvoiceConfigurationError) throw e
    if (e instanceof OcrTransientError) {
      logger.warn(`[Classify] OCR transient ${ctxLabel}: ${e.message}`)
      return null
    }
    logger.warn(
      `[Classify] OCR fallback ${ctxLabel}: ${e instanceof Error ? e.message : String(e)}`,
    )
    return null
  }
}

export async function classifyDocumentWithGemini(
  service: SupabaseClient,
  row: ClassifyRow,
): Promise<GeminiInboxClassification> {
  const fileUrl = (row.file_url ?? '').trim()
  if (!fileUrl) {
    return {
      doc_id: row.id,
      tipo_suggerito: 'altro',
      fornitore_suggerito: null,
      azione_consigliata: 'File mancante: impossibile classificare.',
      confidenza: 0,
      error: 'file_url mancante',
    }
  }

  const downloaded = await downloadStorageObjectByFileUrl(service, fileUrl)
  if ('error' in downloaded) {
    return {
      doc_id: row.id,
      tipo_suggerito: 'altro',
      fornitore_suggerito: null,
      azione_consigliata: `Download fallito: ${downloaded.error}`,
      confidenza: 0,
      error: downloaded.error,
    }
  }

  const { data, contentType } = downloaded
  if (data.length > MAX_BYTES) {
    return {
      doc_id: row.id,
      tipo_suggerito: 'altro',
      fornitore_suggerito: null,
      azione_consigliata: 'File troppo grande per l’analisi AI in questa schermata.',
      confidenza: 0,
      error: 'file_too_large',
    }
  }

  let mime = (row.content_type ?? contentType ?? '').trim().toLowerCase()
  if (!mime || mime === 'application/octet-stream') {
    mime = inferContentTypeFromBuffer(data) ?? 'application/pdf'
  }
  if (
    !mime.includes('pdf') &&
    !mime.startsWith('image/') &&
    mime !== 'application/pdf'
  ) {
    mime = 'application/pdf'
  }

  const ctxLabel = row.file_name ?? row.id ?? 'unknown'
  const validation = validateDocument(data, mime)
  logValidationWarnings(`classifyDocumentWithGemini(${ctxLabel})`, validation)

  if (
    !validation.valid &&
    validation.warnings.some(
      (w) => w.code === 'PDF_ENCRYPTED' || w.code === 'PDF_CORRUPT',
    )
  ) {
    const encWarn = validation.warnings.find(
      (w) => w.code === 'PDF_ENCRYPTED' || w.code === 'PDF_CORRUPT',
    )
    const errorMsg = encWarn?.message ?? 'Documento non elaborabile per la classificazione AI'
    logger.error(`[Classify] ${ctxLabel}: ${errorMsg}`)
    return {
      doc_id: row.id,
      tipo_suggerito: 'altro',
      fornitore_suggerito: null,
      azione_consigliata: errorMsg,
      confidenza: 0,
      error: errorMsg,
    }
  }

  try {
    const fromOcr = await classifyFromOcrInvoice(service, row, data, mime)
    if (fromOcr) return fromOcr
  } catch (e) {
    if (e instanceof OcrInvoiceConfigurationError) {
      return {
        doc_id: row.id,
        tipo_suggerito: 'altro',
        fornitore_suggerito: null,
        azione_consigliata: e.message,
        confidenza: 0,
        error: e.message,
      }
    }
    throw e
  }

  const base64 = data.toString('base64')
  const userPrompt =
    `Nome file: ${row.file_name ?? 'sconosciuto'}\n` +
    (row.oggetto_mail?.trim() ? `Oggetto email: ${row.oggetto_mail.trim()}\n` : '') +
    `\nRULES:\n` +
    `- Use "ordine" for Sales Order, Sales Order Confirmation, Purchase Order, Order Confirmation (not invoice, not DDT).\n` +
    `- Use "altro" for Quotation, Preventivo, Price Quotation, Offerta — never "ordine".\n` +
    `- NEVER use tipo_suggerito "listino" for a CV, curriculum vitae, résumé / resume, job application or hiring paper — those must be "altro".\n` +
    `- Use "listino" only for supplier PRICE communications (e.g. "Price Update", price list with products/prices for purchasing).\n` +
    `- Use "nota_credito" for CREDIT NOTES / Credit Memos / Note di Credito / Avoir / Gutschrift with negative amounts or credit wording.\n` +
    `Return only the requested JSON.`

  logger.info(`[Classify] Gemini Vision fallback: ${ctxLabel}, sizeKB: ${(data.length / 1024).toFixed(1)}, mime: ${mime}`)

  try {
    const { text } = await geminiGenerateVision(CLASSIFY_SYSTEM, mime, base64, userPrompt, 700)
    const obj = parseJsonObject(text)
    const tipoRaw = strOrNull(obj.tipo_suggerito) ?? 'altro'
    const confRaw = clamp01(obj.confidenza)
    const azione = strOrNull(obj.azione_consigliata) ?? '—'

    const coerced = coerceInboxTipoFromSignals(
      row.file_name,
      tipoRaw,
      confRaw,
      azione,
      row.oggetto_mail,
    )
    const result: GeminiInboxClassification = {
      doc_id: row.id,
      tipo_suggerito: coerced.tipo_suggerito,
      fornitore_suggerito: strOrNull(obj.fornitore_suggerito),
      azione_consigliata: azione,
      confidenza: clamp01(coerced.confidenza),
    }
    await persistInboxClassificationMetadata(service, row.id, result)
    return result
  } catch (e) {
    if (e instanceof GeminiConfigurationError) {
      return {
        doc_id: row.id,
        tipo_suggerito: 'altro',
        fornitore_suggerito: null,
        azione_consigliata: e.message,
        confidenza: 0,
        error: e.message,
      }
    }
    const msg =
      e instanceof GeminiTransientError
        ? e.message
        : e instanceof Error
          ? e.message
          : 'Errore Gemini'
    return {
      doc_id: row.id,
      tipo_suggerito: 'altro',
      fornitore_suggerito: null,
      azione_consigliata: msg,
      confidenza: 0,
      error: msg,
    }
  }
}
