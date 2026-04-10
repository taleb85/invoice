import OpenAI from 'openai'

/* ─────────────────────────────────────────────────────────────
   Interfaccia pubblica — retrocompatibile con il codice esistente.
   I campi vecchi (nome, piva, data) sono alias dei nuovi.
───────────────────────────────────────────────────────────── */
export interface OcrResult {
  /** Ragione sociale del FORNITORE (chi emette, non il destinatario) */
  ragione_sociale: string | null
  /** P.IVA senza prefisso paese, solo cifre */
  p_iva: string | null
  /** Data del documento (YYYY-MM-DD) */
  data_fattura: string | null
  /** Numero fattura / protocollo */
  numero_fattura: string | null
  /** Totale importo IVA inclusa (numero decimale) */
  totale_iva_inclusa: number | null

  // ── Alias backward-compatible ──────────────────────────────
  /** @alias ragione_sociale */
  nome: string | null
  /** @alias p_iva */
  piva: string | null
  /** @alias data_fattura */
  data: string | null
}

/** Risultato vuoto da usare come fallback sicuro */
export const EMPTY_OCR: OcrResult = {
  ragione_sociale: null, p_iva: null, data_fattura: null,
  numero_fattura: null, totale_iva_inclusa: null,
  nome: null, piva: null, data: null,
}

/** @deprecated Usa OcrResult */
export type OcrInvoiceResult = OcrResult

/* ─────────────────────────────────────────────────────────────
   Prompt — richiede JSON con 5 campi precisi.
   Istruzione esplicita: FORNITORE = chi emette (mittente),
   non il destinatario (acquirente).
───────────────────────────────────────────────────────────── */
const SYSTEM_PROMPT = `Sei un sistema di estrazione dati da documenti fiscali italiani.
Analizza il documento e restituisci SOLO JSON valido (nessun markdown, nessuna spiegazione):
{
  "ragione_sociale": "Chi EMETTE il documento (fornitore/venditore) o null",
  "p_iva": "P.IVA del fornitore senza prefisso paese, solo cifre, o null",
  "data_fattura": "Data del documento in formato YYYY-MM-DD o null",
  "numero_fattura": "Numero fattura/documento o null",
  "totale_iva_inclusa": 0.00
}
IMPORTANTE: totale_iva_inclusa deve essere un numero (es. 1234.56), non una stringa.
Se un campo non è presente nel documento, usa null.`

/* ─────────────────────────────────────────────────────────────
   Parsing robusto della risposta AI
───────────────────────────────────────────────────────────── */
function parseOcrJson(raw: string): OcrResult {
  try {
    // Rimuovi eventuali backtick markdown
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    // Estrai solo il primo oggetto JSON se ci sono caratteri extra
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) return EMPTY_OCR

    const parsed = JSON.parse(match[0])

    const ragione_sociale = parsed.ragione_sociale ?? null
    const p_iva           = parsed.p_iva ? String(parsed.p_iva).replace(/\D/g, '') || null : null
    const data_fattura    = parsed.data_fattura ?? null
    const numero_fattura  = parsed.numero_fattura ? String(parsed.numero_fattura) : null
    const rawTotale       = parsed.totale_iva_inclusa
    const totale_iva_inclusa = rawTotale !== null && rawTotale !== undefined && !isNaN(Number(rawTotale))
      ? Number(rawTotale)
      : null

    return {
      ragione_sociale, p_iva, data_fattura, numero_fattura, totale_iva_inclusa,
      // alias backward-compat
      nome: ragione_sociale, piva: p_iva, data: data_fattura,
    }
  } catch {
    return EMPTY_OCR
  }
}

/* ─────────────────────────────────────────────────────────────
   Estrazione testo da PDF (per evitare di inviare immagini grandi)
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
   Funzione principale
   Supporta:
     - PDF  → estrae testo + invia a GPT-4o-mini (text mode)
     - Image → invia via vision (gpt-4o-mini)
   Chiave API letta da OPENAI_API_KEY (variabile d'ambiente sicura).
───────────────────────────────────────────────────────────── */
export async function ocrInvoice(
  buffer: Buffer | Uint8Array,
  contentType: string
): Promise<OcrResult> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('[OCR] OPENAI_API_KEY non configurata — salto OCR')
    return EMPTY_OCR
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const buf = Buffer.from(buffer)

  // ── PDF: estrai testo, poi manda a GPT come chat ─────────────────────
  if (contentType === 'application/pdf') {
    const text = await extractPdfText(buf)
    if (!text) {
      console.warn('[OCR] PDF senza testo estraibile — salto OCR')
      return EMPTY_OCR
    }

    const snippet = text.slice(0, 4000) // Max token budget
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
      console.log('[OCR] PDF risultato:', JSON.stringify(result))
      return result
    } catch (err) {
      console.error('[OCR] Errore GPT su PDF:', err)
      return EMPTY_OCR
    }
  }

  // ── Immagini: vision ─────────────────────────────────────────────────
  const imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!imageTypes.includes(contentType)) {
    console.warn(`[OCR] Tipo non supportato: ${contentType}`)
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
    console.log('[OCR] Immagine risultato:', JSON.stringify(result))
    return result
  } catch (err) {
    console.error('[OCR] Errore GPT su immagine:', err)
    return EMPTY_OCR
  }
}
