import { parseAnyAmount } from '@/lib/ocr-amount'

export type ConfermaOrdineRigaImporto = {
  quantita?: number | null
  prezzo_unitario?: number | null
  importo_linea?: number | null
}

function lineImporto(r: ConfermaOrdineRigaImporto): number | null {
  if (typeof r.importo_linea === 'number' && Number.isFinite(r.importo_linea)) {
    return r.importo_linea
  }
  const q = typeof r.quantita === 'number' && Number.isFinite(r.quantita) ? r.quantita : null
  const p =
    typeof r.prezzo_unitario === 'number' && Number.isFinite(r.prezzo_unitario)
      ? r.prezzo_unitario
      : null
  if (q != null && p != null) return Math.round(q * p * 100) / 100
  return null
}

/** Somma righe prodotto (Rekki / jsonb `righe`). */
export function sumConfermaOrdineRigheImporto(righe: unknown): number | null {
  if (!Array.isArray(righe) || righe.length === 0) return null
  let total = 0
  let found = false
  for (const raw of righe) {
    if (!raw || typeof raw !== 'object') continue
    const v = lineImporto(raw as ConfermaOrdineRigaImporto)
    if (v != null) {
      total += v
      found = true
    }
  }
  return found ? Math.round(total * 100) / 100 : null
}

function parseAmountToken(raw: string | undefined): number | null {
  if (!raw?.trim()) return null
  const p = parseAnyAmount(raw.replace(/\s/g, ''))
  if (p == null || !Number.isFinite(p) || p <= 0) return null
  return Math.round(p * 100) / 100
}

/**
 * Totale ordine da testo PDF/email (etichette «Grand Total», «Order Total», ecc.).
 */
export function extractOrderTotalFromLabelledText(text: string): number | null {
  if (!text?.trim()) return null
  const normalized = text.replace(/\r\n/g, '\n')
  const labeled: Array<{ re: RegExp; rank: number }> = [
    { re: /\bgrand\s+total\b[^0-9£€$]{0,48}[£€$]?\s*([\d][\d.,\s]*)/gi, rank: 5 },
    { re: /\border\s+total\b[^0-9£€$]{0,48}[£€$]?\s*([\d][\d.,\s]*)/gi, rank: 4 },
    { re: /\b(?:totale|importo)\s+(?:ordine|documento)\b[^0-9£€$]{0,48}[£€$]?\s*([\d][\d.,\s]*)/gi, rank: 4 },
    { re: /\bnet\s+total\b[^0-9£€$]{0,48}[£€$]?\s*([\d][\d.,\s]*)/gi, rank: 3 },
    { re: /\btotal\s+(?:amount|value|due|gbp|eur)\b[^0-9£€$]{0,48}[£€$]?\s*([\d][\d.,\s]*)/gi, rank: 3 },
    { re: /\btotal\b(?!\s*(?:qty|quantity|units))\b[^0-9£€$]{0,36}[£€$]?\s*([\d][\d.,\s]*)/gi, rank: 2 },
  ]
  let best: { rank: number; value: number } | null = null
  for (const { re, rank } of labeled) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(normalized)) !== null) {
      const lineStart = normalized.lastIndexOf('\n', m.index) + 1
      const lineEnd = normalized.indexOf('\n', m.index + 1)
      const line = normalized.slice(lineStart, lineEnd < 0 ? undefined : lineEnd)
      if (/\bsub\s*-?\s*total\b/i.test(line) && !/\bgrand\b/i.test(line)) continue
      const v = parseAmountToken(m[1])
      if (v == null) continue
      if (!best || rank > best.rank || (rank === best.rank && v > best.value)) {
        best = { rank, value: v }
      }
    }
  }
  return best?.value ?? null
}

/** Totale da risultato OCR + testo allegato (PDF/email). */
export function importoTotaleFromOcrResult(
  ocr: { totale_iva_inclusa?: number | null; importo_raw?: string | null },
  contextText?: string | null,
): number | null {
  if (ocr.totale_iva_inclusa != null && Number.isFinite(Number(ocr.totale_iva_inclusa))) {
    const n = Number(ocr.totale_iva_inclusa)
    if (n > 0) return Math.round(n * 100) / 100
  }
  if (ocr.importo_raw?.trim()) {
    const p = parseAnyAmount(ocr.importo_raw)
    if (p != null && Number.isFinite(p) && p > 0) return Math.round(p * 100) / 100
  }
  return extractOrderTotalFromLabelledText(contextText ?? '')
}

/** Totale lordo da metadata OCR (`documenti_da_processare`). */
export function totaleFromDocMetadata(metadata: unknown): number | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const m = metadata as { totale_iva_inclusa?: unknown; importo_raw?: unknown }
  const n = m.totale_iva_inclusa
  if (typeof n === 'number' && Number.isFinite(n)) return Math.round(n * 100) / 100
  if (typeof n === 'string' && n.trim()) {
    const p = parseAnyAmount(n)
    if (p != null && Number.isFinite(p)) return Math.round(p * 100) / 100
  }
  const raw = m.importo_raw
  if (typeof raw === 'string' && raw.trim()) {
    const p = parseAnyAmount(raw)
    if (p != null && Number.isFinite(p)) return Math.round(p * 100) / 100
  }
  return null
}

function normalizeStoredImporto(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.round(value * 100) / 100
  }
  if (typeof value === 'string' && value.trim()) {
    return parseAmountToken(value)
  }
  return null
}

/** Importo da mostrare: righe prodotto, altrimenti totale documento (DB / OCR). */
export function confermaOrdineImportoTotale(row: {
  righe: unknown
  importo_totale?: number | null
}): number | null {
  const fromRighe = sumConfermaOrdineRigheImporto(row.righe)
  if (fromRighe != null) return fromRighe
  return normalizeStoredImporto(row.importo_totale)
}
