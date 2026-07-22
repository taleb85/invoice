import type { SupabaseClient } from '@supabase/supabase-js'
import { parseAnyAmount } from '@/lib/ocr-amount'
import { safeDate } from '@/lib/safe-date'
import { normalizeTipoDocumento } from '@/lib/ocr-tipo-documento'
import type { OcrPdfSegment } from '@/lib/ocr-pdf-multi'
import { normalizeNumeroBolla } from '@/lib/fix-ocr-dates-helpers'
import {
  geminiGenerateText,
  geminiGenerateVision,
  DOCUMENT_EXTRACTION_PROMPT,
  GeminiTransientError,
  OCR_INVOICE_SCHEMA,
  type GeminiUsage,
} from '@/lib/gemini-vision'
import { logger } from '@/lib/logger'
import { validateDocument, logValidationWarnings } from '@/lib/document-validator'
import { extractDocumentText, isTextBasedExtractable } from '@/lib/document-extractors'

export { normalizeTipoDocumento }

/* ─────────────────────────────────────────────────────────────
   Public interface — backward-compatible.
   Alias fields (nome, piva, data) are kept for legacy consumers.
───────────────────────────────────────────────────────────── */
export interface OcrResult {
  ragione_sociale: string | null
  p_iva: string | null
  /** Supplier address (street, CAP, city) when visible on document */
  indirizzo: string | null
  /** Document date normalised to YYYY-MM-DD */
  data_fattura: string | null
  /** Per conferme ordine: data accanto a «Order Date» (YYYY-MM-DD), non spedizione/consegna */
  data_ordine?: string | null
  numero_fattura: string | null
  /**
   * Model classification: delivery note vs tax invoice vs other commercial PDF.
   * Canonical enum: fattura | nota_credito | bolla_ddt | ordine | estratto_conto | comunicazione
   * Legacy DB values (bolla, comunicazione_cliente, curriculum, listino, altro) are normalised
   * by normalizeTipoDocumento() before being stored here.
   */
  tipo_documento: 'fattura' | 'nota_credito' | 'bolla_ddt' | 'ordine' | 'estratto_conto' | 'comunicazione' | null
  /**
   * Email body promises a fiscal document soon while no PDF/fiscal attachment is in this extraction.
   * Set by the model per prompt rules; used for follow-up / reminder workflows.
   */
  promessa_invio_documento?: boolean | null
  /** Total amount as a pure float (no currency symbols) */
  totale_iva_inclusa: number | null
  /**
   * For delivery notes (bolla_ddt): sum of line quantities (units, cases, kg as printed).
   * Not a monetary total.
   */
  quantita_totale?: number | null

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
   * The original raw amount string as returned by Gemini before numeric parsing.
   */
  importo_raw?: string | null
  /**
   * Which decimal convention was detected:
   *  'dot'   = Anglo-Saxon  (1,234.56 — dot is decimal separator)
   *  'comma' = Continental  (1.234,56 — comma is decimal separator)
   *  'plain' = No separator ambiguity (e.g. 150 or 150.00)
   */
  formato_importo?: 'dot' | 'comma' | 'plain' | null
  /**
   * Set when ragione_sociale matched a known customer/buyer name and was cleared —
   * downstream should set document state to da_revisionare and flag metadata.
   */
  ocr_cliente_estratto_come_fornitore?: boolean

  /**
   * Quando un PDF contiene più documenti fiscali distinti (passata `detectPdfMultiSegments`).
   */
  segmenti_pdf?: OcrPdfSegment[] | null

  // ── Alias backward-compatible ─────────────────────────────
  nome: string | null
  piva: string | null
  data: string | null
}

export const EMPTY_OCR: OcrResult = {
  ragione_sociale: null,
  p_iva: null,
  indirizzo: null,
  data_fattura: null,
  numero_fattura: null,
  tipo_documento: null,
  promessa_invio_documento: false,
  totale_iva_inclusa: null,
  note_corpo_mail: null,
  estrazione_utile: undefined,
  importo_raw: null,
  formato_importo: null,
  ocr_cliente_estratto_come_fornitore: undefined,
  nome: null,
  piva: null,
  data: null,
}

/** Thrown when `GEMINI_API_KEY` is not configured. */
export class OcrInvoiceConfigurationError extends Error {
  override name = 'OcrInvoiceConfigurationError'
  constructor(
    message = "GEMINI_API_KEY non configurata: impossibile eseguire l'estrazione OCR.",
  ) {
    super(message)
  }
}

/**
 * Thrown when the Gemini call fails for a transient reason
 * (timeout, rate-limit, 5xx). Allows the caller to distinguish
 * "no data extracted" from "extraction failed: retry next cycle".
 */
