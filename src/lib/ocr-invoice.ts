import OpenAI from 'openai'
import type { SupabaseClient } from '@supabase/supabase-js'
import { parseAnyAmount } from '@/lib/ocr-amount'

/* ─────────────────────────────────────────────────────────────
   Public interface — backward-compatible.
   Alias fields (nome, piva, data) are kept for legacy consumers.
───────────────────────────────────────────────────────────── */
export interface OcrResult {
  ragione_sociale:    string | null
  p_iva:              string | null
  /** Supplier address (street, CAP, city) when visible on document */
  indirizzo:          string | null
  /** Document date normalised to YYYY-MM-DD */
  data_fattura:       string | null
  numero_fattura:     string | null
  /**
   * Model classification: delivery note vs tax invoice vs other commercial PDF.
   * Used by email scan to choose bolla vs fattura bozza without misrouting DDT numbers.
   */
  tipo_documento:     'fattura' | 'bolla' | 'altro' | null
  /** Total amount as a pure float (no currency symbols) */
  totale_iva_inclusa: number | null

  /**
   * Logistics / operational notes taken from the email body (missing goods, time changes, etc.),
   * not duplicated from the formal document when an attachment was parsed.
   */
  note_corpo_mail?: string | null
  /**
   * When parsing email text only: false if the message has nothing worth archiving.
   * Omitted or true when a document attachment was analysed.
   */
  estrazione_utile?: boolean | null

  /**
   * The original raw amount string as returned by GPT before numeric parsing.
   * Useful for the UI to show "£1,234.56" and let the user verify the format.
   */
  importo_raw?: string | null
  /**
   * Which decimal convention was detected:
   *  'dot'   = Anglo-Saxon  (1,234.56 — dot is decimal separator)
   *  'comma' = Continental  (1.234,56 — comma is decimal separator)
   *  'plain' = No separator ambiguity (e.g. 150 or 150.00)
   */
  formato_importo?: 'dot' | 'comma' | 'plain' | null

  // ── Alias backward-compatible ─────────────────────────────
  nome: string | null
  piva: string | null
  data: string | null
}

export const EMPTY_OCR: OcrResult = {
  ragione_sociale: null, p_iva: null, indirizzo: null, data_fattura: null,
  numero_fattura: null, tipo_documento: null, totale_iva_inclusa: null,
  note_corpo_mail: null, estrazione_utile: undefined,
  importo_raw: null, formato_importo: null,
  nome: null, piva: null, data: null,
}

/** Lanciata quando `OPENAI_API_KEY` non è configurata (visibile in log / catch API). */
export class OcrInvoiceConfigurationError extends Error {
  override name = 'OcrInvoiceConfigurationError'
  constructor(message = 'OPENAI_API_KEY non configurata: impossibile eseguire l\'estrazione OCR.') {
    super(message)
  }
}

export type OcrInvoiceLogContext = {
  supabase: SupabaseClient
  mittente: string
  oggetto_mail: string | null
  file_name?: string | null
  fornitore_id?: string | null
  file_url?: string | null
  sede_id?: string | null
  /** Idempotenza scan email (log_sincronizzazione.scan_attachment_fingerprint) */
  scanAttachmentFingerprint?: string | null
  imapUid?: number | null
}

export type OcrInvoiceOptions = {
  logContext?: OcrInvoiceLogContext
  /** Plain-text email body: fiscal hints + note_corpo_mail extraction */
  emailBodyText?: string | null
}

/** @deprecated Use OcrResult */
export type OcrInvoiceResult = OcrResult

/* ─────────────────────────────────────────────────────────────
   Detect which decimal convention a raw amount string uses.
───────────────────────────────────────────────────────────── */
function detectFormatoImporto(raw: string): 'dot' | 'comma' | 'plain' {
  // Strip currency symbols and whitespace first
  const s = raw.replace(/[£€$¥₹CHF\s]/g, '').trim()
  // Comma-decimal: e.g. "1.234,56" or "234,56"
  if (/\d,\d{1,2}$/.test(s) && !s.includes('.')) return 'comma'
  if (/\d\.\d{3},\d{2}$/.test(s)) return 'comma'
  // Dot-decimal: e.g. "1,234.56" or "234.56"
  if (/\d\.\d{1,2}$/.test(s) && !s.includes(',')) return 'dot'
  if (/\d,\d{3}\.\d{2}$/.test(s)) return 'dot'
  return 'plain'
}

