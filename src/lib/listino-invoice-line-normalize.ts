import { parseListinoNoteParts } from '@/lib/listino-display'
import { inferUnitPriceFromLineTotal, resolveEffectiveListinoUnitPrice } from '@/lib/listino-price-sanity'

export type ListinoImportLineInput = {
  prodotto: string
  codice_prodotto?: string | null
  prezzo: number
  quantita?: number | null
  importo_linea?: number | null
  unita?: string | null
  note?: string | null
}

/** Quantità ordinata sulla fattura (casse/confezioni), non il formato confezione (es. X6 = 6 pezzi per cartone). */
export function parseInvoiceOrderQuantity(
  quantita: number | null | undefined,
  unita: string | null | undefined,
): number | null {
  if (quantita != null && Number.isFinite(quantita) && quantita > 0) {
    const q = Math.round(quantita * 1000) / 1000
    if (q >= 1 && q <= 999) return q
  }
  const u = (unita ?? '').trim()
  if (!u) return null
  // "2 casse", "3 x", "Qty 2" — quantità ordine
  const order =
    u.match(/^(\d+(?:[.,]\d+)?)\s*(?:x|×|pz|casse|case|conf|pack|ctn|carton)/i) ??
    u.match(/^(?:qty|qtà|quantità)\s*[:.]?\s*(\d+(?:[.,]\d+)?)/i)
  if (order) {
    const q = parseFloat(order[1]!.replace(',', '.'))
    if (q >= 1 && q <= 999) return q
  }
  // "X6" / "6x33cl" = formato confezione, non quantità fatturata
  return null
}

/**
 * Nome prodotto da OCR: rimuove prefissi multi-SKU e metadati finiti per errore nel campo descrizione.
 */
export function sanitizeListinoProductName(prodotto: string, codice?: string | null): string {
  let p = prodotto.replace(/\s+/g, ' ').trim().replace(/[\s.,;:\-]+$/, '')
  if (!p) return prodotto.trim()

  /** Solo codici con cifre (evita di tagliare parole tipo «MIDI»). */
  const leadingSkuToken =
    /^(?:[A-Z]{2,5}\d{2,6}[A-Z0-9]*|[A-Z]{1,8}\d+[A-Z0-9]*)\s*(?:\/\s*)?/i
  while (leadingSkuToken.test(p)) {
    p = p.replace(leadingSkuToken, '').trim()
  }

  const c = codice?.trim()
  if (c) {
    const re = new RegExp(`^${escapeRegExp(c)}[\\s\\-—·:]+`, 'i')
    if (re.test(p)) p = p.replace(re, '').trim()
  }

  p = p
    .replace(/\s*·\s*codice\s*:\s*[^·]+/gi, '')
    .replace(/\s*·\s*unit[aà]\s*:\s*[^·]+/gi, '')
    .replace(/\s+/g, ' ')
    .trim()

  return p || prodotto.trim()
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function amountsClose(a: number, b: number, rel = 0.03): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return false
  return Math.abs(a - b) / Math.abs(b) <= rel
}

/**
 * Corregge prezzo unitario (totale riga ÷ quantità, inferenza da storico) e pulisce il nome.
 */
