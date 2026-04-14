/**
 * GPT-based statement parser.
 *
 * Given the raw text of a bank or supplier statement PDF/Excel, extracts
 * all invoice/transaction rows as { numero, importo, data }.
 *
 * The prompt is intentionally separate from ocrInvoice — a statement is a
 * tabular document listing multiple transactions, not a single invoice.
 */
import OpenAI from 'openai'

export interface StatementRow {
  numero:  string          // document / invoice reference number
  importo: number          // amount (always positive)
  data:    string | null   // YYYY-MM-DD or null
}

/** Header / metadata read from the PDF (not from individual transaction lines). */
export interface ExtractedPdfDates {
  issued_date: string | null
  last_payment_date: string | null
  account_no: string | null
  credit_limit: string | null
  available_credit: string | null
  payment_terms: string | null
  last_payment_amount: number | null
}

export interface StatementOcrResult {
  rows: StatementRow[]
  /** Null if the model returned no usable document header. */
  extractedPdfDates: ExtractedPdfDates | null
}

/** Shape stored in `statements.extracted_pdf_dates` (jsonb). */
export function extractedPdfDatesToJson(d: ExtractedPdfDates | null): Record<string, string | number> | null {
  if (!d) return null
  const o: Record<string, string | number> = {}
  if (d.issued_date) o.issued_date = d.issued_date
  if (d.last_payment_date) o.last_payment_date = d.last_payment_date
  if (d.account_no) o.account_no = d.account_no
  if (d.credit_limit) o.credit_limit = d.credit_limit
  if (d.available_credit) o.available_credit = d.available_credit
  if (d.payment_terms) o.payment_terms = d.payment_terms
  if (d.last_payment_amount != null && Number.isFinite(d.last_payment_amount)) {
    o.last_payment_amount = d.last_payment_amount
  }
  return Object.keys(o).length ? o : null
}

const STATEMENT_PROMPT_BASE = `You are a universal financial document parser for bank statements and supplier account statements in any language.

Your job: extract every individual transaction / invoice row from the document regardless of the language it is written in.

Recognised document types:
- Statement (EN) = Estratto conto (IT) = Estado de cuenta (ES) = Relevé de compte (FR) = Kontoauszug (DE)
- Invoice (EN) = Fattura (IT) = Factura (ES) = Facture (FR) = Rechnung (DE)
- Delivery Note (EN) = Bolla/DDT (IT) = Albarán (ES) = Bon de livraison (FR) = Lieferschein (DE)

Return ONLY valid JSON — no markdown, no explanation:
{
  "documentHeader": {
    "accountNo": "01OST002",
    "issuedDate": "2025-05-19",
    "creditLimit": 10000,
    "availableCredit": null,
    "paymentTerms": "30EOM",
    "lastPaymentAmount": 1641.43,
    "lastPaymentDate": "2025-04-16"
  },
  "rows": [
    { "numero": "INV-001", "importo": 310.00, "data": "2026-04-10" },
    { "numero": "INV-002", "importo": 150.00, "data": "2026-04-15" }
  ]
}

The "documentHeader" object is optional but should be included when the document prints metadata in a header/summary block (NOT from individual transaction lines):
- "accountNo": account / customer reference (Account No., Codice cliente, etc.) as printed, or null.
- "issuedDate": statement issue date (Issued date, Data emissione, Statement date) as YYYY-MM-DD, or null.
- "creditLimit": numeric credit limit only (no currency symbol), or null if absent or not a number.
- "availableCredit": remaining credit as a number if shown, or null (use null if the field exists but is blank).
- "paymentTerms": payment terms text as printed (e.g. 30EOM, Net 30), or null.
- "lastPaymentAmount": amount of the "Last payment" / "Ultimo pagamento" summary line as a plain positive number, or null if absent.
- "lastPaymentDate": date next to last payment summary (Last payment date, Data ultimo pagamento) as YYYY-MM-DD, or null.
Use two-digit years from the document as 20YY when clearly 2000s (e.g. 19/05/25 → 2025-05-19). If unsure, use null — never invent dates or amounts.

Rules:
- "numero": the invoice or document reference exactly as printed (e.g. INV-001, AM-101, 2024/0042, FAT-2026-03).
- "importo": plain positive number. Strip all currency symbols (£, €, $, CHF, kr, zł…) and thousand separators. Treat both comma and dot as decimal separators — e.g. "1.234,56" → 1234.56.
- "data": transaction or invoice date in YYYY-MM-DD format, or null if absent.
- Include a row ONLY if it has BOTH a document reference AND an amount.
- Skip header rows, total/subtotal lines, account metadata, free-text notes, and balance-forward rows.
- If the document has multiple sections or pages, extract from all of them.`

