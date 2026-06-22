/**
 * Gemini 2.5 Flash-Lite vision / text: OCR fatture, DDT, estratti, listini.
 *
 * Supports both text-only and multimodal (image + PDF) calls.
 * Gemini handles PDFs natively — no rasterization or Files API needed.
 *
 * Supporta Structured Output (responseSchema) per garantire JSON valido al 100%.
 */
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'

/** Modello OCR predefinito (override con `GEMINI_MODEL` nell'env). */
export const GEMINI_MODEL = 'gemini-2.5-flash-lite' as const

/** Id effettivamente usato dall'SDK (rileva `.env`). */
export function getGeminiModelId(): string {
  const o = process.env.GEMINI_MODEL?.trim()
  return o || GEMINI_MODEL
}

/**
 * Cost per 1M tokens (USD) — Gemini 2.5 Flash-Lite.
 * Sovrascrivibile via env:
 *   GEMINI_INPUT_PRICE   (default 0.075)
 *   GEMINI_OUTPUT_PRICE  (default 0.30)
 */
export function getGeminiPricing(): { inputPerMillion: number; outputPerMillion: number } {
  const input = Number(process.env.GEMINI_INPUT_PRICE?.trim()) || 0.075
  const output = Number(process.env.GEMINI_OUTPUT_PRICE?.trim()) || 0.30
  return { inputPerMillion: input, outputPerMillion: output }
}

export const GEMINI_PRICING = getGeminiPricing()

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
- Multi-tenant SaaS: the **restaurant / venue that receives invoices** may appear very large (bill-to, logo, "deliver to"). A runtime list **IGNORE_AS_SUPPLIER** in the assembled system prompt lists **buyer-only** legal names for this deployment — **never** put those in ragione_sociale; if the only prominent name matches that list, extract the **issuer** from Cedente/Prestatore, From, Emittente, Seller, or the **upper-right** fiscal block.

TIPO DOCUMENTO (field tipo_documento):
- Return exactly one of these lower-case tokens (or null if unreadable): fattura | nota_credito | bolla_ddt | ordine | estratto_conto | comunicazione
- **fattura** — The document is a **tax/commercial invoice** when you see a **fiscal layout**: **taxable base (imponibile)**, **VAT / IVA / tax rows** (rates, amounts, or columns), **payment terms or due dates (scadenze / scadenzario / payment due / Fälligkeit)**, and/or a clear **invoice / Rechnung / Fattura** number in a fiscal context. Headings like Tax invoice, VAT invoice, Fattura, Factura fiscal, Rechnung with Mehrwertsteuer/USt. **Never choose bolla_ddt** when these fiscal elements dominate. UK "Self-billing" or "Remittance" blocks still mean fattura if a VAT/invoice number and fiscal total are present.
- **nota_credito** — credit note, note de crédit, Gutschrift, Avoir: a document issued by the seller that reduces a prior invoice amount. Classify as nota_credito (not fattura, not bolla_ddt) even if the layout is similar to an invoice or a DDT/delivery note.
  - Strong textual cues anywhere in the heading, footer, or main title: **"credit note", "credit memo", "credit invoice", "nota di credito", "nota credito", "note de crédit", "avoir", "Gutschrift", "Storno", "rectificative"**.
  - **Returns / refunds / negative DDT**: documents titled **"Return note", "Returns note", "Return form", "Goods return", "Return / Restituzione merce", "Reso merce", "RMA"** that show **goods being sent BACK to the supplier** (negative quantities, "credit to be issued", "to be credited", "qta resa", "returned qty") MUST be classified as **nota_credito** — not bolla_ddt — because they represent a credit, not a forward delivery.
  - **Document number prefixes commonly used for credit notes / returns**: numbers starting with **RTN, RET, RTV, RGA, RMA, NC, CN, CRN, CR-** (e.g. "RTN108331", "RET-2026/123", "CN-4567") are a strong hint for nota_credito. Combine the prefix hint with any of the textual cues above before deciding; if both prefix and textual cue agree → nota_credito.
  - Negative totals or "to be credited / a credito" wording near the grand total ⇒ nota_credito.
- **bolla_ddt** — **Transport / delivery first**: classify when the dominant content is **logistics in the OUTBOUND direction** (supplier → customer), not a full tax invoice: **packages / colli / cartons**, **carriers / vettori / tracking / vehicle**, **causale di trasporto / reason for transport / Incoterms-style dispatch**, DDT, Documento di Trasporto, Delivery note, Lieferschein, Albarán, Bon de livraison, **without** the full invoice structure (imponibile + IVA + scadenze) on the same primary view. If a page mixes DDT blocks with a clear **invoice** section, prefer **fattura**. A titled **sales invoice with VAT lines** is always **fattura**, never bolla_ddt. **Never** classify as bolla_ddt when the document is a **return / refund / credit memo** moving goods *back* to the supplier, or when the title/number prefix matches the **nota_credito** cues above — that case is **nota_credito**.
- **estratto_conto** — **Account / banking statement**: tabular **list of movements** (debits/credits, saldo porta/saldo finale, unpaid invoices listed as open items), **bank or supplier statement** wording (Estratto conto, Account statement, Statement of account, Kontoauszug, Relevé). Not a single-invoice fiscal layout (that remains **fattura**). Also use for quotes, price lists, packing lists, or non-fiscal PDFs that are not CVs and not conversational messages.
- **ordine** — primarily an **order** document (PO, Ordine), not yet a dispatched DDT nor a finalized tax invoice.
- **comunicazione** — use when the analysed content is **only conversational email-style text** from the supplier/customer (thanks, appointments, generic updates, scheduling, CVs / résumés) **with no usable fiscal datapoints**: no totals with tax context, no DDT/colli blocks, no bank movement tables. Typical when there is **no PDF attachment** and the body has no invoice/DDT numbers or amounts to extract. Do **not** use for PDFs that are formal documents.
- If more than one label could apply, use the document's **largest, topmost official title** and the **dominant structural cues** (fiscal invoice vs logistics vs ledger table).
- **Critical:** If the first page shows **VAT/tax rows + invoice-style totals + due dates**, that is **fattura**, not bolla_ddt — even if the word "delivery" appears somewhere.

