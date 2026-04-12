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

const STATEMENT_PROMPT_BASE = `You are a universal financial document parser for bank statements and supplier account statements in any language.

Your job: extract every individual transaction / invoice row from the document regardless of the language it is written in.

Recognised document types:
- Statement (EN) = Estratto conto (IT) = Estado de cuenta (ES) = Relevé de compte (FR) = Kontoauszug (DE)
- Invoice (EN) = Fattura (IT) = Factura (ES) = Facture (FR) = Rechnung (DE)
- Delivery Note (EN) = Bolla/DDT (IT) = Albarán (ES) = Bon de livraison (FR) = Lieferschein (DE)

Return ONLY valid JSON — no markdown, no explanation:
{
  "rows": [
    { "numero": "INV-001", "importo": 310.00, "data": "2026-04-10" },
    { "numero": "INV-002", "importo": 150.00, "data": "2026-04-15" }
  ]
}

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

function parseJson(raw: string): StatementRow[] {
  try {
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) return []
    const parsed = JSON.parse(match[0]) as { rows?: unknown[] }
    if (!Array.isArray(parsed.rows)) return []
    return toRows(parsed.rows)
  } catch {
    return []
  }
}

/** Fallback: GPT returned a bare array instead of { rows: [] } */
function parseJsonArray(raw: string): StatementRow[] {
  try {
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    const match = cleaned.match(/\[[\s\S]*\]/)
    if (!match) return []
    const arr = JSON.parse(match[0])
    if (!Array.isArray(arr)) return []
    return toRows(arr)
  } catch {
    return []
  }
}

/**
 * Parses a statement file (PDF or image) and returns its rows.
 * Returns an empty array if the file cannot be parsed or GPT is unavailable.
 */
export async function ocrStatement(
  buffer: Buffer | Uint8Array,
  contentType: string,
  languageHint?: string,
): Promise<StatementRow[]> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('[OCR-STMT] OPENAI_API_KEY not configured — skipping statement parsing')
    return []
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
          max_tokens: 2000,
          temperature: 0,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user',   content: snippet },
          ],
        })
        const raw  = response.choices[0]?.message?.content ?? ''
        const rows = parseJson(raw) || parseJsonArray(raw)
        return rows
      } catch (err) {
        console.error('[OCR-STMT] Errore GPT su PDF testo:', err)
        return []
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
        max_tokens: 2000,
        temperature: 0,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messages: [{ role: 'user', content: content as any }],
      })
      const raw = response.choices[0]?.message?.content ?? ''
      const rows = parseJson(raw) || parseJsonArray(raw)
      // Clean up the uploaded file
      openai.files.delete(uploaded.id).catch(() => {})
      return rows
    } catch (err) {
      console.error('[OCR-STMT] Errore Files API su PDF:', err)
      return []
    }
  }

  const imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (imageTypes.includes(contentType)) {
    try {
      const base64   = buf.toString('base64')
      const imageUrl = `data:${contentType};base64,${base64}`
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 2000,
        temperature: 0,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
            { type: 'text', text: SYSTEM_PROMPT },
          ],
        }],
      })
      const raw  = response.choices[0]?.message?.content ?? ''
      const rows = parseJson(raw) || parseJsonArray(raw)
      return rows
    } catch (err) {
      console.error('[OCR-STMT] Errore GPT su immagine:', err)
      return []
    }
  }

  console.warn(`[OCR-STMT] Tipo non supportato: ${contentType}`)
  return []
}