/** @deprecated Import from `@/lib/ocr-amount` (client-safe). */
export { parseAnyAmount } from '@/lib/ocr-amount'

const VISION_MODEL = 'gpt-4o' as const
const TEXT_MODEL = 'gpt-4o-mini' as const

const OCR_VISION_CONCURRENCY = Math.min(
  8,
  Math.max(1, Number(process.env.OCR_VISION_CONCURRENCY ?? '3') || 3),
)

function createConcurrencyPool(limit: number) {
  let active = 0
  const queue: Array<() => void> = []
  const pump = () => {
    while (active < limit && queue.length > 0) {
      const run = queue.shift()!
      active++
      run()
    }
  }
  return function runWithPool<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      queue.push(() => {
        fn()
          .then(resolve, reject)
          .finally(() => {
            active--
            pump()
          })
      })
      pump()
    })
  }
}

const withVisionConcurrency = createConcurrencyPool(OCR_VISION_CONCURRENCY)


/** Max chars of email body sent to the model (per request). */
const EMAIL_BODY_MAX_CHARS = 8000

function truncateEmailBody(text: string): string {
  const t = text.trim()
  if (t.length <= EMAIL_BODY_MAX_CHARS) return t
  return `${t.slice(0, EMAIL_BODY_MAX_CHARS)}\n…[truncated]`
}

/** Appended to user messages when an email body accompanies a document. */
function buildEmailBodyInstructionBlock(emailBodyText: string): string {
  return [
    '',
    '--- EMAIL MESSAGE BODY (plain text; may contain totals, dates, product names, delivery notes) ---',
    truncateEmailBody(emailBodyText),
    '--- END EMAIL BODY ---',
    '',
    'If the attachment is missing, unreadable, or lacks fiscal fields, extract supplier name (ragione_sociale), gross total (totale), and document date (data) from the EMAIL BODY above — including order confirmations, Rekki-style lines, and plain-text invoices.',
    'When BOTH attachment and body are present: prefer the formal document for ragione_sociale, p_iva, indirizzo, data_fattura, numero_fattura, totale_iva_inclusa; use the body to fill gaps only where the document does not show the value.',
  ].join('\n')
}

type PromptMode = 'with_attachment' | 'email_body_only'