Separate JSON boolean field **promessa_invio_documento** (always present in the response object; callers merge it with main schema):
- Set **true** only when **all** apply: (1) an **email body / message** is in context, (2) the text clearly **promises sending a fiscal document soon** ("ti mando la fattura", "Monday I'll send the invoice", "allegato seguirà", "will forward the VAT invoice"), and (3) **no PDF (or fiscal) attachment is being analysed in this request** — i.e. **email-body-only** parse, or the instructions state the fiscal file is absent/unreadable **and** the promise refers to **that missing** document.
- When a **proper PDF/image attachment** is the primary input and constitutes the document itself, always **false** (the document already arrived).
- If there is no such promise or you are unsure, **false**.

INVOICE NUMBER (field numero_fattura):
- Extract the document number that the issuer assigned to this document. Look for labels such as **"Invoice No."**, **"Fattura n."**, **"N. fattura"**, **"Document number"**, **"N. documento"**, **"Numero"**, **"N°"**, **"Invoice #"**, **"Rechnung Nr."**, **"Facture n°"**, **"N. Fattura / Invoice No."**, **"Document Reference"**, **"Our ref"**, **"Reference"** in a fiscal/invoice context.
- The number is typically placed near the top of the document, next to or below the document title/header.
- Include **all characters** of the number including letters and dashes (e.g. "INV-2026-0123", "HIL-45678", "S1709514", "168125", "RTN108331").
- If no invoice-style number is found but the document has a **delivery note number** (DDT n., DN, delivery note number) use that instead.
- If no document number can be identified at all, return null. Do **not** use the supplier's VAT number, customer reference, order number, or any internal ID as the invoice number.
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

/** Ritento brevi backoff per 429/5xx RPM; sulla quota giornaliera free-tier i ritentativi non "riaprono" il tetto — serve billing sul progetto API. */
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
  const p = getGeminiPricing()
  const cost =
    (input / 1_000_000) * p.inputPerMillion +
    (output / 1_000_000) * p.outputPerMillion
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

/**
 * JSON Schema per OcrResult (fatture, DDT, email body).
 * Definisce la struttura esatta che Gemini deve restituire con Structured Output.
 */
export const OCR_INVOICE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    ragione_sociale: { type: SchemaType.STRING, nullable: true },
    p_iva: { type: SchemaType.STRING, nullable: true },
    indirizzo: { type: SchemaType.STRING, nullable: true },
    data_fattura: { type: SchemaType.STRING, nullable: true },
    numero_fattura: { type: SchemaType.STRING, nullable: true },
    tipo_documento: {
      type: SchemaType.STRING,
      nullable: true,
      enum: ['fattura', 'nota_credito', 'bolla_ddt', 'ordine', 'estratto_conto', 'comunicazione', null],
    },
    promessa_invio_documento: { type: SchemaType.BOOLEAN, nullable: true },
    totale_iva_inclusa: { type: SchemaType.NUMBER, nullable: true },
    quantita_totale: { type: SchemaType.NUMBER, nullable: true },
    data_ordine: { type: SchemaType.STRING, nullable: true },
    note_corpo_mail: { type: SchemaType.STRING, nullable: true },
    estrazione_utile: { type: SchemaType.BOOLEAN, nullable: true },
    importo_raw: { type: SchemaType.STRING, nullable: true },
    formato_importo: { type: SchemaType.STRING, nullable: true, enum: ['dot', 'comma', 'plain', null] },
    ocr_cliente_estratto_come_fornitore: { type: SchemaType.BOOLEAN, nullable: true },
  },
  required: ['ragione_sociale', 'p_iva', 'indirizzo', 'data_fattura', 'numero_fattura', 'tipo_documento', 'promessa_invio_documento', 'totale_iva_inclusa'],
}

type SchemaConfig = {
  responseSchema?: Record<string, unknown>
  responseMimeType?: 'application/json' | 'text/plain'
}

function getModel(systemPrompt: string, maxOutputTokens: number, schema?: SchemaConfig) {
  const key = process.env.GEMINI_API_KEY?.trim()
  if (!key) throw new GeminiConfigurationError()
  const genAI = new GoogleGenerativeAI(key)
  const generationConfig: Record<string, unknown> = { maxOutputTokens, temperature: 0 }
  if (schema?.responseSchema) {
    generationConfig.responseMimeType = schema.responseMimeType ?? 'application/json'
    generationConfig.responseSchema = schema.responseSchema
  }
  return genAI.getGenerativeModel({
    model: getGeminiModelId(),
    systemInstruction: systemPrompt,
    generationConfig,
  })
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Text-only generation: for PDFs with embedded text, email bodies, plain-text inputs.
 * Se viene fornito `responseSchema`, Gemini restituisce JSON strutturato valido al 100%.
 */
export async function geminiGenerateText(
  systemPrompt: string,
  userContent: string,
  maxOutputTokens = 600,
  schema?: SchemaConfig,
): Promise<GeminiResult> {
  const model = getModel(systemPrompt, maxOutputTokens, schema)
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
 * Se viene fornito `responseSchema`, Gemini restituisce JSON strutturato valido al 100%.
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
  schema?: SchemaConfig,
): Promise<GeminiResult> {
  const model = getModel(systemPrompt, maxOutputTokens, schema)
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
