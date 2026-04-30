import type { SupabaseClient } from '@supabase/supabase-js'
import {
  geminiGenerateVision,
  GeminiConfigurationError,
  GeminiTransientError,
} from '@/lib/gemini-vision'
import { downloadStorageObjectByFileUrl } from '@/lib/documenti-storage-url'
import { inferContentTypeFromBuffer } from '@/lib/fix-ocr-dates-helpers'

const CLASSIFY_SYSTEM = `Sei un assistente per documenti contabili italiani (ristorazione / fornitori).
Analizza il documento allegato e rispondi SOLO con un oggetto JSON valido, senza markdown, senza testo fuori dal JSON.

Chiavi obbligatorie:
- "tipo_suggerito": uno tra "fattura" | "bolla" | "ddt" | "estratto_conto" | "ordine" | "listino" | "altro"

When to choose each type — read carefully (English hints for common filenames/emails):

• Use "listino" ONLY for supplier PRICE COMMUNICATIONS (prices, catalogue lines, tariffs for products you buy). Never use "listino" for personal documents.

• NEVER use "listino" for: CV / curriculum vitae / résumé / resume, job applications, cover letters, «modulo di candidatura», recruitment, staff hiring documents — those are always "altro".

• Use "fattura" ONLY for VAT/tax invoices / proper fiscal invoices.

• Use "altro" for CVs, resumes, contracts that are not invoices, internal memos, or anything that does not match the types above.

Also in Italian:
- "listino" SOLO per comunicazioni prezzi fornitori / listini acquisto. Mai per CV, curriculum, candidature lavoro, lettere di presentazione: per quelli usa "altro".

- "fornitore_suggerito": nome leggibile sul documento, oppure null
- "azione_consigliata": breve frase (italiano ok)
- "confidenza": numero tra 0 e 1

Se il file non è leggibile: tipo_suggerito "altro", fornitore_suggerito null, confidenza bassa.`

/** Strong signals this is a CV / job application — must not be coerced or left as listino. */
const CV_OR_JOB_APPLICATION_HINT =
  /\.cv[\._]|_[\._]cv\b|\bcv\s*[_\.\-]?\s*\d|curriculum\s*vitae|\bcurriculum\b|résumé|\bresume\b|modulo\s+di\s+candidatura|candidatura\s+di\s+lavoro|job\s*application|lettera\s+(di\s+)?(presentazione|motivazione)|domanda\s+di\s+impiego|employment\s+application|application\s+for\s+(the\s+)?position/i

/** Filename / caption signals (EN+IT): supplier price communiques often mis-labelled as altro. */
const LISTINO_PRICE_DOC_HINT =
  /price\s*update|price\s*list|pricelist|price\s*sheet|\bpricing\b|new\s*prices?|supplier\s+(price|prices|list)|listino|aggiornam\w*\s*(prezzi|tariffe)|tariff(ar)?io|riferimento\s+prezzi|articoli\s*[&+]?\s*prices?/iu

export function coerceListinoFromSignals(
  fileName: string | null | undefined,
  tipo_raw: string,
  confidenza: number,
  azione_consigliata: string,
): { tipo_suggerito: string; confidenza: number } {
  const tipo = (tipo_raw || 'altro').toLowerCase().trim()
  const blobCheck = `${fileName ?? ''}\n${azione_consigliata ?? ''}`

  /** CV / recruitment: never treat as supplier price list. */
  if (CV_OR_JOB_APPLICATION_HINT.test(blobCheck)) {
    return { tipo_suggerito: 'altro', confidenza: Math.min(confidenza, 0.92) }
  }

  if (tipo === 'listino') {
    return { tipo_suggerito: 'listino', confidenza }
  }

  const blob = `${fileName ?? ''}\n${azione_consigliata ?? ''}`
  if (LISTINO_PRICE_DOC_HINT.test(blob) && tipo === 'altro') {
    return {
      tipo_suggerito: 'listino',
      confidenza: Math.min(1, Math.max(confidenza, 0.93)),
    }
  }
  return { tipo_suggerito: tipo_raw || 'altro', confidenza }
}

function parseJsonObject(raw: string): Record<string, unknown> {
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  const slice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned
  return JSON.parse(slice) as Record<string, unknown>
}

export type GeminiInboxClassification = {
  doc_id: string
  tipo_suggerito: string
  fornitore_suggerito: string | null
  azione_consigliata: string
  confidenza: number
  error?: string
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

export async function classifyDocumentWithGemini(
  service: SupabaseClient,
  row: {
    id: string
    file_url: string | null
    file_name?: string | null
    content_type?: string | null
  },
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

  const base64 = data.toString('base64')
  const userPrompt =
    `Nome file: ${row.file_name ?? 'sconosciuto'}\n\n` +
    `RULES:\n` +
    `- NEVER use tipo_suggerito "listino" for a CV, curriculum vitae, résumé / resume, job application or hiring paper — those must be "altro".\n` +
    `- Use "listino" only for supplier PRICE communications (e.g. "Price Update", price list with products/prices for purchasing).\n` +
    `Return only the requested JSON.`

  try {
    const { text } = await geminiGenerateVision(CLASSIFY_SYSTEM, mime, base64, userPrompt, 700)
    const obj = parseJsonObject(text)
    const tipoRaw = strOrNull(obj.tipo_suggerito) ?? 'altro'
    const confRaw = clamp01(obj.confidenza)
    const azione = strOrNull(obj.azione_consigliata) ?? '—'

    const coerced = coerceListinoFromSignals(row.file_name, tipoRaw, confRaw, azione)
    return {
      doc_id: row.id,
      tipo_suggerito: coerced.tipo_suggerito,
      fornitore_suggerito: strOrNull(obj.fornitore_suggerito),
      azione_consigliata: azione,
      confidenza: clamp01(coerced.confidenza),
    }
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
