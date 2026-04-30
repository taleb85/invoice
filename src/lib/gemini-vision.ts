/**
 * Gemini 2.5 Flash-Lite vision / text: OCR fatture, DDT, estratti, listini.
 *
 * Supports both text-only and multimodal (image + PDF) calls.
 * Gemini handles PDFs natively — no rasterization or Files API needed.
 */
import { GoogleGenerativeAI } from '@google/generative-ai'

/** Modello OCR predefinito (override con `GEMINI_MODEL` nell’env). */
export const GEMINI_MODEL = 'gemini-2.5-flash-lite' as const

/** Id effettivamente usato dall’SDK (rileva `.env`). */
export function getGeminiModelId(): string {
  const o = process.env.GEMINI_MODEL?.trim()
  return o || GEMINI_MODEL
}

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

SUPPLIER NAME (field ragione_sociale in the main JSON schema):
- The **issuer/seller** legal name (with seller VAT), **not** the buyer. On many **EU and Italian** PDFs the **Cedente / Prestatore** block (seller P.IVA) is **upper-right**; **Cessionario / Committente** (customer) is often **upper-left** — do not swap them.
- Prefer the company name **adjacent to the seller/issuer VAT**. A large **brand or chain** name elsewhere (top-centre, watermark) may **not** be the legal supplier — use the name in the **issuer VAT header** when they differ.
- Multi-tenant SaaS: the **restaurant / venue that receives invoices** may appear very large (bill-to, logo, “deliver to”). A runtime list **IGNORE_AS_SUPPLIER** in the assembled system prompt lists **buyer-only** legal names for this deployment — **never** put those in ragione_sociale; if the only prominent name matches that list, extract the **issuer** from Cedente/Prestatore, From, Emittente, Seller, or the **upper-right** fiscal block.

TIPO DOCUMENTO (field tipo_documento):
- Return exactly one of these lower-case tokens (or null if unreadable): fattura | ddt | bolla | ordine | estratto_conto | comunicazione_cliente | altro | curriculum
- **fattura** — The document is a **tax/commercial invoice** when you see a **fiscal layout**: **taxable base (imponibile)**, **VAT / IVA / tax rows** (rates, amounts, or columns), **payment terms or due dates (scadenze / scadenzario / payment due / Fälligkeit)**, and/or a clear **invoice / Rechnung / Fattura** number in a fiscal context. Headings like Tax invoice, VAT invoice, Fattura, Factura fiscal, Rechnung with Mehrwertsteuer/USt. **Never choose ddt/bolla** when these fiscal elements dominate. UK “Self-billing” or “Remittance” blocks still mean fattura if a VAT/invoice number and fiscal total are present.
- **ddt** / **bolla** — **Transport / delivery first**: classify when the dominant content is **logistics**, not a full tax invoice: **packages / colli / cartons**, **carriers / vettori / tracking / vehicle**, **causale di trasporto / reason for transport / Incoterms-style dispatch**, DDT, Documento di Trasporto, Delivery note, Lieferschein, Albarán, Bon de livraison, **without** the full invoice structure (imponibile + IVA + scadenze) on the same primary view. If a page mixes DDT blocks with a clear **invoice** section, prefer **fattura**. A titled **sales invoice with VAT lines** is always **fattura**, never bolla.
- **estratto_conto** — **Account / banking statement**: tabular **list of movements** (debits/credits, saldo porta/saldo finale, unpaid invoices listed as open items), **bank or supplier statement** wording (Estratto conto, Account statement, Statement of account, Kontoauszug, Relevé). Not a single-invoice fiscal layout (that remains **fattura**).
- **ordine** — primarily an **order** document (PO, Ordine), not yet a dispatched DDT nor a finalized tax invoice.
- **comunicazione_cliente** — use when the analysed content is **only conversational email-style text** from the supplier/customer (thanks, appointments, generic updates, scheduling) **with no usable fiscal datapoints**: no totals with tax context, no DDT/colli blocks, no bank movement tables. Typical when there is **no PDF attachment** and the body has no invoice/DDT numbers or amounts to extract. Do **not** use for PDFs that are formal documents — for a non-fiscal attachment use **altro** or **curriculum** instead.
- **curriculum** — **personal CV / résumé** (education, employment, skills): not fiscal. Never return fattura for these.
- **altro** — quotes, packing lists, cover letters, or **non-fiscal** PDFs (excluding CVs and pure chit-chat which is comunicazione_cliente in email-only cases); **null** if completely unreadable.
- If more than one label could apply, use the document’s **largest, topmost official title** and the **dominant structural cues** (fiscal invoice vs logistics vs ledger table).
- **Critical:** If the first page shows **VAT/tax rows + invoice-style totals + due dates**, that is **fattura**, not bolla — even if the word “delivery” appears somewhere.

Separate JSON boolean field **promessa_invio_documento** (always present in the response object; callers merge it with main schema):
- Set **true** only when **all** apply: (1) an **email body / message** is in context, (2) the text clearly **promises sending a fiscal document soon** (“ti mando la fattura”, “Monday I’ll send the invoice”, “allegato seguirà”, “will forward the VAT invoice”), and (3) **no PDF (or fiscal) attachment is being analysed in this request** — i.e. **email-body-only** parse, or the instructions state the fiscal file is absent/unreadable **and** the promise refers to **that missing** document.
- When a **proper PDF/image attachment** is the primary input and constitutes the document itself, always **false** (the document already arrived).
- If there is no such promise or you are unsure, **false**.
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

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

/** Ritento brevi backoff per 429/5xx RPM; sulla quota giornaliera free-tier i ritentativi non “riaprono” il tetto — serve billing sul progetto API. */
async function invokeWithTransientRetry(run: () => Promise<GeminiResult>): Promise<GeminiResult> {
  const backoffsMs = [2500, 12_000]
  let attempt = 0
  while (true) {
    try {
      return await run()
    } catch (err: unknown) {
      const last = attempt >= backoffsMs.length
      if (!isTransientGeminiError(err) || last) {
        if (isTransientGeminiError(err)) {
          throw new GeminiTransientError(
            `${err instanceof Error ? err.message : String(err)}`,
            err,
          )
        }
        throw err instanceof Error ? err : new Error(String(err))
      }
      await sleep(backoffsMs[attempt] ?? 12_000)
      attempt++
    }
  }
}

function getModel(systemPrompt: string, maxOutputTokens: number) {
  const key = process.env.GEMINI_API_KEY?.trim()
  if (!key) throw new GeminiConfigurationError()
  const genAI = new GoogleGenerativeAI(key)
  return genAI.getGenerativeModel({
    model: getGeminiModelId(),
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
    return await invokeWithTransientRetry(async () => {
      const result = await model.generateContent(userContent)
      return {
        text: result.response.text(),
        usage: buildUsage(result.response.usageMetadata),
      }
    })
  } catch (err) {
    if (err instanceof GeminiTransientError) throw err
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
    return await invokeWithTransientRetry(async () => {
      const result = await model.generateContent([
        { inlineData: { mimeType, data: base64Data } },
        { text: textPrompt },
      ])
      return {
        text: result.response.text(),
        usage: buildUsage(result.response.usageMetadata),
      }
    })
  } catch (err) {
    if (err instanceof GeminiTransientError) throw err
    if (isTransientGeminiError(err)) {
      throw new GeminiTransientError(
        `Gemini vision (${mimeType}): ${err instanceof Error ? err.message : String(err)}`,
        err,
      )
    }
    throw err
  }
}
