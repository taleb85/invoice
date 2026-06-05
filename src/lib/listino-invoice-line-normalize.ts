import { isListinoCaseUnitFormat, parseListinoNoteParts } from '@/lib/listino-display'
import {
  inferUnitPriceFromLineTotal,
  listinoHistRefForLineInference,
  resolveEffectiveListinoUnitPrice,
} from '@/lib/listino-price-sanity'

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

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

function isPackSizeToken(pack: string): boolean {
  return PACK_SIZE_TOKEN.test(pack) || /^roll$/i.test(pack)
}

/** Ultimi 3 campi: quantità · pack · value (totale riga). */
function parsePackStyleFromCells(cells: string[]): ListinoImportLineInput | null {
  if (cells.length < 4) return null
  const value = parseMoneyToken(cells[cells.length - 1]!)
  const pack = cells[cells.length - 2]!
  const qty = parseFloat(cells[cells.length - 3]!.replace(',', '.'))
  if (!value || !Number.isFinite(qty) || qty < 0.01 || qty > 999) return null
  if (!isPackSizeToken(pack)) return null

  const codiceCol = cells[0]!.toUpperCase()
  const desc = cells.slice(1, -3).join(' ').trim()
  const codiceDesc = inferCodiceFromProductName(desc)
  const codice = codiceDesc && codiceDesc !== codiceCol ? codiceDesc : codiceCol
  const prodotto = sanitizeListinoProductName(desc, codice)
  const unit = roundMoney(value / qty)

  return {
    prodotto,
    codice_prodotto: codiceCol,
    prezzo: unit,
    quantita: qty,
    importo_linea: value,
    unita: pack,
    note: 'lettura tabella PDF (Value÷Qty)',
  }
}

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

  for (const rawLine of text.split('\n')) {
    const trimmed = rawLine.trim()
    if (trimmed.length < 10) continue

    if (trimmed.includes('\t')) {
      const tabCells = trimmed.split(/\t+/).map((c) => c.trim()).filter(Boolean)
      const fromTab = parsePackStyleFromCells(tabCells)
      if (fromTab) {
        pushParsedInvoiceLine(out, seen, fromTab)
        continue
      }
    }

    const t = trimmed.replace(/\s+/g, ' ')
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
      if (!isPackSizeToken(pack) && !/^\d/.test(pack)) continue

      const codiceCol = packStyle[1]!.toUpperCase()
      const desc = packStyle[2]!.trim()
      const fromCells = parsePackStyleFromCells([
        codiceCol,
        desc,
        packStyle[3]!,
        pack,
        packStyle[5]!,
      ])
      if (fromCells) pushParsedInvoiceLine(out, seen, fromCells)
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

  if (
    importo_linea != null &&
    qty > 1 &&
    amountsClose(prezzo, importo_linea, 0.02)
  ) {
    const line = prezzo
    return { unit: roundMoney(line / qty), lineTotal: line, quantita: qty }
  }

  const line =
    importo_linea != null && Number.isFinite(importo_linea) && importo_linea > 0
      ? importo_linea
      : prezzo
  const unitFromLine = roundMoney(line / qty)

  return { unit: unitFromLine, lineTotal: line, quantita: qty }
}