/* ─────────────────────────────────────────────────────────────
   OCR system prompt — universal, all 5 languages
───────────────────────────────────────────────────────────── */
function buildSystemPrompt(languageHint?: string, mode: PromptMode = 'with_attachment'): string {
  const hint = languageHint
    ? `\nThe document is likely in ${languageHint.toUpperCase()}. Prioritise parsing conventions for that language.`
    : ''

  const modeIntro =
    mode === 'email_body_only'
      ? `You are parsing the PLAIN TEXT of an email message (there is NO PDF or image). Suppliers often write totals, dates, DDT numbers, or product lists directly in the email. Extract every fiscal or delivery-commercial datapoint you can find. The app may create a synthetic queue document tagged "[DA TESTO EMAIL]" from your extraction — be precise.${hint}\n\n`
      : `You are a universal fiscal document parser that handles invoices, delivery notes, and commercial documents in any language.${hint}\n\n`

  const estrazioneRule =
    mode === 'email_body_only'
      ? `- estrazione_utile: set false only for pure pleasantries / unrelated content with no totals, dates, references, VAT, or delivery information. Otherwise true.\n`
      : `- estrazione_utile: set true if useful data came from the attachment and/or the email body; false only if nothing business-relevant was found.\n`

  return `${modeIntro}Supported document types (all treated equivalently):
- Invoice (EN) = Fattura (IT) = Factura (ES) = Facture (FR) = Rechnung (DE)
- Delivery note (EN) = Bolla/DDT (IT) = Albarán (ES) = Bon de livraison (FR) = Lieferschein (DE)
- Credit note (EN) = Nota credito (IT) = Nota de crédito (ES) = Avoir (FR) = Gutschrift (DE)

Return ONLY valid JSON — no markdown, no explanation:
{
  "ragione_sociale": "The party ISSUING the document (supplier/seller), not the recipient — or null",
  "p_iva": "Supplier VAT/tax number digits only, no country prefix — or null",
  "indirizzo": "Supplier registered or trading address as a single line (street, postal code, city) if visible — or null",
  "data_fattura": "Document date in YYYY-MM-DD format — or null",
  "numero_fattura": "Document reference: invoice number, DDT/bolla number, credit note number — or null if none visible",
  "tipo_documento": "Exactly one of: fattura | bolla | altro | null — fattura=tax invoice or credit note; bolla=delivery note/DDT/Lieferschein/Albarán only; altro=quotes/proforma; null only if unreadable. Never use free-text sentences in this field.",
  "totale_iva_inclusa": "The gross total amount — return the RAW string exactly as it appears (e.g. '1.234,56' or '£1,234.56' or '1234.56') so the caller can detect the numeric format",
  "note_corpo_mail": "If an EMAIL BODY section was provided WITH a document: operational/logistics notes from the email only (e.g. missing goods, delivery time changes, substitutions, special instructions) that are NOT already stated on the document — or null. For EMAIL-ONLY input: null unless you need a short free-text summary of product lines that do not fit other fields.",
  "estrazione_utile": true
}

Rules:
- ragione_sociale: look for "Vendor", "Supplier", "Fornitore", "Mittente", "Absender", "Fournisseur", "Proveedor" — the SELLER, not the buyer.
- p_iva: accept VAT No., P.IVA, NIF/CIF, N° TVA, USt-IdNr., SIRET — strip all non-digit characters.
- indirizzo: only the supplier/seller address, not the customer.
- numero_fattura: for ANY document type, extract the main document reference number if visible — not only "Invoice No.". For delivery notes / DDT / dispatch documents, map English labels such as "Note Number", "Notes Number", "Notes No.", "Delivery Note No.", "DN", "D.N.", "Document No.", "Your document number", "Shipment number", "Despatch note"; Italian "Numero DDT", "Numero documento di trasporto"; German "Lieferschein-Nr."; French "N° bon de livraison"; Spanish "Nº albarán". Return ONLY the alphanumeric reference (e.g. "11851464"), never the label text. If both an invoice number and a separate delivery-note number appear on the same page, prefer the one matching tipo_documento.
- tipo_documento: classify from headings/keywords (DDT, D.N., Lieferschein, Delivery note → bolla). When in doubt between invoice and delivery note, prefer bolla if the layout is line-items dispatch without full fiscal invoice wording.
- totale_iva_inclusa: return the raw amount string EXACTLY as printed (including any currency symbol and separators). Do NOT convert to a number.
${estrazioneRule}- note_corpo_mail: never copy long generic email signatures or legal disclaimers; keep it concise.
- If a field is absent, use null.`
}

/** Heuristic: should we create a synthetic documenti_da_processare row from email text only? */
export function ocrBodyOnlyWorthInserting(ocr: OcrResult): boolean {
  if (ocr.estrazione_utile === false) return false
  const pivaOk = !!(ocr.p_iva && ocr.p_iva.replace(/\D/g, '').length >= 7)
  const noteOk = !!(ocr.note_corpo_mail && ocr.note_corpo_mail.trim().length >= 20)
  return !!(
    ocr.totale_iva_inclusa != null ||
    (ocr.data_fattura && String(ocr.data_fattura).trim()) ||
    ocr.numero_fattura?.trim() ||
    pivaOk ||
    ocr.ragione_sociale?.trim() ||
    noteOk
  )
}

/** True se l'estrazione da allegato (o da un primo passaggio) non ha prodotto dati utili. */
export function ocrExtractedNothingUseful(ocr: OcrResult): boolean {
  return !ocrBodyOnlyWorthInserting(ocr)
}

type ParseOcrOutcome =
  | { ok: true; result: OcrResult }
  | { ok: false; result: OcrResult; reason: string; rawPreview: string }

