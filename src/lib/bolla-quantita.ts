import { normalizeTipoDocumento } from '@/lib/ocr-tipo-documento'

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
  const q = ocr.quantita_totale
  if (q == null || !Number.isFinite(Number(q))) return null
  const n = Number(q)
  return n >= 0 ? Math.round(n * 1000) / 1000 : null
}

/** Fallback when OCR JSON omits quantita_totale: sum Pack/Qty from delivery-note PDF text. */
export function sumDeliveryNoteQuantitaFromText(text: string | null | undefined): number | null {
  if (!text?.trim()) return null
  if (
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
  for (const m of text.matchAll(/\s(\d+(?:[.,]\d+)?)\s+(?:Case|Each)\b/gi)) {
    add(m[1]!)
  }
  for (const m of text.matchAll(/\s(\d+(?:[.,]\d+)?)\s+\d+(?:[.,]\d+)?\s+KG\b/gi)) {
    add(m[1]!)
  }
  return any ? Math.round(sum * 1000) / 1000 : null
}

export function quantitaForBollaFromOcrOrText(
  ocr: { tipo_documento?: unknown; quantita_totale?: number | null },
  extractedText?: string | null,
): number | null {
  return quantitaForBollaFromOcr(ocr) ?? sumDeliveryNoteQuantitaFromText(extractedText)
}

export function formatBollaQuantita(
  quantita: number | null | undefined,
  locale: string,
): string {
  if (quantita == null || !Number.isFinite(quantita)) return '—'
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(quantita)
}
