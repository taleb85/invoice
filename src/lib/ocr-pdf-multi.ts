/**
 * Rilevamento di più documenti fiscali distinti nello stesso PDF (es. Eden Springs UK:
 * estratto conto + fattura riepilogativa nello stesso file).
 */
import { SchemaType } from '@google/generative-ai'
import {
  geminiGenerateVision,
  DOCUMENT_EXTRACTION_PROMPT,
  type GeminiUsage,
} from '@/lib/gemini-vision'
import { normalizeNumeroBolla } from '@/lib/fix-ocr-dates-helpers'
import { normalizeTipoDocumento, type NormalizedTipoDocumento } from '@/lib/ocr-tipo-documento'
import { safeDate } from '@/lib/safe-date'
import { logger } from '@/lib/logger'

/** Minimo pagine per attivare la passata multi-documento (2 = estratto+fattura su 2 pagine, es. Eden Springs). */
export const PDF_MULTI_DETECT_MIN_PAGES = 2

const TIPO_ENUM = [
  'fattura',
  'nota_credito',
  'bolla_ddt',
  'ordine',
  'estratto_conto',
  'comunicazione',
  null,
] as const

export const OCR_PDF_MULTI_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    pdf_multiplo: { type: SchemaType.BOOLEAN },
    documenti: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          pagina_inizio: { type: SchemaType.INTEGER, nullable: true },
          pagina_fine: { type: SchemaType.INTEGER, nullable: true },
          tipo_documento: {
            type: SchemaType.STRING,
            nullable: true,
            enum: [...TIPO_ENUM],
          },
          ragione_sociale: { type: SchemaType.STRING, nullable: true },
          numero_documento: { type: SchemaType.STRING, nullable: true },
          /** true se numero_documento è Account No. / Customer ref, NON un Invoice No. */
          numero_e_account_no: { type: SchemaType.BOOLEAN, nullable: true },
          data_fattura: { type: SchemaType.STRING, nullable: true },
          totale_iva_inclusa: { type: SchemaType.NUMBER, nullable: true },
        },
        required: ['tipo_documento', 'pagina_inizio', 'pagina_fine', 'numero_documento', 'numero_e_account_no'],
      },
    },
  },
  required: ['pdf_multiplo', 'documenti'],
}

export type OcrPdfSegment = {
  pagina_inizio: number | null
  pagina_fine: number | null
  tipo_documento: NormalizedTipoDocumento
  ragione_sociale: string | null
  numero_fattura: string | null
  data_fattura: string | null
  totale_iva_inclusa: number | null
  /** Numero estratto ma marcato come Account No. (non usare come fattura). */
  numero_e_account_no: boolean
}

export type OcrPdfMultiDetectResult = {
  pdf_multiplo: boolean
  segmenti: OcrPdfSegment[]
}

const PDF_MULTI_SYSTEM = `You detect whether ONE PDF file contains TWO OR MORE separate fiscal/commercial documents (not just multiple pages of the same invoice).

Common UK supplier pattern (Eden Springs, Brakes, etc.): same PDF bundles an **account statement** (tabular movements, "Account No.", "Statement") AND a separate **tax invoice** or **self-billing invoice** section with its own title and VAT lines.

Rules:
- **pdf_multiplo** = true only when there are clearly separate documents with different primary titles/layouts (e.g. statement table + invoice page). A single tax invoice spanning 3–4 pages is NOT multiplo — return pdf_multiplo false and a single item in documenti.
- Each item in documenti: consecutive page range, one tipo_documento, one reference number.
- **numero_e_account_no**: set true when numero_documento comes from "Account No.", "A/C No.", "Customer account", "Account number" — NOT from "Invoice No.", "Tax Invoice", "Self-billing invoice", "Credit note".
- Never duplicate the same physical document twice. Merge consecutive pages of the same type into one segment.
- tipo_documento: exactly one token: fattura | nota_credito | bolla_ddt | ordine | estratto_conto | comunicazione | null
- If a tax invoice section cites an order number, that segment stays **fattura**, do not add a separate **ordine** segment for the cited PO only.

${DOCUMENT_EXTRACTION_PROMPT}

Return ONLY valid JSON matching the schema.`

