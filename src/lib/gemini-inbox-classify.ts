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
- "tipo_suggerito": uno tra "fattura" | "bolla" | "ddt" | "estratto_conto" | "ordine" | "altro"
- "fornitore_suggerito": stringa con il nome fornitore leggibile dal documento, oppure null se assente
- "azione_consigliata": una frase breve in italiano (es. "Registrare come fattura e collegare alla bolla esistente")
- "confidenza": numero tra 0 e 1 (sicurezza della classificazione)
Se il file non è leggibile, usa tipo_suggerito "altro", fornitore_suggerito null, confidenza bassa.`

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
  const userPrompt = `Nome file: ${row.file_name ?? 'sconosciuto'}. Classifica il documento e restituisci il JSON richiesto.`

  try {
    const { text } = await geminiGenerateVision(CLASSIFY_SYSTEM, mime, base64, userPrompt, 700)
    const obj = parseJsonObject(text)
    const tipo = strOrNull(obj.tipo_suggerito) ?? 'altro'
    return {
      doc_id: row.id,
      tipo_suggerito: tipo,
      fornitore_suggerito: strOrNull(obj.fornitore_suggerito),
      azione_consigliata: strOrNull(obj.azione_consigliata) ?? '—',
      confidenza: clamp01(obj.confidenza),
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
