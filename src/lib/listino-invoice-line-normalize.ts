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

/** Codice articolo in testa al nome (es. M8000B, M8000TR3). */
export function inferCodiceFromProductName(prodotto: string): string | null {
  const m = prodotto.trim().match(/^([A-Z]{1,6}\d{2,6}[A-Z0-9]{0,6})\b/i)
  return m?.[1]?.toUpperCase() ?? null
}

function parseMoneyToken(raw: string): number | null {
  const n = parseFloat(raw.replace(/[£€$]/g, '').replace(/\s/g, '').replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n * 100) / 100
}

const PACK_SIZE_TOKEN = /^(\d{1,3}[xX×]\d{1,4}|X\d{1,4}|ROLL|CASE|CTN|CARTON)$/i

function pushParsedInvoiceLine(
  out: ListinoImportLineInput[],
  seen: Set<string>,
  row: ListinoImportLineInput,
) {
  const codice = row.codice_prodotto?.toUpperCase() ?? ''
  const key = `${codice}|${row.prodotto.toLowerCase()}|${row.prezzo}`
  if (seen.has(key)) return
  seen.add(key)
  out.push(row)
}

/**
 * Estrae righe da testo PDF.
 * Formato catering UK (es. Del Italia): CODICE DESCRIZIONE  qty  pack  value
 * dove **value = totale riga** (non prezzo unitario) e pack = X6 / X400 / ROLL / 12x45.
 */
export function parseInvoiceTableLinesFromText(text: string): ListinoImportLineInput[] {
  const out: ListinoImportLineInput[] = []
  const seen = new Set<string>()

  for (const line of text.split('\n')) {
    const t = line.trim().replace(/\s+/g, ' ')
    if (t.length < 10) continue
    if (/^(total|subtotal|sub\s*total|vat|iva|invoice|page|amount\s+due|product\s+code|description|quantity|pack|value)\b/i.test(t)) {
      continue
    }

    const packStyle = t.match(
      /^(\S+)\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s+(\S+)\s+(\d+(?:[.,]\d+)?)\s*$/i,
    )
    if (packStyle) {
      const qty = parseFloat(packStyle[3]!.replace(',', '.'))
      const pack = packStyle[4]!
      const lineTotal = parseMoneyToken(packStyle[5]!)
      if (!lineTotal || qty < 0.01 || qty > 999) continue
      if (!PACK_SIZE_TOKEN.test(pack) && !/^\d/.test(pack)) continue

      const unit = Math.round((lineTotal / qty) * 100) / 100
      const codiceCol = packStyle[1]!.toUpperCase()
      const desc = packStyle[2]!.trim()
      const codiceDesc = inferCodiceFromProductName(desc)
      const codice = codiceDesc && codiceDesc !== codiceCol ? codiceDesc : codiceCol
      const prodotto = sanitizeListinoProductName(desc, codice)

      pushParsedInvoiceLine(out, seen, {
        prodotto,
        codice_prodotto: codiceCol,
        prezzo: unit,
        quantita: qty,
        importo_linea: lineTotal,
        unita: pack,
        note: 'lettura tabella PDF (Value÷Qty)',
      })
      continue
    }

    const triple = t.match(
      /^(.+?)\s+(\d+(?:[.,]\d+)?)\s+(\d{1,7}[.,]\d{2})\s+(\d{1,7}[.,]\d{2})\s*$/,
    )
    if (!triple) continue

    const qty = parseFloat(triple[2]!.replace(',', '.'))
    const unit = parseMoneyToken(triple[3]!)
    const lineTotal = parseMoneyToken(triple[4]!)
    if (!unit || !lineTotal || qty < 1 || qty > 999) continue
    if (!amountsClose(unit * qty, lineTotal, 0.04)) continue

    const head = triple[1]!.trim()
    const codeMatch = head.match(/^([A-Z]{1,6}\d{2,6}[A-Z0-9]{0,6})\s+(.+)$/i)
    const codice = codeMatch ? codeMatch[1]!.toUpperCase() : inferCodiceFromProductName(head)
    const prodotto = codeMatch ? codeMatch[2]!.trim() : head
    if (!prodotto) continue

    pushParsedInvoiceLine(out, seen, {
      prodotto,
      codice_prodotto: codice,
      prezzo: unit,
      quantita: qty,
      importo_linea: lineTotal,
      unita: null,
      note: 'lettura tabella PDF',
    })
  }
  return out
}

