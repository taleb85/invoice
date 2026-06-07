import { normalizeTipoDocumento } from '@/lib/ocr-tipo-documento'
import { numeroLooksLikeSalesDeliveryNoteReference } from '@/lib/sales-delivery-note-reference'

export type BollaQuantitaExtractContext = {
  /** Numero già salvato sulla bolla (es. SDN662860). */
  numeroBolla?: string | null
}

function parseQuantitaNumber(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 1000) / 1000
}

function isKnownDeliveryNoteContext(
  ocr: { tipo_documento?: unknown; numero_fattura?: string | null },
  extractedText?: string | null,
  ctx?: BollaQuantitaExtractContext,
): boolean {
  const num = ctx?.numeroBolla?.trim() || (ocr.numero_fattura ?? '').trim()
  if (numeroLooksLikeSalesDeliveryNoteReference(num)) return true
  if (normalizeTipoDocumento(ocr.tipo_documento) === 'bolla_ddt') return true
  if (extractedText && /\b(?:sales delivery note|delivery note)\b/i.test(extractedText)) return true
  return false
}

export function quantitaFromDocMetadata(metadata: unknown): number | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const m = metadata as Record<string, unknown>
  const raw = m.quantita_totale
  if (raw != null && Number.isFinite(Number(raw))) {
    const n = Number(raw)
    return n >= 0 ? n : null
  }
  const lines = m.rekki_lines
  if (!Array.isArray(lines) || !lines.length) return null
  let sum = 0
  let any = false
  for (const line of lines) {
    if (!line || typeof line !== 'object') continue
    const q = (line as { quantita?: unknown }).quantita
    if (q != null && Number.isFinite(Number(q)) && Number(q) >= 0) {
      sum += Number(q)
      any = true
    }
  }
  return any ? Math.round(sum * 1000) / 1000 : null
}

export function quantitaForBollaFromOcr(ocr: {
  tipo_documento?: unknown
  quantita_totale?: number | null
}): number | null {
  const tipo = normalizeTipoDocumento(ocr.tipo_documento)
  if (tipo != null && tipo !== 'bolla_ddt') return null
  return parseQuantitaNumber(ocr.quantita_totale)
}

/** Fallback when OCR JSON omits quantita_totale: sum Pack/Qty from delivery-note PDF text. */
export function sumDeliveryNoteQuantitaFromText(
  text: string | null | undefined,
  opts?: { relaxed?: boolean },
): number | null {
  if (!text?.trim()) return null
  const relaxed = opts?.relaxed === true
  if (
    !relaxed &&
    !/\b(?:delivery note|sales delivery note|lieferschein|ddt|albar[aá]n|bon de livraison)\b/i.test(
      text,
    )
  ) {
    return null
  }
  let sum = 0
  let any = false
  const add = (raw: string) => {
    const n = parseFloat(raw.replace(',', '.'))
    if (Number.isFinite(n) && n > 0) {
      sum += n
      any = true
    }
  }
  for (const m of text.matchAll(/\s(\d+(?:[.,]\d+)?)\s+(?:Case|Each|Pack)\b/gi)) {
    add(m[1]!)
  }
  for (const m of text.matchAll(/\s(\d+(?:[.,]\d+)?)\s+\d+(?:[.,]\d+)?\s+KG\b/gi)) {
    add(m[1]!)
  }
  return any ? Math.round(sum * 1000) / 1000 : null
}

export function quantitaForBollaFromOcrOrText(
  ocr: {
    tipo_documento?: unknown
    quantita_totale?: number | null
    numero_fattura?: string | null
  },
  extractedText?: string | null,
  ctx?: BollaQuantitaExtractContext,
): number | null {
  const fromStrict = quantitaForBollaFromOcr(ocr)
  if (fromStrict != null) return fromStrict

  if (!isKnownDeliveryNoteContext(ocr, extractedText, ctx)) return null

  const fromOcrField = parseQuantitaNumber(ocr.quantita_totale)
  if (fromOcrField != null) return fromOcrField

  return sumDeliveryNoteQuantitaFromText(extractedText, { relaxed: true })
}

export function formatBollaQuantita(
  quantita: number | null | undefined,
  locale: string,
): string {
  if (quantita == null || !Number.isFinite(quantita)) return '—'
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(quantita)
}