export class OcrTransientError extends Error {
  override name = 'OcrTransientError'
  constructor(
    message: string,
    public readonly cause: unknown,
  ) {
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
  scanAttachmentFingerprint?: string | null
  imapUid?: number | null
}

export type OcrInvoiceOptions = {
  logContext?: OcrInvoiceLogContext
  /** Plain-text email body: fiscal hints + note_corpo_mail extraction */
  emailBodyText?: string | null
  /** Called with token-usage stats after each successful Gemini call. */
  onUsage?: (usage: GeminiUsage) => void
  /**
   * Singola riga “Rianalizza” in admin: (1) PDF → salta testo e usa vision; (2) immagini/scan
   * da telefono → suffisso prompt dedicato (titolo, foto, perspective). Sempre usato con `bolla_id`/`fattura_id`.
   * Nome legacy: in passato serviva soprattutto per i PDF; vale anche per JPEG/PNG di scanner AI.
   */
  preferVisionForPdf?: boolean
}

/** @deprecated Use OcrResult */
export type OcrInvoiceResult = OcrResult

/* ─────────────────────────────────────────────────────────────
   Detect which decimal convention a raw amount string uses.
───────────────────────────────────────────────────────────── */
function detectFormatoImporto(raw: string): 'dot' | 'comma' | 'plain' {
  const s = raw.replace(/[£€$¥₹CHF\s]/g, '').trim()
  if (/\d,\d{1,2}$/.test(s) && !s.includes('.')) return 'comma'
  if (/\d\.\d{3},\d{2}$/.test(s)) return 'comma'
  if (/\d\.\d{1,2}$/.test(s) && !s.includes(',')) return 'dot'
  if (/\d,\d{3}\.\d{2}$/.test(s)) return 'dot'
  return 'plain'
}

/** @deprecated Import from `@/lib/ocr-amount` (client-safe). */
export { parseAnyAmount } from '@/lib/ocr-amount'

/** Max chars of email body sent to the model (per request). */
const EMAIL_BODY_MAX_CHARS = 8000

function truncateEmailBody(text: string): string {
  const t = text.trim()
  if (t.length <= EMAIL_BODY_MAX_CHARS) return t
  return `${t.slice(0, EMAIL_BODY_MAX_CHARS)}\n…[truncated]`
}

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

/** Default buyer names — merged with `sedi.nomi_cliente_da_ignorare` when sede_id is set. */
export const DEFAULT_NOMI_CLIENTE_DA_IGNORARE = [
  'Osteria Basilico',
  'Eurogold Restaurant Ltd',
  'Eurogold Restaurant',
  'Eurogold',
  'Basilico Restaurant',
  'Mediterraneo Restaurant',
] as const

function normalizeForCustomerNameMatch(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

/** True if ragione_sociale matches an ignored customer/buyer name (exact or substring). */
export function matchesIgnoredCustomerRagioneSociale(
  ragioneSociale: string | null | undefined,
  ignored: readonly string[],
): boolean {
  const rs = ragioneSociale?.trim()
  if (!rs) return false
  const norm = normalizeForCustomerNameMatch(rs)
  for (const ign of ignored) {
    const g = normalizeForCustomerNameMatch(ign)
    if (!g) continue
    if (norm === g || norm.includes(g) || g.includes(norm)) return true
  }
  return false
}

function buildIgnoredCustomerNamesPromptBlock(names: readonly string[]): string {
  const joined = names.map((n) => n.trim()).filter(Boolean).join(', ')
  const lines = names.map((n) => `- ${n}`).join('\n')
  return `
REGOLA IMPORTANTE (IT) / IMPORTANT RULE (EN):
Il cliente/destinatario della fattura rientra sempre tra questi nomi (varianti incluse): ${joined}.
The invoice **recipient** for this tenant is always one of these names (including variants): ${joined}.

Il campo JSON **ragione_sociale** è il nome legale del FORNITORE/EMITTENTE (chi ha emesso e firmato la fattura), MAI il cliente. In UI questo valore è l'«azienda fornitore» — non il destinatario.

Se uno di questi nomi appare come «azienda» principale sul foglio, cercare il venditore nel blocco intestazione in alto a destra, in **Cedente / Prestatore**, o in etichette **From / Emittente / Seller** — quello è il fornitore corretto. **Non** usare Cessionario / Bill to / Ship to per ragione_sociale.

Se non riesci a identificare con certezza il fornitore, restituisci **ragione_sociale** null (non inventare).

Reference list:
${lines}
`
}

async function resolveIgnoredCustomerNamesForOcr(
  logContext: OcrInvoiceLogContext | undefined,
): Promise<string[]> {
  const merged = new Set<string>(DEFAULT_NOMI_CLIENTE_DA_IGNORARE)
  if (!logContext?.sede_id || !logContext?.supabase) {
    return [...merged]
  }
  try {
    const { data, error } = await logContext.supabase
      .from('sedi')
      .select('nomi_cliente_da_ignorare')
      .eq('id', logContext.sede_id)
      .maybeSingle()
    if (error) {
      console.warn('[OCR] sedi.nomi_cliente_da_ignorare:', error.message)
      return [...merged]
    }
    const raw = data?.nomi_cliente_da_ignorare as unknown
    if (Array.isArray(raw)) {
      for (const x of raw) {
        if (typeof x === 'string' && x.trim()) merged.add(x.trim())
      }
    }
    return [...merged]
  } catch (e) {
    console.warn('[OCR] resolveIgnoredCustomerNamesForOcr:', e)
    return [...merged]
  }
}

function applyIgnoredCustomerSanitize(result: OcrResult, ignored: readonly string[]): OcrResult {
  if (!matchesIgnoredCustomerRagioneSociale(result.ragione_sociale, ignored)) return result
  return {
    ...result,
    ragione_sociale: null,
    nome: null,
    ocr_cliente_estratto_come_fornitore: true,
  }
}

/* ─────────────────────────────────────────────────────────────
   OCR system prompt — universal, all 5 languages
───────────────────────────────────────────────────────────── */
function buildSystemPrompt(
  languageHint?: string,
  mode: PromptMode = 'with_attachment',
  extras?: { ignoredCustomerNames?: string[] },
): string {
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

  const ignoredCount = extras?.ignoredCustomerNames?.length ?? 0
  const ignoreBlock =
    ignoredCount > 0 ? buildIgnoredCustomerNamesPromptBlock(extras!.ignoredCustomerNames!) : ''

  return `${modeIntro}Supported document types:
- Invoice (EN) = Fattura (IT) = Factura (ES) = Facture (FR) = Rechnung (DE) → **fattura** — a tax invoice issued by a seller with VAT breakdown and fiscal numbering.
- Order Confirmation (EN) = Conferma d'ordine (IT) = Confirmación de pedido (ES) = Confirmation de commande (FR) = Auftragsbestätigung (DE) → **ordine** — acknowledges a purchase order; typically shows "Order Confirmation", "Sales Order", "SO", "PO Acknowledgement", "Conferma Ordine" as the primary title. NOT a tax invoice. Classify as **ordine**, never as fattura.
- Quotation / Quote / Preventivo / Offerta commerciale → **comunicazione** (or null) — a price offer, NOT an order. Never use **ordine** when the main title is "Quotation", "Sales Quotation", "Preventivo", etc., even if the layout shows totals or an "Order Date" label.
- Delivery note (EN) = Bolla/DDT (IT) = Albarán (ES) = Bon de livraison (FR) = Lieferschein (DE) → **bolla_ddt**
- Credit note (EN) = Nota credito (IT) = Nota de crédito (ES) = Avoir (FR) = Gutschrift (DE) → **nota_credito** (not fattura)
- Account/bank statement → **estratto_conto**; CV/résumé or conversational email → **comunicazione**
- If the primary visible title is "Order Confirmation", "Conferma d'Ordine", "Auftragsbestätigung", "Confirmation de commande", or similar, you MUST use **ordine** even if the document contains prices or totals — unless the title is Quotation/Preventivo/Quote (then **comunicazione**, never ordine).

Return ONLY valid JSON — no markdown, no explanation:
{
  "ragione_sociale": "The legal party ISSUING the document (seller with VAT in the issuer header — often top-right on EU invoices; not the buyer, not a logo-only banner) — or null",
  "p_iva": "Supplier VAT/tax number digits only, no country prefix — or null",
  "indirizzo": "Supplier registered or trading address as a single line (street, postal code, city) if visible — or null",
  "data_fattura": "Document date in YYYY-MM-DD format — or null",
  "data_ordine": "For **ordine** only: Order Date (label 'Order Date', 'Data ordine', …) in YYYY-MM-DD. Use UK/EU day-first when the PDF shows DD/MM/YYYY (e.g. 01/04/2026 → 2026-04-01). Do NOT use Despatch Date, Delivery Date, or email receipt date. For non-ordine documents use null.",
  "numero_fattura": "Document reference: invoice number, DDT/bolla number, credit note number — or null if none visible",
  "tipo_documento": "Exactly one of: fattura | nota_credito | bolla_ddt | ordine | estratto_conto | comunicazione | null — see detailed rules in the system prompt. Never use free-text sentences; use a single lower-case token or null only.",
  "promessa_invio_documento": false,
  "totale_iva_inclusa": "The gross total amount — return the RAW string exactly as it appears (e.g. '1.234,56' or '£1,234.56' or '1234.56') so the caller can detect the numeric format. Extract this for ALL document types (fattura, nota_credito, bolla_ddt, ordine) whenever a total, grand total, amount due, or document total is visible — never omit it for delivery notes if a total is printed.",
  "quantita_totale": "For **bolla_ddt** / delivery notes only: total delivered quantity as a number (sum of line Qty/Quantity/Qtà columns when a single total is not printed). Units/cases/kg as on the document — not money. For invoices use null.",
  "note_corpo_mail": "If an EMAIL BODY section was provided WITH a document: operational/logistics notes from the email only (e.g. missing goods, delivery time changes, substitutions, special instructions) that are NOT already stated on the document — or null. For EMAIL-ONLY input: null unless you need a short free-text summary of product lines that do not fit other fields.",
  "estrazione_utile": true
}
${ignoreBlock}
Rules:
${DOCUMENT_EXTRACTION_PROMPT}

- **promessa_invio_documento:** boolean per the shared rules in the system prompt (email promises a document soon + no fiscal PDF in this extraction). When this request is **attachment PDF/image only** with no email body section, use **false**. Default **false** when absent from model output (caller coerces). If **true**, set **estrazione_utile** to **true** (follow-up is needed).
- **comunicazione:** for **email-only** or **no usable attachment** threads that are purely conversational without fiscal data (including CVs / résumés); usually set **estrazione_utile** to **false** unless there are still useful references (PO numbers, dates) worth keeping.
- ragione_sociale: the party **ISSUING** the document (seller), **never** the recipient/buyer. Look for labels such as Vendor, Supplier, Fornitore, Mittente, Absender, Fournisseur, Proveedor, **Cedente**, **Prestatore**, Seller — the SELLER, not the buyer.
- **EU / Italian layout (PDF and scans):** Fiscal PDFs often split the page: **buyer/customer** (*Cessionario / Committente / Bill to / Ship to*) tends to appear **top-left** or in a left column; the **issuer/seller** (*Cedente / Prestatore / Supplier*) with **seller VAT (P.IVA)** is commonly in the **upper-right** block. **ragione_sociale** must match the legal entity shown next to the seller/issuer VAT, in that issuer block — **not** the customer block, **not** a marketplace "deliver to" line, **not** a carrier.
- **Logo vs legal name:** A prominent **brand, chain, or distributor name** (large type top-centre or top-left) may differ from the **legal company** printed with **VAT in the issuer header (often top-right)**. Prefer the **VAT-adjacent legal company name** from the issuer block for ragione_sociale. If only a marketing name without VAT is visible in one area and a full legal header with VAT appears top-right, **use the top-right issuer name**.
- p_iva: accept VAT No., P.IVA, NIF/CIF, N° TVA, USt-IdNr., SIRET — strip all non-digit characters. Prefer the **supplier/issuer** VAT in the same block as ragione_sociale, not the customer's VAT.
- indirizzo: only the supplier/seller address, not the customer.
- For **ordine**: set **data_ordine** from the **Order Date** field only; set **data_fattura** to the same value as **data_ordine** (not Despatch/Delivery dates).
- numero_fattura: for ANY document type, extract the main document reference number if visible — not only "Invoice No.". For delivery notes / DDT / dispatch documents, map English labels such as "Note Number", "Notes Number", "Notes No.", "Delivery Note No.", "DN", "D.N.", "Document No.", "Your document number", "Shipment number", "Despatch note"; Italian "Numero DDT", "Numero documento di trasporto"; German "Lieferschein-Nr."; French "N° bon de livraison"; Spanish "Nº albarán". Return ONLY the alphanumeric reference (e.g. "11851464"), never the label text. If both an invoice number and a separate delivery-note number appear on the same page, prefer the one matching tipo_documento.
- **Account No. vs Invoice No. (UK suppliers, e.g. Eden Springs):** NEVER put "Account No.", "A/C No.", "Customer account", or "Account number" values in numero_fattura — those are customer account references (often 8–10 digits), not tax invoice numbers. Use the reference from the **Tax invoice / Self-billing invoice / Credit note** section only. If the PDF is mainly an account statement and only Account No. is visible in the header, set numero_fattura to null and tipo_documento to estratto_conto unless a separate invoice number appears in the statement lines or on another page.
- For tipo_documento, also keep consistency with: Rechnung *as invoice*, Lieferschein, Albarán, Bon de livraison (map to ddt/bolla via the same keyword rules; never return fattura for a document whose primary title is only a transport/delivery docket, unless a full tax invoice is clearly the main document type).
- totale_iva_inclusa: return the raw amount string EXACTLY as printed (including any currency symbol and separators). Do NOT convert to a number.
- quantita_totale: for **bolla_ddt** / Lieferschein / delivery note, sum line quantities or read a printed total quantity; never put a £/€ monetary total in this field. For **fattura** / **ordine**, use null.
${estrazioneRule}- note_corpo_mail: never copy long generic email signatures or legal disclaimers; keep it concise.
- If a field is absent, use null.`
}

/** Heuristic: should we create a synthetic documenti_da_processare row from email text only? */
export function ocrBodyOnlyWorthInserting(ocr: OcrResult): boolean {
  if (ocr.promessa_invio_documento === true) return true
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

/** True if the extraction produced nothing useful. */
export function ocrExtractedNothingUseful(ocr: OcrResult): boolean {
  return !ocrBodyOnlyWorthInserting(ocr)
}

type ParseOcrOutcome =
  | { ok: true; result: OcrResult }
  | { ok: false; result: OcrResult; reason: string; rawPreview: string }

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
    const p_iva = parsed.p_iva ? String(parsed.p_iva).replace(/\D/g, '') || null : null
    const indirizzo =
      typeof parsed.indirizzo === 'string' && parsed.indirizzo.trim()
        ? String(parsed.indirizzo).trim()
        : null
    const dataRaw = parsed.data_fattura
    const dataStr =
      dataRaw == null || dataRaw === ''
        ? ''
        : (typeof dataRaw === 'string' ? dataRaw : String(dataRaw)).trim()
    const data_ordine_raw = parsed.data_ordine
    const data_ordine_str =
      data_ordine_raw == null || data_ordine_raw === ''
        ? ''
        : (typeof data_ordine_raw === 'string' ? data_ordine_raw : String(data_ordine_raw)).trim()
    const data_ordine = data_ordine_str ? safeDate(data_ordine_str) : null
    let data_fattura = dataStr ? safeDate(dataStr) : null
    const numero_fattura = normalizeNumeroBolla(parsed.numero_fattura)
    const tipo_documento = normalizeTipoDocumento(parsed.tipo_documento)
    if (tipo_documento === 'ordine' && data_ordine) {
      data_fattura = data_ordine
    }

    const promessa_invio_documento =
      typeof parsed.promessa_invio_documento === 'boolean'
        ? parsed.promessa_invio_documento
        : false

    const noteRaw = parsed.note_corpo_mail
    const note_corpo_mail =
      typeof noteRaw === 'string' && noteRaw.trim() ? noteRaw.trim() : null

    let estrazione_utile: boolean | null | undefined
    if (typeof parsed.estrazione_utile === 'boolean') estrazione_utile = parsed.estrazione_utile
    else estrazione_utile = undefined

    const rawTotale = parsed.totale_iva_inclusa
    const importo_raw = rawTotale != null ? String(rawTotale) : null
    const formato_importo = importo_raw ? detectFormatoImporto(importo_raw) : null
    const totale_iva_inclusa =
      typeof rawTotale === 'number'
        ? rawTotale
        : importo_raw
          ? parseAnyAmount(importo_raw)
          : null
    
    let quantita_totale: number | null = null
    const rawQty = parsed.quantita_totale
    if (rawQty != null && rawQty !== '') {
      const n = typeof rawQty === 'number' ? rawQty : parseFloat(String(rawQty).replace(',', '.'))
      if (Number.isFinite(n) && n >= 0) quantita_totale = Math.round(n * 1000) / 1000
    }

    return {
      ok: true,
      result: {
        ragione_sociale,
        p_iva,
        indirizzo,
        data_fattura,
        data_ordine: tipo_documento === 'ordine' ? data_ordine ?? data_fattura : data_ordine,
        numero_fattura,
        tipo_documento,
        promessa_invio_documento,
        totale_iva_inclusa,
        quantita_totale,
        importo_raw,
        formato_importo,
        note_corpo_mail,
        estrazione_utile,
        nome: ragione_sociale,
        piva: p_iva,
        data: data_fattura,
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

  logger.error(`[OCR] ${detail}`)

  if (logContext) {
    try {
      await logContext.supabase.from('log_sincronizzazione').insert([
        {
          mittente: logContext.mittente || 'sconosciuto',
          oggetto_mail: logContext.oggetto_mail,
          stato: 'bolla_non_trovata',
          errore_dettaglio: detail,
          fornitore_id: logContext.fornitore_id ?? null,
          file_url: logContext.file_url ?? null,
          sede_id: logContext.sede_id ?? null,
          allegato_nome: logContext.file_name ?? null,
          imap_uid: logContext.imapUid ?? null,
          scan_attachment_fingerprint: logContext.scanAttachmentFingerprint ?? null,
        },
      ])
    } catch (logErr) {
      logger.error('[OCR] Scrittura log_sincronizzazione fallita:', logErr)
    }
  }

  return outcome.result
}

async function finalizeParseOutcomeAndSanitize(
  outcome: ParseOcrOutcome,
  logContext: OcrInvoiceLogContext | undefined,
  ignoredCustomerNames: readonly string[],
): Promise<OcrResult> {
  const r = await finalizeParseOutcome(outcome, logContext)
  return applyIgnoredCustomerSanitize(r, ignoredCustomerNames)
}

async function finalizePdfOcrResult(
  outcome: ParseOcrOutcome,
  pdfBuffer: Buffer,
  pageCount: number | null,
  logContext: OcrInvoiceLogContext | undefined,
  ignoredCustomerNames: readonly string[],
  options?: OcrInvoiceOptions,
): Promise<OcrResult> {
  const base = await finalizeParseOutcomeAndSanitize(outcome, logContext, ignoredCustomerNames)
  const enhanced = await enhancePdfOcrWithMultiSegments(base, pdfBuffer, pageCount, options)
  return sanitizeUkAccountNoAsInvoiceNumber(enhanced)
}

/* ─────────────────────────────────────────────────────────────
   PDF text extraction
───────────────────────────────────────────────────────────── */
import { extractPdfTextDetailed } from '@/lib/pdf-parse-utils'
import { prepareImageBufferForVision } from '@/lib/ocr-invoice-vision-prepare'
import {
  detectPdfMultiSegments,
  mergePrimaryOcrWithPdfSegments,
  numeroLooksLikeUkAccountReference,
  PDF_MULTI_DETECT_MIN_PAGES,
} from '@/lib/ocr-pdf-multi'

async function enhancePdfOcrWithMultiSegments(
  result: OcrResult,
  pdfBuffer: Buffer,
  pageCount: number | null,
  options?: OcrInvoiceOptions,
): Promise<OcrResult> {
  if (pageCount == null || pageCount < PDF_MULTI_DETECT_MIN_PAGES) return result
  if (!result.ragione_sociale && !result.numero_fattura && result.tipo_documento == null) {
    return result
  }
  const ctxLabel = options?.logContext?.file_name ?? 'pdf'
  try {
    const multi = await detectPdfMultiSegments(pdfBuffer, {
      pageCount,
      languageHint: undefined,
      emailBodyText: options?.emailBodyText,
      fileLabel: ctxLabel,
      onUsage: options?.onUsage,
    })
    if (!multi.pdf_multiplo) return result

    const merged = mergePrimaryOcrWithPdfSegments(
      {
        tipo_documento: result.tipo_documento,
        numero_fattura: result.numero_fattura,
        data_fattura: result.data_fattura,
        totale_iva_inclusa: result.totale_iva_inclusa,
        ragione_sociale: result.ragione_sociale,
      },
      multi,
    )

    logger.info(`[OCR] ${ctxLabel}: PDF multiplo — ${merged.segmenti_pdf.length} segmenti`, {
      tipi: merged.segmenti_pdf.map((s) => s.tipo_documento),
      numeri: merged.segmenti_pdf.map((s) => s.numero_fattura ?? (s.numero_e_account_no ? 'account' : '—')),
    })

    return {
      ...result,
      tipo_documento: merged.tipo_documento,
      numero_fattura: merged.numero_fattura,
      data_fattura: merged.data_fattura,
      data: merged.data_fattura,
      totale_iva_inclusa: merged.totale_iva_inclusa,
      ragione_sociale: merged.ragione_sociale ?? result.ragione_sociale,
      nome: merged.ragione_sociale ?? result.nome,
      segmenti_pdf: merged.segmenti_pdf,
    }
  } catch (e) {
    logger.warn(
      `[OCR] ${ctxLabel}: rilevamento PDF multiplo fallito (non bloccante):`,
      e instanceof Error ? e.message : e,
    )
    return result
  }
}

/** Dopo OCR: se numero sembra Account No. UK e tipo fattura, azzera per evitare duplicati Eden Springs. */
export function sanitizeUkAccountNoAsInvoiceNumber(result: OcrResult): OcrResult {
  if (
    normalizeTipoDocumento(result.tipo_documento) === 'fattura' &&
    numeroLooksLikeUkAccountReference(result.numero_fattura) &&
    (
      /^\d{9}$/.test((result.numero_fattura ?? '').replace(/\s/g, '')) ||
      result.ragione_sociale?.toLowerCase().includes('eden springs')
    ) &&
    !result.segmenti_pdf?.some((s) => s.tipo_documento === 'fattura' && s.numero_fattura)
  ) {
    return { ...result, numero_fattura: null }
  }
  return result
}

/* ─────────────────────────────────────────────────────────────
   Main OCR function
   - PDF con testo → Gemini text (veloce), salvo options.preferVisionForPdf → sempre vision
   - PDF solo immagine / preferVisionForPdf → Gemini vision (PDF nativo)
   - Immagine → Gemini vision
───────────────────────────────────────────────────────────── */
export async function ocrInvoice(
  buffer: Buffer | Uint8Array,
  contentType: string,
  languageHint?: string,
  options?: OcrInvoiceOptions,
): Promise<OcrResult> {
  if (!process.env.GEMINI_API_KEY?.trim()) {
    const err = new OcrInvoiceConfigurationError()
    logger.error(`[OCR] ${err.message}`)
    throw err
  }

  const buf = Buffer.from(buffer)
  const logContext = options?.logContext
  const ctxLabel = logContext?.file_name ?? 'unknown'

  const validation = validateDocument(buf, contentType)
  logValidationWarnings(`ocrInvoice(${ctxLabel})`, validation)

  if (!validation.valid && validation.warnings.some((w) => w.code === 'PDF_ENCRYPTED' || w.code === 'PDF_CORRUPT')) {
    const encWarn = validation.warnings.find((w) => w.code === 'PDF_ENCRYPTED' || w.code === 'PDF_CORRUPT')
    if (encWarn) {
      logger.error(`[OCR] ${ctxLabel}: ${encWarn.message}`)
    }
    return EMPTY_OCR
  }

  const ignoredCustomerNames = await resolveIgnoredCustomerNamesForOcr(logContext)
  const SYSTEM_PROMPT = buildSystemPrompt(languageHint, 'with_attachment', {
    ignoredCustomerNames,
  })
  const emailBody = options?.emailBodyText
  const onUsage = options?.onUsage

  const textUserMsg = (text: string) => {
    let msg = `Document text (extracted from PDF; if truncated, infer tipo_documento from headers and fiscal cues in this excerpt):\n${text.slice(0, 8000)}`
    if (emailBody?.trim()) msg += `\n\n${buildEmailBodyInstructionBlock(emailBody)}`
    return msg
  }

  const rianalizzaVisionSuffix = options?.preferVisionForPdf
    ? `

[Re-analysis: full document in vision] The file may be a **multi-page PDF** or a **phone photograph / camera scan** (not typed text on screen). For **photos and scans**: ignore desk background and fingers if visible; allow for perspective skew, shadows, and moiré; read the **visible fiscal header** (titles, VAT blocks), not only the largest marketing logo. Classify tipo_documento from the **visible document header and layout** (tax lines, VAT, invoice number fields vs delivery/DDT wording), not from filename. If the main visible title is Tax / VAT / Commercial / Sales invoice, Fattura, Factura, Rechnung in a **fiscal** context, set tipo_documento to "fattura". Use "ddt" or "bolla" only when the dominant title is clearly a **transport / delivery docket** without a full tax-invoice form. **For ragione_sociale / p_iva**: on typical EU invoices the **seller (Cedente/Prestatore)** is printed **top-right with VAT**; the **buyer** is often **top-left** — extract the issuer block, **not** a brand name that only appears beside the recipient or in the page centre without issuer VAT.`
    : ''

  const visionTextPrompt =
    SYSTEM_PROMPT +
    (emailBody?.trim() ? `\n${buildEmailBodyInstructionBlock(emailBody)}` : '') +
    rianalizzaVisionSuffix

  if (contentType === 'application/pdf') {
    logger.info('[OCR] Elaborazione PDF', {
      file: ctxLabel,
      sizeBytes: buf.length,
      preferVision: options?.preferVisionForPdf,
    })

    const pdfResult = await extractPdfTextDetailed(buf)
    const text = pdfResult.text
    const mustUseVision = !text?.trim() || options?.preferVisionForPdf === true

    if (pdfResult.failureReason === 'password_protected') {
      logger.error(`[OCR] ${ctxLabel}: PDF protetto da password — impossibile elaborare.`)
      return EMPTY_OCR
    }

    if (pdfResult.failureReason === 'corrupted' && !text) {
      logger.error(`[OCR] ${ctxLabel}: PDF corrotto — impossibile estrarre testo o inviare a Vision.`, {
        error: pdfResult.errorMessage,
      })
      return EMPTY_OCR
    }

    if (pdfResult.failureReason === 'unknown_error' && !text) {
      logger.error(`[OCR] ${ctxLabel}: Errore sconosciuto durante parsing PDF.`, {
        error: pdfResult.errorMessage,
      })
    }

    if (pdfResult.pageCount !== null && pdfResult.pageCount > 50) {
      logger.warn(`[OCR] ${ctxLabel}: PDF con ${pdfResult.pageCount} pagine — potrebbe causare timeout o consumo eccessivo di token.`)
    }

    if (!mustUseVision && text) {
      try {
        const res = await geminiGenerateText(SYSTEM_PROMPT, textUserMsg(text), 900, { responseSchema: OCR_INVOICE_SCHEMA })
        onUsage?.(res.usage)
        const outcome = parseOcrJson(res.text)
        return finalizePdfOcrResult(outcome, buf, pdfResult.pageCount, logContext, ignoredCustomerNames, options)
      } catch (err) {
        if (err instanceof GeminiTransientError) {
          throw new OcrTransientError(`PDF testo: ${err.message}`, err)
        }
        logger.error(`[OCR] ${ctxLabel}: Gemini error on PDF testo:`, err)
        return EMPTY_OCR
      }
    }

    if (text?.trim() && options?.preferVisionForPdf) {
      logger.info(`[OCR] ${ctxLabel}: preferVisionForPdf — uso Gemini vision su PDF intero (layout + tipo_documento)`)
    } else {
      logger.info(`[OCR] ${ctxLabel}: PDF senza testo estraibile — invio diretto a Gemini vision (${(buf.length / 1024).toFixed(0)} KB)`)
    }
    try {
      const base64 = buf.toString('base64')
      const res = await geminiGenerateVision(
        SYSTEM_PROMPT,
        'application/pdf',
        base64,
        visionTextPrompt,
        900,
        { responseSchema: OCR_INVOICE_SCHEMA },
      )
      onUsage?.(res.usage)
      const outcome = parseOcrJson(res.text)
      return finalizePdfOcrResult(outcome, buf, pdfResult.pageCount, logContext, ignoredCustomerNames, options)
    } catch (err) {
      if (err instanceof GeminiTransientError) {
        throw new OcrTransientError(`PDF vision: ${err.message}`, err)
      }
      logger.error(`[OCR] ${ctxLabel}: Gemini vision error on PDF:`, err)
      return EMPTY_OCR
    }
  }

  if (isTextBasedExtractable(contentType) && contentType !== 'application/pdf') {
    logger.info(`[OCR] ${ctxLabel}: Elaborazione documento testo (${contentType})`)
    const extracted = await extractDocumentText(buf, contentType)
    if (!extracted.text) {
      logger.error(`[OCR] ${ctxLabel}: Impossibile estrarre testo da ${contentType}: ${extracted.errorMessage}`)
      return EMPTY_OCR
    }
    logger.info(`[OCR] ${ctxLabel}: Testo estratto (${extracted.text.length} caratteri) — invio a Gemini testo`)
    try {
      const res = await geminiGenerateText(SYSTEM_PROMPT, textUserMsg(extracted.text), 900, { responseSchema: OCR_INVOICE_SCHEMA })
      onUsage?.(res.usage)
      const outcome = parseOcrJson(res.text)
      return finalizeParseOutcomeAndSanitize(outcome, logContext, ignoredCustomerNames)
    } catch (err) {
      if (err instanceof GeminiTransientError) {
        throw new OcrTransientError(`${contentType} testo: ${err.message}`, err)
      }
      logger.error(`[OCR] ${ctxLabel}: Gemini error su ${contentType}:`, err)
      return EMPTY_OCR
    }
  }

  const imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!imageTypes.includes(contentType)) {
    logger.warn(`[OCR] ${ctxLabel}: Tipo non supportato: ${contentType} — formati accettati: PDF, JPEG, PNG, WebP, GIF, DOCX, TXT`)
    return EMPTY_OCR
  }

  try {
    // Ridimensiona, ruota (EXIF) e normalizza a JPEG prima di inviare a Gemini Vision.
    const prepared = await prepareImageBufferForVision(buf, contentType)
    logger.info(`[OCR] ${ctxLabel}: Immagine preparata per vision (${prepared.contentType}, ${(prepared.buffer.length / 1024).toFixed(0)} KB)`)
    const base64 = prepared.buffer.toString('base64')
    const res = await geminiGenerateVision(
      SYSTEM_PROMPT,
      prepared.contentType,
      base64,
      visionTextPrompt,
      900,
      { responseSchema: OCR_INVOICE_SCHEMA },
    )
    onUsage?.(res.usage)
    const outcome = parseOcrJson(res.text)
    return finalizeParseOutcomeAndSanitize(outcome, logContext, ignoredCustomerNames)
  } catch (err) {
    if (err instanceof GeminiTransientError) {
      throw new OcrTransientError(`Vision immagine: ${err.message}`, err)
    }
    logger.error(`[OCR] ${ctxLabel}: Gemini error on image:`, err)
    return EMPTY_OCR
  }
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
  if (!process.env.GEMINI_API_KEY?.trim()) {
    const err = new OcrInvoiceConfigurationError()
    logger.error(`[OCR] ${err.message}`)
    throw err
  }

  const trimmed = emailBody?.trim()
  if (!trimmed) return { ...EMPTY_OCR, estrazione_utile: false }

  const logContext = options?.logContext
  const ctxLabel = 'email-body'
  const ignoredCustomerNames = await resolveIgnoredCustomerNamesForOcr(logContext)
  const SYSTEM_PROMPT = buildSystemPrompt(languageHint, 'email_body_only', {
    ignoredCustomerNames,
  })

  const emailLen = trimmed.length
  logger.info(`[OCR] ${ctxLabel}: Analisi testo email (${emailLen} caratteri)`)

  try {
    const res = await geminiGenerateText(
      SYSTEM_PROMPT,
      `Email message to parse:\n\n${truncateEmailBody(trimmed)}`,
      450,
      { responseSchema: OCR_INVOICE_SCHEMA },
    )
    options?.onUsage?.(res.usage)
    const outcome = parseOcrJson(res.text)
    return finalizeParseOutcomeAndSanitize(outcome, logContext, ignoredCustomerNames)
  } catch (err) {
    if (err instanceof GeminiTransientError) {
      throw new OcrTransientError(`Email body: ${err.message}`, err)
    }
    logger.error(`[OCR] ${ctxLabel}: Gemini error on email-body-only parse:`, err)
    return EMPTY_OCR
  }
}
