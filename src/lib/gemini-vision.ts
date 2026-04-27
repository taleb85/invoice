/**
 * Gemini 2.5 Flash-Lite vision / text: OCR fatture, DDT, estratti, listini.
 *
 * Supports both text-only and multimodal (image + PDF) calls.
 * Gemini handles PDFs natively — no rasterization or Files API needed.
 */
import { GoogleGenerativeAI } from '@google/generative-ai'

export const GEMINI_MODEL = 'gemini-2.5-flash-lite' as const

/** Cost per 1M tokens (USD) — Gemini 2.5 Flash-Lite. */
export const GEMINI_PRICING = {
  inputPerMillion: 0.075,  // $0.075 / 1M input tokens
  outputPerMillion: 0.30,  // $0.30  / 1M output tokens
} as const

/**
 * Reusable rules for fiscal/document OCR: date parsing and document-type keywords.
 * Concatenate this into the system instruction for any Gemini flow that must return
 * normalised `data_fattura` and `tipo_documento` JSON (see `ocr-invoice` / `buildSystemPrompt`).
 */
export const DOCUMENT_EXTRACTION_PROMPT = `
DATA (field data_fattura):
- Accept dates in Italian: gg/mm/aaaa, gg-mm-aaaa, or month names (e.g. "25 aprile 2026", "15 marzo 2025").
- Accept English/common formats: dd/mm/yyyy, dd-mm-yyyy, and long form such as "April 25, 2026", "25 April 2026" (Month dd, yyyy) or (dd Month yyyy).
- On ambiguous numeric day/month (e.g. 01/11/2026), use the document locale implied by the language/labels: EU/Italian is usually day-first; if a label like "Data emissione", "Data fattura", "Invoice date" sits next to a value, use that value.
- Always output a single value in data_fattura: ISO 8601 date only, YYYY-MM-DD (no time, no free text).
- If the document shows several dates (emission/invoice, delivery, due date, tax point, etc.), you MUST use the document issue / emission / invoice date — the date that legally identifies when this document was issued. Do not use: due/payment date, "delivery" or "consegna" date, "DDT data", or a printed period range end date, when a clearer invoice/DDT issue date exists on the same page.

TIPO DOCUMENTO (field tipo_documento):
- Return exactly one of these lower-case tokens (or null if unreadable): fattura | ddt | bolla | ordine | estratto_conto | altro
- fattura — **Default for any tax/commercial bill with a fiscal total, VAT, payment terms, or invoice/rechnung number**, when the main visible title is any of: Fattura, Fattura elettronica, Invoice, Tax Invoice, VAT Invoice, Commercial Invoice, Sales Invoice, Pro-forma invoice (fiscal), Factura, Factura fiscal, Rechnung (Steuer/Mehrwertsteuer context), Avoir, Gutschrift, Nota di credito (fiscal), Credit note (fiscal). **Never choose ddt/bolla** for these. UK “Self-billing” or “Remittance” blocks still mean fattura if a VAT/invoice number and total are present.
- ddt — only if the **dominant** document title is a transport/dispatch document: DDT, Documento di Trasporto, Delivery note, Dispatch note, Despatch, Proof of delivery **without** a full tax-invoice header on the same first page. If a page mixes DDT and an invoice, prefer the invoice section’s title.
- bolla — same as ddt (transport): Bolla, Bolla di consegna. A document titled as a **sales invoice / fattura** (VAT lines) is **fattura**, not bolla.
- ordine — if the document is primarily an order, not a fiscal dispatch or invoice: Ordine, Purchase order, P.O. / PO.
- estratto_conto — if the document is a supplier/customer account listing: Estratto conto, Statement, Account statement.
- altro — quotes, packing lists, or **non-fiscal** commercial PDFs; use null if the type is completely unreadable.
- If more than one label could apply, use the document’s **largest, topmost official title** (first page, main header), not a small line item or shipping box footer.
- **Critical:** “Tax invoice”, “VAT invoice”, “TAX INVOICE”, “FATTURA” on the first page → **always fattura**, never bolla, unless the only visible text is a pure delivery note (no tax lines).
`.trim()