export function normalizeListinoImportLineItem(
  item: ListinoImportLineInput,
  existingPrices: number[] = [],
): ListinoImportLineInput {
  const prodotto = sanitizeListinoProductName(item.prodotto, item.codice_prodotto)
  const qty = parseInvoiceOrderQuantity(item.quantita, item.unita)
  let prezzo = item.prezzo

  if (!Number.isFinite(prezzo) || prezzo <= 0) {
    return { ...item, prodotto, prezzo }
  }

  const lineTotal =
    item.importo_linea != null && Number.isFinite(item.importo_linea) && item.importo_linea > 0
      ? item.importo_linea
      : null

  if (qty != null && qty >= 1) {
    const unitFromLine =
      lineTotal != null
        ? Math.round((lineTotal / qty) * 100) / 100
        : Math.round((prezzo / qty) * 100) / 100

    const prezzoLooksLikeLineTotal =
      lineTotal != null
        ? amountsClose(prezzo, lineTotal, 0.02)
        : amountsClose(prezzo, unitFromLine * qty, 0.02) && qty >= 2

    if (prezzoLooksLikeLineTotal && unitFromLine > 0 && unitFromLine < prezzo * 0.99) {
      prezzo = unitFromLine
    } else if (
      qty >= 2 &&
      qty <= 24 &&
      Number.isInteger(qty) &&
      unitFromLine > 0 &&
      unitFromLine < prezzo * 0.99 &&
      amountsClose(prezzo, unitFromLine * qty, 0.025)
    ) {
      prezzo = unitFromLine
    }
  } else if (lineTotal != null && lineTotal > prezzo * 1.5) {
    const inferredQty = Math.round(lineTotal / prezzo)
    if (inferredQty >= 2 && inferredQty <= 24 && amountsClose(lineTotal, prezzo * inferredQty, 0.03)) {
      prezzo = Math.round((lineTotal / inferredQty) * 100) / 100
    }
  }

  const hist = existingPrices.filter((p) => Number.isFinite(p) && p > 0)
  if (hist.length >= 2) {
    const fromLine = inferUnitPriceFromLineTotal(prezzo, hist)
    if (fromLine != null) prezzo = fromLine
  }

  return { ...item, prodotto, prezzo, quantita: qty ?? item.quantita }
}

/** Prezzi storici per prodotto / codice (note listino). */
export function existingListinoPricesForImport(
  rows: Array<{ prodotto: string; prezzo: number; note?: string | null }>,
  prodotto: string,
  codice?: string | null,
): number[] {
  const nameKey = prodotto.trim().toLowerCase()
  const codeKey = codice?.trim().toUpperCase() ?? ''
  const out: number[] = []
  for (const row of rows) {
    const p = Number(row.prezzo)
    if (!Number.isFinite(p) || p <= 0) continue
    if (row.prodotto.trim().toLowerCase() === nameKey) {
      out.push(p)
      continue
    }
    if (codeKey) {
      const parsed = parseListinoNoteParts(row.note)
      if (parsed.codice?.toUpperCase() === codeKey) out.push(p)
    }
  }
  return out
}

/** Qtà ordine salvata in nota listino dopo import fattura. */
export function parseListinoNoteOrderQty(note: string | null | undefined): number | null {
  if (!note) return null
  const m = note.match(/Qtà fattura:\s*(\d+(?:[.,]\d+)?)/i)
  if (!m) return null
  const q = parseFloat(m[1]!.replace(',', '.'))
  if (!Number.isFinite(q) || q < 2 || q > 999) return null
  return q
}

/** Prezzo mostrato in UI: corregge totale riga (nota o storico). */
export function resolveListinoUnitPriceForDisplay(
  prezzo: number,
  note: string | null | undefined,
  otherPrices: number[],
): number {
  const qty = parseListinoNoteOrderQty(note)
  if (qty != null) {
    const unit = Math.round((prezzo / qty) * 100) / 100
    if (unit > 0 && unit < prezzo * 0.99 && amountsClose(prezzo, unit * qty, 0.025)) {
      return resolveEffectiveListinoUnitPrice(unit, otherPrices)
    }
  }

  const hist = otherPrices.filter((p) => Number.isFinite(p) && p > 0)
  if (hist.length >= 1) {
    const ref = Math.max(...hist)
    if (ref > 0 && prezzo > ref * 1.75) {
      for (const q of [2, 3, 4, 5, 6, 8, 10, 12]) {
        const unit = Math.round((prezzo / q) * 100) / 100
        if (unit >= ref * 0.88 && unit <= ref * 1.12) {
          return unit
        }
      }
    }
  }

  return resolveEffectiveListinoUnitPrice(prezzo, otherPrices)
}