/** Value column = extended line amount → unit price. */
export function resolveUnitPriceFromInvoiceValue(
  prezzo: number,
  quantita: number | null | undefined,
  importo_linea: number | null | undefined,
): { unit: number; lineTotal: number | null; quantita: number | null } {
  const qty =
    quantita != null && Number.isFinite(quantita) && quantita > 0
      ? Math.round(quantita * 1000) / 1000
      : null
  if (!qty || !Number.isFinite(prezzo) || prezzo <= 0) {
    return { unit: prezzo, lineTotal: importo_linea ?? null, quantita: qty }
  }

  const line =
    importo_linea != null && Number.isFinite(importo_linea) && importo_linea > 0
      ? importo_linea
      : prezzo
  const unitFromLine = Math.round((line / qty) * 100) / 100

  const prezzoAlreadyUnit =
    importo_linea != null &&
    amountsClose(prezzo * qty, importo_linea, 0.03) &&
    !amountsClose(prezzo, importo_linea, 0.02)

  if (prezzoAlreadyUnit) {
    return { unit: prezzo, lineTotal: importo_linea, quantita: qty }
  }

  return { unit: unitFromLine, lineTotal: line, quantita: qty }
}

/** Integra quantità / prezzo unitario dal testo PDF quando Gemini sbaglia o omette campi. */
export function mergeImportLinesWithPdfText(
  geminiItems: ListinoImportLineInput[],
  textLines: ListinoImportLineInput[],
): ListinoImportLineInput[] {
  if (textLines.length === 0) return geminiItems

  const byCode = new Map<string, ListinoImportLineInput>()
  for (const row of textLines) {
    const keys = new Set<string>()
    const c1 = row.codice_prodotto?.toUpperCase()
    const c2 = inferCodiceFromProductName(row.prodotto)?.toUpperCase()
    if (c1) keys.add(c1)
    if (c2) keys.add(c2)
    for (const k of keys) byCode.set(k, row)
  }

  const findTextRow = (code: string | null, prodotto: string) => {
    if (!code) return null
    const direct = byCode.get(code)
    if (direct) return direct
    const fromName = inferCodiceFromProductName(prodotto)?.toUpperCase()
    if (fromName) return byCode.get(fromName) ?? null
    return null
  }

  return geminiItems.map((g) => {
    const code = (g.codice_prodotto ?? inferCodiceFromProductName(g.prodotto))?.toUpperCase() ?? null
    const fromText = findTextRow(code, g.prodotto)
    const codice_prodotto = g.codice_prodotto ?? fromText?.codice_prodotto ?? (code || null)

    if (!fromText) {
      return normalizeListinoImportLineItem({ ...g, codice_prodotto }, [])
    }

    const merged: ListinoImportLineInput = {
      ...g,
      codice_prodotto,
      prodotto: g.prodotto.trim() || fromText.prodotto,
      quantita: fromText.quantita ?? g.quantita,
      importo_linea: fromText.importo_linea ?? g.importo_linea,
      prezzo:
        fromText.quantita != null && fromText.quantita >= 1
          ? fromText.prezzo
          : g.prezzo,
    }
    return normalizeListinoImportLineItem(merged, [])
  })
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
  const codice_prodotto =
    item.codice_prodotto?.trim() || inferCodiceFromProductName(item.prodotto) || null
  const prodotto = sanitizeListinoProductName(item.prodotto, codice_prodotto)
  const qty = parseInvoiceOrderQuantity(item.quantita, item.unita)
  let prezzo = item.prezzo

  if (!Number.isFinite(prezzo) || prezzo <= 0) {
    return { ...item, prodotto, prezzo, codice_prodotto }
  }

  const resolved = resolveUnitPriceFromInvoiceValue(
    prezzo,
    qty ?? item.quantita,
    item.importo_linea,
  )
  prezzo = resolved.unit
  const lineTotal = resolved.lineTotal
  const qtyOut = resolved.quantita

  const hist = existingPrices.filter((p) => Number.isFinite(p) && p > 0)
  if (hist.length >= 2) {
    const fromLine = inferUnitPriceFromLineTotal(prezzo, hist)
    if (fromLine != null) prezzo = fromLine
  } else if (hist.length === 1) {
    const ref = hist[0]!
    if (prezzo >= ref * 1.85 && prezzo <= ref * 2.15) {
      prezzo = Math.round((prezzo / 2) * 100) / 100
    }
  }

  if (qty == null && hist.length >= 1) {
    const ref = Math.max(...hist)
    if (ref > 0 && prezzo > ref * 1.5) {
      for (const q of [2, 3, 4, 5, 6, 8, 10, 12]) {
        const unit = Math.round((prezzo / q) * 100) / 100
        if (unit >= ref * 0.88 && unit <= ref * 1.12) {
          prezzo = unit
          break
        }
      }
    }
  }

  return {
    ...item,
    codice_prodotto,
    prodotto,
    prezzo,
    quantita: qtyOut ?? qty ?? item.quantita,
    importo_linea: lineTotal ?? item.importo_linea,
  }
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