function parseSegment(raw: Record<string, unknown>): OcrPdfSegment | null {
  const tipo = normalizeTipoDocumento(raw.tipo_documento)
  if (!tipo) return null

  const pagina_inizio =
    typeof raw.pagina_inizio === 'number' && Number.isFinite(raw.pagina_inizio)
      ? Math.max(1, Math.floor(raw.pagina_inizio))
      : null
  const pagina_fine =
    typeof raw.pagina_fine === 'number' && Number.isFinite(raw.pagina_fine)
      ? Math.max(1, Math.floor(raw.pagina_fine))
      : null

  const isAccount = raw.numero_e_account_no === true
  const numRaw =
    typeof raw.numero_documento === 'string' && raw.numero_documento.trim()
      ? raw.numero_documento.trim()
      : null
  const numero_fattura =
    isAccount || !numRaw ? null : normalizeNumeroBolla(numRaw)

  const dataRaw = raw.data_fattura
  const dataStr =
    dataRaw == null || dataRaw === ''
      ? ''
      : (typeof dataRaw === 'string' ? dataRaw : String(dataRaw)).trim()
  const data_fattura = dataStr ? safeDate(dataStr) : null

  const totRaw = raw.totale_iva_inclusa
  const totale_iva_inclusa =
    typeof totRaw === 'number' && Number.isFinite(totRaw) ? totRaw : null

  const ragione_sociale =
    typeof raw.ragione_sociale === 'string' && raw.ragione_sociale.trim()
      ? raw.ragione_sociale.trim()
      : null

  return {
    pagina_inizio,
    pagina_fine,
    tipo_documento: tipo,
    ragione_sociale,
    numero_fattura,
    data_fattura,
    totale_iva_inclusa,
    numero_e_account_no: isAccount,
  }
}

function parseMultiJson(text: string): OcrPdfMultiDetectResult {
  const empty: OcrPdfMultiDetectResult = { pdf_multiplo: false, segmenti: [] }
  if (!text?.trim()) return empty
  try {
    const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) return empty
    const parsed = JSON.parse(match[0]) as Record<string, unknown>
    const pdf_multiplo = parsed.pdf_multiplo === true
    const arr = Array.isArray(parsed.documenti) ? parsed.documenti : []
    const segmenti = arr
      .map((item) => parseSegment(item as Record<string, unknown>))
      .filter((s): s is OcrPdfSegment => s != null)
    if (!pdf_multiplo || segmenti.length < 2) {
      return { pdf_multiplo: false, segmenti: [] }
    }
    return { pdf_multiplo: true, segmenti }
  } catch (e) {
    logger.warn('[OCR-PDF-MULTI] JSON parse failed:', e instanceof Error ? e.message : e)
    return empty
  }
}

export type DetectPdfMultiOptions = {
  pageCount: number | null
  languageHint?: string
  emailBodyText?: string | null
  fileLabel?: string
  onUsage?: (usage: GeminiUsage) => void
}

/**
 * Seconda passata vision solo per PDF con abbastanza pagine: elenca segmenti distinti.
 */
export async function detectPdfMultiSegments(
  pdfBuffer: Buffer,
  options: DetectPdfMultiOptions,
): Promise<OcrPdfMultiDetectResult> {
  const pages = options.pageCount ?? 0
  if (pages < PDF_MULTI_DETECT_MIN_PAGES) {
    return { pdf_multiplo: false, segmenti: [] }
  }

  const hint = options.languageHint
    ? `\nDocument language hint: ${options.languageHint.toUpperCase()}.`
    : ''
  const body = options.emailBodyText?.trim()
    ? `\n\nEmail context (may mention statement vs invoice):\n${options.emailBodyText.slice(0, 4000)}`
    : ''

  const userPrompt =
    `This PDF has ${pages} pages. List every DISTINCT fiscal document in page order.${hint}${body}\n` +
    `File: ${options.fileLabel ?? 'attachment.pdf'}`

  const base64 = pdfBuffer.toString('base64')
  const res = await geminiGenerateVision(
    PDF_MULTI_SYSTEM,
    'application/pdf',
    base64,
    userPrompt,
    1200,
    { responseSchema: OCR_PDF_MULTI_SCHEMA },
  )
  options.onUsage?.(res.usage)
  return parseMultiJson(res.text)
}

/** UK account refs (Eden Springs): 9-digit numerics often mis-read as invoice numbers. */
export function numeroLooksLikeUkAccountReference(numero: string | null | undefined): boolean {
  const n = numero?.trim()
  if (!n) return false
  return /^\d{8,10}$/.test(n.replace(/\s/g, ''))
}