export interface GeminiUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  /** Estimated cost in USD based on GEMINI_PRICING. */
  estimatedCostUsd: number
}

export interface GeminiResult {
  text: string
  usage: GeminiUsage
}

/** Thrown when GEMINI_API_KEY is missing from the environment. */
export class GeminiConfigurationError extends Error {
  override name = 'GeminiConfigurationError'
  constructor() {
    super("GEMINI_API_KEY non configurata: impossibile eseguire l'estrazione OCR con Gemini.")
  }
}

/** Thrown on transient API failures (rate-limit, timeout, 5xx). */
export class GeminiTransientError extends Error {
  override name = 'GeminiTransientError'
  constructor(
    message: string,
    public readonly cause: unknown,
  ) {
    super(message)
  }
}

// ─── Internals ────────────────────────────────────────────────────────────────

function getModel(systemPrompt: string, maxOutputTokens: number) {
  const key = process.env.GEMINI_API_KEY?.trim()
  if (!key) throw new GeminiConfigurationError()
  const genAI = new GoogleGenerativeAI(key)
  return genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: systemPrompt,
    generationConfig: { maxOutputTokens, temperature: 0 },
  })
}

function buildUsage(
  meta:
    | {
        promptTokenCount?: number
        candidatesTokenCount?: number
        totalTokenCount?: number
      }
    | undefined,
): GeminiUsage {
  const input = meta?.promptTokenCount ?? 0
  const output = meta?.candidatesTokenCount ?? 0
  const total = meta?.totalTokenCount ?? input + output
  const cost =
    (input / 1_000_000) * GEMINI_PRICING.inputPerMillion +
    (output / 1_000_000) * GEMINI_PRICING.outputPerMillion
  return {
    inputTokens: input,
    outputTokens: output,
    totalTokens: total,
    estimatedCostUsd: Math.round(cost * 1_000_000) / 1_000_000,
  }
}

export function isTransientGeminiError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const msg = err.message.toLowerCase()
  const status = (err as { status?: number }).status
  if (status === 429 || (typeof status === 'number' && status >= 500)) return true
  return (
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('rate limit') ||
    msg.includes('rate_limit') ||
    msg.includes('quota') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout')
  )
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Text-only generation: for PDFs with embedded text, email bodies, plain-text inputs.
 */
export async function geminiGenerateText(
  systemPrompt: string,
  userContent: string,
  maxOutputTokens = 600,
): Promise<GeminiResult> {
  const model = getModel(systemPrompt, maxOutputTokens)
  try {
    const result = await model.generateContent(userContent)
    return {
      text: result.response.text(),
      usage: buildUsage(result.response.usageMetadata),
    }
  } catch (err) {
    if (isTransientGeminiError(err)) {
      throw new GeminiTransientError(
        `Gemini text: ${err instanceof Error ? err.message : String(err)}`,
        err,
      )
    }
    throw err
  }
}

/**
 * Vision generation: supports images AND PDFs natively (no rasterization needed).
 *
 * @param mimeType  e.g. 'image/jpeg', 'image/png', 'image/webp', 'application/pdf'
 * @param base64Data  base64-encoded file bytes
 * @param textPrompt  extra text to send alongside the document
 */
export async function geminiGenerateVision(
  systemPrompt: string,
  mimeType: string,
  base64Data: string,
  textPrompt: string,
  maxOutputTokens = 600,
): Promise<GeminiResult> {
  const model = getModel(systemPrompt, maxOutputTokens)
  try {
    const result = await model.generateContent([
      { inlineData: { mimeType, data: base64Data } },
      { text: textPrompt },
    ])
    return {
      text: result.response.text(),
      usage: buildUsage(result.response.usageMetadata),
    }
  } catch (err) {
    if (isTransientGeminiError(err)) {
      throw new GeminiTransientError(
        `Gemini vision (${mimeType}): ${err instanceof Error ? err.message : String(err)}`,
        err,
      )
    }
    throw err
  }
}