/** Normalizza il tipo documento dall’OCR (stessi valori in metadata `tipo_documento`). */
export function normalizeTipoDocumento(raw: unknown): 'fattura' | 'bolla' | 'altro' | null {
  if (raw == null || raw === '') return null
  const s = String(raw).toLowerCase().replace(/\s+/g, ' ').trim()

  if (s === 'fattura' || s === 'invoice' || s === 'nota_credito' || s === 'credito' || s === 'credit_note') return 'fattura'
  if (s === 'bolla' || s === 'ddt' || s === 'delivery' || s === 'delivery_note' || s === 'lieferschein' || s === 'albaran') return 'bolla'
  if (s === 'altro' || s === 'other') return 'altro'

  // Model may return phrases ("Tax invoice", "Nota di consegna"): classify by keywords.
  // Prefer fattura when both tax-invoice and delivery wording appear (e.g. some layouts).
  if (
    /\bfattura\b/.test(s) ||
    /\binvoice\b/.test(s) ||
    /\bfacture\b/.test(s) ||
    /\bfactura\b/.test(s) ||
    /\brechnung\b/.test(s) ||
    /nota\s+credito/.test(s) ||
    /credit[\s_-]?note/.test(s) ||
    /\bavoir\b/.test(s) ||
    /\bgutschrift\b/.test(s) ||
    /\btax[\s_-]?invoice\b/.test(s) ||
    /\bvat[\s_-]?invoice\b/.test(s) ||
    /\bsales[\s_-]?invoice\b/.test(s)
  ) {
    return 'fattura'
  }
  if (
    /\bddt\b/.test(s) ||
    /\bbolla\b/.test(s) ||
    /delivery[\s_-]?note/.test(s) ||
    /\blieferschein\b/.test(s) ||
    /albar[aá]n/.test(s) ||
    /bon\s+de\s+livraison/.test(s) ||
    /documento\s+di\s+trasporto/.test(s)
  ) {
    return 'bolla'
  }
  if (/preventivo|quotation|\bquote\b|pro[\s_-]?forma|order\s+confirmation|\bordine\b/.test(s)) {
    return 'altro'
  }
  return null
}

/* ─────────────────────────────────────────────────────────────
   Robust JSON parsing — outcome + optional DB log on failure
───────────────────────────────────────────────────────────── */
function parseOcrJson(raw: string): ParseOcrOutcome {
  const rawPreview = (raw ?? '').slice(0, 2000)
  if (!raw?.trim()) {
    return { ok: false, result: EMPTY_OCR, reason: 'Risposta modello vuota', rawPreview: '' }
  }
  try {
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) {
      return {
        ok: false,
        result: EMPTY_OCR,
        reason: 'Nessun oggetto JSON nella risposta del modello',
        rawPreview,
      }
    }

    const parsed = JSON.parse(match[0])

    const ragione_sociale = parsed.ragione_sociale ?? null
    const p_iva           = parsed.p_iva ? String(parsed.p_iva).replace(/\D/g, '') || null : null
    const indirizzo       = typeof parsed.indirizzo === 'string' && parsed.indirizzo.trim()
      ? String(parsed.indirizzo).trim()
      : null
    const data_fattura    = parsed.data_fattura ?? null
    const numero_fattura  = parsed.numero_fattura ? String(parsed.numero_fattura) : null
    const tipo_documento  = normalizeTipoDocumento(parsed.tipo_documento)

    const noteRaw = parsed.note_corpo_mail
    const note_corpo_mail =
      typeof noteRaw === 'string' && noteRaw.trim() ? noteRaw.trim() : null

    let estrazione_utile: boolean | null | undefined
    if (typeof parsed.estrazione_utile === 'boolean') estrazione_utile = parsed.estrazione_utile
    else estrazione_utile = undefined

    // totale_iva_inclusa may now be a raw string or a number
    const rawTotale    = parsed.totale_iva_inclusa
    const importo_raw  = rawTotale != null ? String(rawTotale) : null
    const formato_importo = importo_raw ? detectFormatoImporto(importo_raw) : null
    const totale_iva_inclusa = typeof rawTotale === 'number'
      ? rawTotale
      : importo_raw ? parseAnyAmount(importo_raw) : null

    return {
      ok: true,
      result: {
        ragione_sociale, p_iva, indirizzo, data_fattura, numero_fattura, tipo_documento,
        totale_iva_inclusa, importo_raw, formato_importo,
        note_corpo_mail, estrazione_utile,
        nome: ragione_sociale, piva: p_iva, data: data_fattura,
      },
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'errore sconosciuto'
    return {
      ok: false,
      result: EMPTY_OCR,
      reason: `JSON non valido: ${msg}`,
      rawPreview,
    }
  }
}