/**
 * Se l'OCR principale ha messo l'Account No. in numero_fattura, preferisci il numero
 * del segmento fattura/nota_credito quando presente.
 */
export function mergePrimaryOcrWithPdfSegments(
  primary: {
    tipo_documento: NormalizedTipoDocumento
    numero_fattura: string | null
    data_fattura: string | null
    totale_iva_inclusa: number | null
    ragione_sociale: string | null
  },
  multi: OcrPdfMultiDetectResult,
): {
  tipo_documento: NormalizedTipoDocumento
  numero_fattura: string | null
  data_fattura: string | null
  totale_iva_inclusa: number | null
  ragione_sociale: string | null
  segmenti_pdf: OcrPdfSegment[]
} {
  if (!multi.pdf_multiplo || multi.segmenti.length < 1) {
    return { ...primary, segmenti_pdf: [] }
  }

  const segmenti_pdf = multi.segmenti
  let { tipo_documento, numero_fattura, data_fattura, totale_iva_inclusa, ragione_sociale } = primary

  const fiscalSegs = segmenti_pdf.filter(
    (s) =>
      s.tipo_documento === 'fattura' ||
      s.tipo_documento === 'nota_credito' ||
      s.tipo_documento === 'bolla_ddt',
  )
  const stmtSeg = segmenti_pdf.find((s) => s.tipo_documento === 'estratto_conto')
  const invSeg =
    fiscalSegs.find((s) => s.tipo_documento === 'fattura' && s.numero_fattura) ??
    fiscalSegs.find((s) => s.numero_fattura && !s.numero_e_account_no)

  const primaryNumIsAccount =
    numeroLooksLikeUkAccountReference(numero_fattura) ||
    (stmtSeg != null && invSeg != null && tipo_documento === 'fattura')

  if (segmenti_pdf.length === 1 && invSeg?.numero_fattura && primaryNumIsAccount) {
    return {
      tipo_documento: invSeg.tipo_documento === 'fattura' ? 'fattura' : tipo_documento,
      numero_fattura: invSeg.numero_fattura,
      data_fattura: invSeg.data_fattura ?? data_fattura,
      totale_iva_inclusa: invSeg.totale_iva_inclusa ?? totale_iva_inclusa,
      ragione_sociale: invSeg.ragione_sociale ?? ragione_sociale,
      segmenti_pdf,
    }
  }

  if (segmenti_pdf.length < 2) {
    return { ...primary, segmenti_pdf }
  }

  if (stmtSeg && invSeg) {
    tipo_documento = 'estratto_conto'
    numero_fattura = null
    if (stmtSeg.data_fattura) data_fattura = stmtSeg.data_fattura
    if (stmtSeg.ragione_sociale && !ragione_sociale) ragione_sociale = stmtSeg.ragione_sociale
  } else if (invSeg?.numero_fattura && (primaryNumIsAccount || !numero_fattura)) {
    numero_fattura = invSeg.numero_fattura
    if (invSeg.tipo_documento === 'fattura') tipo_documento = 'fattura'
    if (invSeg.data_fattura && !data_fattura) data_fattura = invSeg.data_fattura
    if (invSeg.totale_iva_inclusa != null && totale_iva_inclusa == null) {
      totale_iva_inclusa = invSeg.totale_iva_inclusa
    }
    if (invSeg.ragione_sociale && !ragione_sociale) ragione_sociale = invSeg.ragione_sociale
  } else if (stmtSeg && tipo_documento === 'fattura' && primaryNumIsAccount) {
    tipo_documento = 'estratto_conto'
    numero_fattura = null
  }

  return {
    tipo_documento,
    numero_fattura,
    data_fattura,
    totale_iva_inclusa,
    ragione_sociale,
    segmenti_pdf,
  }
}

/** Segmenti da registrare in coda oltre al documento principale (stesso file_url). */
export function fiscalSegmentsBeyondPrimary(
  segmenti: OcrPdfSegment[],
  primaryTipo: NormalizedTipoDocumento,
  primaryNumero: string | null,
): OcrPdfSegment[] {
  return segmenti.filter((s) => {
    if (s.tipo_documento === 'comunicazione' || s.tipo_documento === null) return false
    if (s.tipo_documento === primaryTipo && s.numero_fattura === primaryNumero) return false
    if (s.tipo_documento === 'estratto_conto') return false
    if (s.numero_e_account_no || !s.numero_fattura) return false
    return true
  })
}
