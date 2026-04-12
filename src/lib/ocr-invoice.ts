import OpenAI from 'openai'

/* ─────────────────────────────────────────────────────────────
   Public interface — backward-compatible.
   Alias fields (nome, piva, data) are kept for legacy consumers.
───────────────────────────────────────────────────────────── */
export interface OcrResult {
  ragione_sociale:    string | null
  p_iva:              string | null
  /** Document date normalised to YYYY-MM-DD */
  data_fattura:       string | null
  numero_fattura:     string | null
  /** Total amount as a pure float (no currency symbols) */
  totale_iva_inclusa: number | null

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
  ragione_sociale: null, p_iva: null, data_fattura: null,
  numero_fattura: null, totale_iva_inclusa: null,
  importo_raw: null, formato_importo: null,
  nome: null, piva: null, data: null,
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

/**
 * Parse a raw amount string to a float, regardless of locale conventions.
 * Handles: "1.234,56" → 1234.56, "1,234.56" → 1234.56, "1234.56" → 1234.56
 */
export function parseAnyAmount(s: string): number | null {
  if (!s) return null
  const cleaned = s.replace(/[£€$¥₹CHFkr\s]/g, '').trim()
  if (!cleaned) return null

  // Determine decimal separator
  const lastComma = cleaned.lastIndexOf(',')
  const lastDot   = cleaned.lastIndexOf('.')
  let normalized: string

  if (lastComma > lastDot) {
    // Comma is decimal separator: "1.234,56" → "1234.56"
    normalized = cleaned.replace(/\./g, '').replace(',', '.')
  } else if (lastDot > lastComma) {
    // Dot is decimal separator: "1,234.56" → "1234.56"
    normalized = cleaned.replace(/,/g, '')
  } else {
    // No separator or only one of them
    normalized = cleaned.replace(/,/g, '')
  }

  const n = parseFloat(normalized)
  return isNaN(n) ? null : n
}

/* ─────────────────────────────────────────────────────────────
   OCR system prompt — universal, all 5 languages
───────────────────────────────────────────────────────────── */
function buildSystemPrompt(languageHint?: string): string {
  const hint = languageHint
    ? `\nThe document is likely in ${languageHint.toUpperCase()}. Prioritise parsing conventions for that language.`
    : ''

  return `You are a universal fiscal document parser that handles invoices, delivery notes, and commercial documents in any language.${hint}

Supported document types (all treated equivalently):
- Invoice (EN) = Fattura (IT) = Factura (ES) = Facture (FR) = Rechnung (DE)
- Delivery note (EN) = Bolla/DDT (IT) = Albarán (ES) = Bon de livraison (FR) = Lieferschein (DE)
- Credit note (EN) = Nota credito (IT) = Nota de crédito (ES) = Avoir (FR) = Gutschrift (DE)

Return ONLY valid JSON — no markdown, no explanation:
{
  "ragione_sociale": "The party ISSUING the document (supplier/seller), not the recipient — or null",
  "p_iva": "Supplier VAT/tax number digits only, no country prefix — or null",
  "data_fattura": "Document date in YYYY-MM-DD format — or null",
  "numero_fattura": "Document/invoice reference number — or null",
  "totale_iva_inclusa": "The gross total amount as printed on the document — return the RAW string exactly as it appears (e.g. '1.234,56' or '£1,234.56' or '1234.56') so the caller can detect the numeric format"
}

Rules:
- ragione_sociale: look for "Vendor", "Supplier", "Fornitore", "Mittente", "Absender", "Fournisseur", "Proveedor" — the SELLER, not the buyer.
- p_iva: accept VAT No., P.IVA, NIF/CIF, N° TVA, USt-IdNr., SIRET — strip all non-digit characters.
- totale_iva_inclusa: return the raw amount string EXACTLY as printed (including any currency symbol and separators). Do NOT convert to a number.
- If a field is absent, use null.`
}

/* ─────────────────────────────────────────────────────────────
   Robust JSON parsing with format-aware amount handling
───────────────────────────────────────────────────────────── */
function parseOcrJson(raw: string): OcrResult {
  try {
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) return EMPTY_OCR

    const parsed = JSON.parse(match[0])

    const ragione_sociale = parsed.ragione_sociale ?? null
    const p_iva           = parsed.p_iva ? String(parsed.p_iva).replace(/\D/g, '') || null : null
    const data_fattura    = parsed.data_fattura ?? null
    const numero_fattura  = parsed.numero_fattura ? String(parsed.numero_fattura) : null

    // totale_iva_inclusa may now be a raw string or a number
    const rawTotale    = parsed.totale_iva_inclusa
    const importo_raw  = rawTotale != null ? String(rawTotale) : null
    const formato_importo = importo_raw ? detectFormatoImporto(importo_raw) : null
    const totale_iva_inclusa = typeof rawTotale === 'number'
      ? rawTotale
      : importo_raw ? parseAnyAmount(importo_raw) : null

    return {
      ragione_sociale, p_iva, data_fattura, numero_fattura,
      totale_iva_inclusa, importo_raw, formato_importo,
      nome: ragione_sociale, piva: p_iva, data: data_fattura,
    }
  } catch {
    return EMPTY_OCR
  }
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

/* ─────────────────────────────────────────────────────────────
   Main OCR function
   - PDF  → extract text + send to GPT-4o-mini (text mode)
   - Image → vision (gpt-4o-mini)
   - languageHint: ISO 639-1 code of the supplier's language (optional)
───────────────────────────────────────────────────────────── */
export async function ocrInvoice(
  buffer: Buffer | Uint8Array,
  contentType: string,
  languageHint?: string,
): Promise<OcrResult> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('[OCR] OPENAI_API_KEY not configured — skipping OCR')
    return EMPTY_OCR
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const buf = Buffer.from(buffer)
  const SYSTEM_PROMPT = buildSystemPrompt(languageHint)

  if (contentType === 'application/pdf') {
    const text = await extractPdfText(buf)
    if (!text) {
      console.warn('[OCR] PDF has no extractable text — skipping OCR')
      return EMPTY_OCR
    }

    const snippet = text.slice(0, 4000)
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 300,
        temperature: 0,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: snippet },
        ],
      })
      const result = parseOcrJson(response.choices[0]?.message?.content ?? '')
      return result
    } catch (err) {
      console.error('[OCR] GPT error on PDF:', err)
      return EMPTY_OCR
    }
  }

  const imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!imageTypes.includes(contentType)) {
    console.warn(`[OCR] Unsupported type: ${contentType}`)
    return EMPTY_OCR
  }

  try {
    const base64   = buf.toString('base64')
    const imageUrl = `data:${contentType};base64,${base64}`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 300,
      temperature: 0,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
          { type: 'text', text: SYSTEM_PROMPT },
        ],
      }],
    })
    const result = parseOcrJson(response.choices[0]?.message?.content ?? '')
    return result
  } catch (err) {
    console.error('[OCR] GPT error on image:', err)
    return EMPTY_OCR
  }
}