function buildStatementPrompt(languageHint?: string): string {
  if (!languageHint) return STATEMENT_PROMPT_BASE
  return STATEMENT_PROMPT_BASE + `\n\nThe document is likely in ${languageHint.toUpperCase()}. Prioritise parsing conventions for that language.`
}

/** Extract plain text from a PDF buffer (reuses pdf-parse already in the project) */
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

function toRows(arr: unknown[]): StatementRow[] {
  return arr.flatMap(r => {
    const row = r as Record<string, unknown>
    const numero  = row.numero  ? String(row.numero).trim() : null
    const importo = row.importo !== null && row.importo !== undefined ? Number(row.importo) : NaN
    const data    = row.data    ? String(row.data).trim() : null
    if (!numero || isNaN(importo) || importo <= 0) return []
    return [{ numero, importo, data: data ?? null }]
  })
}

/** Accepts YYYY-MM-DD only (strict). */
function normalizeIsoDate(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null
  const s = String(raw).trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const [y, m, d] = s.split('-').map(Number)
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null
  return s
}

function headerStr(v: unknown, maxLen = 96): string | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number' && Number.isFinite(v)) {
    const s = String(v)
    return s.length > maxLen ? `${s.slice(0, maxLen)}…` : s
  }
  const s = String(v).trim()
  if (!s) return null
  return s.length > maxLen ? `${s.slice(0, maxLen)}…` : s
}

function headerAmount(v: unknown): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return Math.round(v * 100) / 100
  const s = String(v).trim().replace(/,/g, '')
  const n = parseFloat(s)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100) / 100
}

function parseDocumentHeader(obj: unknown): ExtractedPdfDates | null {
  if (!obj || typeof obj !== 'object') return null
  const h = obj as Record<string, unknown>
  const issued =
    normalizeIsoDate(h.issuedDate) ??
    normalizeIsoDate(h.issued_date)
  const lastPay =
    normalizeIsoDate(h.lastPaymentDate) ??
    normalizeIsoDate(h.last_payment_date)
  const account_no = headerStr(
    h.accountNo ?? h.account_no ?? h.accountNumber ?? h.account_number,
  )
  const credit_limit = headerStr(h.creditLimit ?? h.credit_limit)
  const available_credit = headerStr(h.availableCredit ?? h.available_credit)
  const payment_terms = headerStr(h.paymentTerms ?? h.payment_terms)
  const last_payment_amount = headerAmount(h.lastPaymentAmount ?? h.last_payment_amount)

  if (
    !issued &&
    !lastPay &&
    !account_no &&
    !credit_limit &&
    !available_credit &&
    !payment_terms &&
    last_payment_amount == null
  ) {
    return null
  }

  return {
    issued_date: issued,
    last_payment_date: lastPay,
    account_no,
    credit_limit,
    available_credit,
    payment_terms,
    last_payment_amount,
  }
}