async function finalizeParseOutcome(
  outcome: ParseOcrOutcome,
  logContext: OcrInvoiceLogContext | undefined,
): Promise<OcrResult> {
  if (outcome.ok) return outcome.result

  const detail =
    `[OCR parsing] ${outcome.reason}` +
    (outcome.rawPreview ? ` | anteprima risposta: ${outcome.rawPreview.slice(0, 800)}` : '') +
    (logContext?.file_name ? ` | file: ${logContext.file_name}` : '')

  console.error(`[OCR] ${detail}`)

  if (logContext) {
    try {
      await logContext.supabase.from('log_sincronizzazione').insert([{
        mittente:         logContext.mittente || 'sconosciuto',
        oggetto_mail:     logContext.oggetto_mail,
        stato:            'bolla_non_trovata',
        errore_dettaglio: detail,
        fornitore_id:     logContext.fornitore_id ?? null,
        file_url:         logContext.file_url ?? null,
        sede_id:          logContext.sede_id ?? null,
        allegato_nome:    logContext.file_name ?? null,
        imap_uid:         logContext.imapUid ?? null,
        scan_attachment_fingerprint: logContext.scanAttachmentFingerprint ?? null,
      }])
    } catch (logErr) {
      console.error('[OCR] Scrittura log_sincronizzazione fallita:', logErr)
    }
  }

  return outcome.result
}

/* ─────────────────────────────────────────────────────────────
   PDF text extraction
───────────────────────────────────────────────────────────── */
async function extractPdfText(buffer: Buffer): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import('pdf-parse') as any
    const pdfParse = mod.default ?? mod
    const result = await pdfParse(buffer)
    return result.text?.trim() || null
  } catch {
    return null
  }
}

/** PDF scannerizzato: stesso approccio di ocr-statement (Files API + vision). */
async function ocrInvoicePdfAsFile(
  openai: OpenAI,
  buf: Buffer,
  systemPrompt: string,
  logContext: OcrInvoiceLogContext | undefined,
  emailBodyText?: string | null,
): Promise<OcrResult> {
  return withVisionConcurrency(async () => {
    const textPrompt =
      systemPrompt +
      (emailBodyText?.trim() ? `\n${buildEmailBodyInstructionBlock(emailBodyText)}` : '')

    const { tryRasterizePdfFirstPageForVision } = await import('@/lib/ocr-invoice-vision-prepare')
    const raster = await tryRasterizePdfFirstPageForVision(buf)
    if (raster) {
      try {
        const base64 = raster.toString('base64')
        const imageUrl = `data:image/jpeg;base64,${base64}`
        const response = await openai.chat.completions.create({
          model: VISION_MODEL,
          max_tokens: 550,
          temperature: 0,
          messages: [{
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
              { type: 'text', text: textPrompt },
            ],
          }],
        })
        const raw = response.choices[0]?.message?.content ?? ''
        const outcome = parseOcrJson(raw)
        return finalizeParseOutcome(outcome, logContext)
      } catch (err) {
        console.error('[OCR] Vision su PDF rasterizzato fallita, fallback Files API:', err)
      }
    }

    try {
      const file = new File([new Uint8Array(buf)], 'document.pdf', { type: 'application/pdf' })
      const uploaded = await openai.files.create({ file, purpose: 'user_data' })
      const content = [
        { type: 'file' as const, file: { file_id: uploaded.id } },
        { type: 'text' as const, text: textPrompt },
      ]
      const response = await openai.chat.completions.create({
        model: VISION_MODEL,
        max_tokens: 500,
        temperature: 0,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messages: [{ role: 'user', content: content as any }],
      })
      const raw = response.choices[0]?.message?.content ?? ''
      const outcome = parseOcrJson(raw)
      openai.files.delete(uploaded.id).catch(() => {})
      return finalizeParseOutcome(outcome, logContext)
    } catch (err) {
      console.error('[OCR] Errore Files API / vision su PDF:', err)
      return EMPTY_OCR
    }
  })
}