/** Gemini: importo = prezzo×qty con prezzo = colonna Value (totale riga), non unitario. */
export function resolveAmbiguousInvoiceLinePrice(
  prezzo: number,
  quantita: number,
  importo_linea: number,
  referencePrices: number[] = [],
): { unit: number; lineTotal: number } {
  const uValueAsLine = roundMoney(prezzo / quantita)
  const uFromImporto = roundMoney(importo_linea / quantita)
  const uAsPrezzo = roundMoney(prezzo)

  const candidates = [
    { unit: uValueAsLine, line: prezzo },
    { unit: uFromImporto, line: importo_linea },
    { unit: uAsPrezzo, line: importo_linea },
  ]

  const geminiValueInPrezzo =
    amountsClose(importo_linea, prezzo * quantita, 0.03) &&
    !amountsClose(prezzo, importo_linea, 0.02)

  const hist = referencePrices.filter((p) => Number.isFinite(p) && p > 0)
  if (geminiValueInPrezzo && hist.length > 0) {
    let best = candidates[0]!
    let bestRel = Infinity
    for (const c of candidates) {
      const rel = Math.min(...hist.map((h) => Math.abs(c.unit - h) / h))
      if (rel < bestRel) {
        bestRel = rel
        best = c
      }
    }
    if (bestRel < 0.4) {
      return { unit: best.unit, lineTotal: roundMoney(best.unit * quantita) }
    }
  }

  if (geminiValueInPrezzo) {
    return { unit: uValueAsLine, lineTotal: prezzo }
  }

  if (amountsClose(uFromImporto, uAsPrezzo, 0.02)) {
    return { unit: uFromImporto, lineTotal: importo_linea }
  }

  return { unit: uValueAsLine, lineTotal: prezzo }
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
      note: fromText.note ?? g.note,
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
 * Colonna Value in `prezzo` (totale riga) con importo = prezzo×qty: unitario = prezzo÷qty.
 * Usa listino solo se il rapporto è plausibile (es. FOIL45 13.18→6.59 vs listino 6.59).
 */
function correctValueColumnWithListinoHistory(
  rawPrezzo: number,
  qty: number,
  importoLinea: number | null | undefined,
  hist: number[],
): { unit: number; line: number } | null {
  if (hist.length === 0 || qty <= 1 || rawPrezzo <= 0) return null
  const ref = Math.min(...hist)
  const importo = importoLinea ?? rawPrezzo * qty
  if (!amountsClose(rawPrezzo * qty, importo, 0.04)) return null
  if (rawPrezzo <= ref * 1.25) return null
  const unit = roundMoney(rawPrezzo / qty)
  if (unit < ref * 0.8 || unit > ref * 1.2) return null
  return { unit, line: rawPrezzo }
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
  const rawPrezzo = item.prezzo
  let prezzo = item.prezzo

  if (!Number.isFinite(prezzo) || prezzo <= 0) {
    return { ...item, prodotto, prezzo, codice_prodotto }
  }

  const hist = existingPrices.filter((p) => Number.isFinite(p) && p > 0)
  const qtyForResolve = qty ?? item.quantita
  const resolved = resolveUnitPriceFromInvoiceValue(
    prezzo,
    qtyForResolve,
    item.importo_linea,
  )
  prezzo = resolved.unit
  let lineTotal = resolved.lineTotal
  const qtyOut = resolved.quantita

  const ambiguous =
    qtyForResolve != null &&
    qtyForResolve > 1 &&
    item.importo_linea != null &&
    Number.isFinite(item.importo_linea) &&
    amountsClose(item.prezzo * qtyForResolve, item.importo_linea, 0.03) &&
    !amountsClose(item.prezzo, item.importo_linea, 0.02)

  const refForPdf = hist.length > 0 ? Math.min(...hist) : null
  const correctedFromPdf =
    /lettura tabella pdf/i.test(item.note ?? '') &&
    !(
      ambiguous &&
      refForPdf != null &&
      rawPrezzo > refForPdf * 1.25
    )
  if (ambiguous && !correctedFromPdf && item.importo_linea != null && Number.isFinite(item.importo_linea)) {
    const fixed = resolveAmbiguousInvoiceLinePrice(
      item.prezzo,
      qtyForResolve,
      item.importo_linea,
      hist,
    )
    prezzo = fixed.unit
    lineTotal = fixed.lineTotal
  }

  if (hist.length >= 2) {
    const fromLine = inferUnitPriceFromLineTotal(prezzo, hist)
    if (fromLine != null) prezzo = fromLine
  } else if (hist.length === 1) {
    const ref = hist[0]!
    if (prezzo >= ref * 1.85 && prezzo <= ref * 2.15) {
      prezzo = Math.round((prezzo / 2) * 100) / 100
    }
  }

  const qtyFinal = qtyForResolve ?? qty ?? item.quantita
  if (qtyFinal != null && qtyFinal > 1) {
    const fromHist = correctValueColumnWithListinoHistory(
      rawPrezzo,
      qtyFinal,
      item.importo_linea,
      hist,
    )
    if (fromHist) {
      prezzo = fromHist.unit
      lineTotal = fromHist.line
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

function listinoPrezzoLooksLikeInvoiceLineTotal(
  prezzo: number,
  orderQty: number,
  otherPrices: number[],
): boolean {
  const unit = Math.round((prezzo / orderQty) * 100) / 100
  if (unit <= 0 || !amountsClose(prezzo, unit * orderQty, 0.025)) return false
  const hist = otherPrices.filter((p) => Number.isFinite(p) && p > 0)
  if (hist.length === 0) {
    return orderQty >= 2 && prezzo > unit * 1.35
  }
  const ref = listinoHistRefForLineInference(hist)
  if (unit < ref * 0.85 || unit > ref * 1.15) return false
  return prezzo >= ref * orderQty * 0.85 || prezzo > ref * 1.75
}

/** Prezzo mostrato in UI: corregge totale riga (nota o storico). */
export function resolveListinoUnitPriceForDisplay(
  prezzo: number,
  note: string | null | undefined,
  otherPrices: number[],
): number {
  const parsed = parseListinoNoteParts(note)
  const caseUnit = isListinoCaseUnitFormat(parsed.unita)

  const orderQty = parseListinoNoteOrderQty(note)
  if (orderQty != null) {
    const unit = Math.round((prezzo / orderQty) * 100) / 100
    if (
      unit > 0 &&
      unit < prezzo * 0.99 &&
      listinoPrezzoLooksLikeInvoiceLineTotal(prezzo, orderQty, otherPrices)
    ) {
      return resolveEffectiveListinoUnitPrice(unit, otherPrices, {
        skipLineTotalInfer: caseUnit,
      })
    }
  }

  return resolveEffectiveListinoUnitPrice(prezzo, otherPrices, {
    skipLineTotalInfer: caseUnit,
  })
}