function parseJsonResponse(raw: string): StatementOcrResult {
  const empty: StatementOcrResult = { rows: [], extractedPdfDates: null }
  try {
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) return empty
    const parsed = JSON.parse(match[0]) as {
      rows?: unknown[]
      documentHeader?: unknown
    }
    const rows = Array.isArray(parsed.rows) ? toRows(parsed.rows) : []
    const extractedPdfDates = parseDocumentHeader(parsed.documentHeader)
    return { rows, extractedPdfDates }
  } catch {
    return empty
  }
}

/** Fallback: GPT returned a bare array instead of { rows: [] } */
function parseJsonArrayResponse(raw: string): StatementOcrResult {
  try {
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    const match = cleaned.match(/\[[\s\S]*\]/)
    if (!match) return { rows: [], extractedPdfDates: null }
    const arr = JSON.parse(match[0])
    if (!Array.isArray(arr)) return { rows: [], extractedPdfDates: null }
    return { rows: toRows(arr), extractedPdfDates: null }
  } catch {
    return { rows: [], extractedPdfDates: null }
  }
}

/** Prefer object shape; if rows only in bare array, keep header from object parse when present. */
function mergeOcrParse(raw: string): StatementOcrResult {
  const fromObj = parseJsonResponse(raw)
  if (fromObj.rows.length) return fromObj
  const fromArr = parseJsonArrayResponse(raw)
  if (fromArr.rows.length) {
    return { rows: fromArr.rows, extractedPdfDates: fromObj.extractedPdfDates }
  }
  return fromObj
}

/**
 * Parses a statement file (PDF or image) and returns rows + optional PDF header dates.
 */
export async function ocrStatement(
  buffer: Buffer | Uint8Array,
  contentType: string,
  languageHint?: string,
): Promise<StatementOcrResult> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('[OCR-STMT] OPENAI_API_KEY not configured — skipping statement parsing')
    return { rows: [], extractedPdfDates: null }
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const buf = Buffer.from(buffer)
  const SYSTEM_PROMPT = buildStatementPrompt(languageHint)

  if (contentType === 'application/pdf') {
    const text = await extractPdfText(buf)

    if (text) {
      // Text-based PDF — fast path via text completion
      const snippet = text.slice(0, 8000)
      try {
        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          max_tokens: 2500,
          temperature: 0,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user',   content: snippet },
          ],
        })
        const raw = response.choices[0]?.message?.content ?? ''
        return mergeOcrParse(raw)
      } catch (err) {
        console.error('[OCR-STMT] Errore GPT su PDF testo:', err)
        return { rows: [], extractedPdfDates: null }
      }
    }

    // Image-based PDF (scanned/Excel-exported) — use OpenAI Files API
    try {
      const file = new File([buf], 'statement.pdf', { type: 'application/pdf' })
      const uploaded = await openai.files.create({ file, purpose: 'user_data' })
      const content = [
        { type: 'file' as const, file: { file_id: uploaded.id } },
        { type: 'text' as const, text: SYSTEM_PROMPT },
      ]
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 2500,
        temperature: 0,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messages: [{ role: 'user', content: content as any }],
      })
      const raw = response.choices[0]?.message?.content ?? ''
      const out = mergeOcrParse(raw)
      // Clean up the uploaded file
      openai.files.delete(uploaded.id).catch(() => {})
      return out
    } catch (err) {
      console.error('[OCR-STMT] Errore Files API su PDF:', err)
      return { rows: [], extractedPdfDates: null }
    }
  }

  const imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (imageTypes.includes(contentType)) {
    try {
      const base64   = buf.toString('base64')
      const imageUrl = `data:${contentType};base64,${base64}`
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 2500,
        temperature: 0,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
            { type: 'text', text: SYSTEM_PROMPT },
          ],
        }],
      })
      const raw = response.choices[0]?.message?.content ?? ''
      return mergeOcrParse(raw)
    } catch (err) {
      console.error('[OCR-STMT] Errore GPT su immagine:', err)
      return { rows: [], extractedPdfDates: null }
    }
  }

  console.warn(`[OCR-STMT] Tipo non supportato: ${contentType}`)
  return { rows: [], extractedPdfDates: null }
}