/* ─────────────────────────────────────────────────────────────
   Main OCR function
   - PDF con testo → GPT testo (mini)
   - PDF solo immagine → Files API + gpt-4o
   - Immagine → vision gpt-4o
───────────────────────────────────────────────────────────── */
export async function ocrInvoice(
  buffer: Buffer | Uint8Array,
  contentType: string,
  languageHint?: string,
  options?: OcrInvoiceOptions,
): Promise<OcrResult> {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    const err = new OcrInvoiceConfigurationError()
    console.error(`[OCR] ${err.message}`)
    throw err
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const buf = Buffer.from(buffer)
  const SYSTEM_PROMPT = buildSystemPrompt(languageHint, 'with_attachment')
  const logContext = options?.logContext
  const emailBody = options?.emailBodyText

  if (contentType === 'application/pdf') {
    const text = await extractPdfText(buf)
    if (text) {
      const snippet = text.slice(0, 4000)
      let userMsg = `Document text (extracted from PDF):\n${snippet}`
      if (emailBody?.trim()) userMsg += `\n\n${buildEmailBodyInstructionBlock(emailBody)}`
      try {
        const response = await openai.chat.completions.create({
          model: TEXT_MODEL,
          max_tokens: 400,
          temperature: 0,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user',   content: userMsg },
          ],
        })
        const outcome = parseOcrJson(response.choices[0]?.message?.content ?? '')
        return finalizeParseOutcome(outcome, logContext)
      } catch (err) {
        console.error('[OCR] GPT error on PDF testo:', err)
        return EMPTY_OCR
      }
    }

    console.warn('[OCR] PDF senza testo estraibile — fallback vision (gpt-4o + Files API)')
    return ocrInvoicePdfAsFile(openai, buf, SYSTEM_PROMPT, logContext, emailBody)
  }

  const imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!imageTypes.includes(contentType)) {
    console.warn(`[OCR] Unsupported type: ${contentType}`)
    return EMPTY_OCR
  }

  return withVisionConcurrency(async () => {
    try {
      const { prepareImageBufferForVision } = await import('@/lib/ocr-invoice-vision-prepare')
      const { buffer: visionBuf, contentType: visionMime } = await prepareImageBufferForVision(buf, contentType)
      const base64 = visionBuf.toString('base64')
      const imageUrl = `data:${visionMime};base64,${base64}`

      const visionText =
        SYSTEM_PROMPT +
        (emailBody?.trim() ? `\n${buildEmailBodyInstructionBlock(emailBody)}` : '')

      const response = await openai.chat.completions.create({
        model: VISION_MODEL,
        max_tokens: 550,
        temperature: 0,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
            { type: 'text', text: visionText },
          ],
        }],
      })
      const outcome = parseOcrJson(response.choices[0]?.message?.content ?? '')
      return finalizeParseOutcome(outcome, logContext)
    } catch (err) {
      console.error('[OCR] GPT error on image:', err)
      return EMPTY_OCR
    }
  })
}

/**
 * Parse fiscal / delivery-commercial fields from plain email text (no attachment).
 * Use {@link ocrBodyOnlyWorthInserting} before inserting a synthetic queue row.
 */
export async function ocrInvoiceFromEmailBody(
  emailBody: string,
  languageHint?: string,
  options?: OcrInvoiceOptions,
): Promise<OcrResult> {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    const err = new OcrInvoiceConfigurationError()
    console.error(`[OCR] ${err.message}`)
    throw err
  }

  const trimmed = emailBody?.trim()
  if (!trimmed) return { ...EMPTY_OCR, estrazione_utile: false }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const SYSTEM_PROMPT = buildSystemPrompt(languageHint, 'email_body_only')
  const logContext = options?.logContext

  try {
    const response = await openai.chat.completions.create({
      model: TEXT_MODEL,
      max_tokens: 450,
      temperature: 0,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Email message to parse:\n\n${truncateEmailBody(trimmed)}` },
      ],
    })
    const outcome = parseOcrJson(response.choices[0]?.message?.content ?? '')
    return finalizeParseOutcome(outcome, logContext)
  } catch (err) {
    console.error('[OCR] GPT error on email-body-only parse:', err)
    return EMPTY_OCR
  }
}
