import {
  isListinoCaseUnitFormat,
  parseListinoNoteParts,
  parsePackSizeFromListinoUnita,
} from '@/lib/listino-display'
import {
  parseListinoNoteOrderQty,
  resolveListinoUnitPriceForDisplay,
} from '@/lib/listino-invoice-line-normalize'

const RETAIL_PACK_PRICE_MULTS = [2, 3, 4, 6, 8, 10, 12, 16, 20, 24] as const

/**
 * Corregge prezzi confezione retail salvati troppo bassi (es. 3,50÷16 → 0,22 su mozzarella 250g).
 */
export function repairUnderpricedRetailPackPrice(
  rawPrezzo: number,
  prodotto: string,
  note: string | null | undefined,
  otherPrices: number[],
): number {
  if (!Number.isFinite(rawPrezzo) || rawPrezzo <= 0 || rawPrezzo >= 1) return rawPrezzo

  const parsed = parseListinoNoteParts(note)
  const pesoKg = parseProductWeightKg(prodotto, parsed.unita, note)
  if (!pesoKg || pesoKg > 2 || pesoKg < 0.04) return rawPrezzo

  const orderQty = parseListinoNoteOrderQty(note)
  const candidates = new Set<number>([rawPrezzo])
  if (orderQty != null && orderQty > 1) {
    candidates.add(roundMoney(rawPrezzo * orderQty))
  }
  for (const mult of RETAIL_PACK_PRICE_MULTS) {
    candidates.add(roundMoney(rawPrezzo * mult))
  }

  const peerPack = medianPositive(otherPrices.filter((p) => p >= 1))
  let best = rawPrezzo
  let bestScore = -Infinity

  for (const pack of candidates) {
    if (pack < 1 || pack > 60) continue
    const perKg = pack / pesoKg
    if (perKg < 4 || perKg > 200) continue

    let score = 0
    if (perKg >= 8 && perKg <= 50) score += 10
    else if (perKg >= 4 && perKg <= 80) score += 5
    if (pack >= 1.5 && pack <= 25) score += 3
    if (pesoKg <= 0.5) {
      if (pack >= 2 && pack <= 5) score += 5
      else if (pack > 8) score -= 3
      if (perKg >= 12 && perKg <= 16) score += 6
      else if (perKg >= 10 && perKg <= 20) score += 3
    }
    if (peerPack != null && nearRatio(pack, peerPack, 0.35)) score += 4
    if (orderQty != null && roundMoney(rawPrezzo * orderQty) === pack && pack >= 1) score += 2

    if (score > bestScore || (score === bestScore && pack > best)) {
      bestScore = score
      best = pack
    }
  }

  return bestScore > 0 ? best : rawPrezzo
}

/** Prezzo confezione per confronto: non divide per «Qtà fattura» su pack a peso (es. 250g). */
export function listinoPackagePriceForCompare(
  rawPrezzo: number,
  prodotto: string,
  note: string | null | undefined,
  otherPrices: number[],
): number {
  if (!Number.isFinite(rawPrezzo) || rawPrezzo <= 0) return rawPrezzo
  const parsed = parseListinoNoteParts(note)
  const pesoKg = parseProductWeightKg(prodotto, parsed.unita, note)
  const repaired = repairUnderpricedRetailPackPrice(rawPrezzo, prodotto, note, otherPrices)
  if (pesoKg && pesoKg <= 2) {
    return repaired
  }
  return resolveListinoUnitPriceForDisplay(repaired, note, otherPrices)
}

export type ComparableListinoPrice = {
  /** Prezzo come in listino (può essere confezione/cassa). */
  prezzo_listino: number
  /** Prezzo normalizzato a unità singola per confronto e ordinamento. */
  prezzo_confronto: number
  pack_size: number | null
  unita: string | null
  /** singolo | confezione | cassa */
  formato: 'singolo' | 'confezione' | 'cassa'
}

export type CompareNormalizeInput = {
  prezzo: number
  note: string | null | undefined
  prodotto: string
  otherPrices: number[]
}

type PackHint = {
  packSize: number
  /** unita_nx = 6x75cl (prezzo quasi sempre per confezione) */
  source: 'unita_nx' | 'unita_case' | 'unita_slash' | 'product_name'
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

export function medianPositive(values: number[]): number | null {
  const sorted = values.filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b)
  if (sorted.length === 0) return null
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2
}

/** Pezzi per confezione da nome prodotto (es. «6/75», «6x75cl»). */
export function inferPackCountFromProductName(name: string): number | null {
  const t = name.trim()
  if (!t) return null

  let m = t.match(/\b(\d{1,2})\s*\/\s*75\b/i)
  if (m) {
    const n = parseInt(m[1]!, 10)
    if (n >= 2 && n <= 48) return n
  }

  m = t.match(/\b(\d{1,2})\s*\/\s*(\d{2,3})\s*cl\b/i)
  if (m) {
    const n = parseInt(m[1]!, 10)
    if (n >= 2 && n <= 48) return n
  }

  m = t.match(/\b(\d{1,2})\s*[xX×]\s*75\s*cl\b/i)
  if (m) {
    const n = parseInt(m[1]!, 10)
    if (n >= 2 && n <= 48) return n
  }

  return null
}

function parseSlashPackFromUnita(unita: string | null | undefined): number | null {
  const u = (unita ?? '').trim()
  if (!u) return null
  const m = u.match(/^(\d{1,2})\s*\/\s*(\d{2,3})\s*cl$/i)
  if (!m) return null
  const n = parseInt(m[1]!, 10)
  return n >= 2 && n <= 48 ? n : null
}

function detectListinoPackHint(
  note: string | null | undefined,
  prodotto: string,
): PackHint | null {
  const parsed = parseListinoNoteParts(note)
  const unita = parsed.unita?.trim() || null

  const fromNx = parsePackSizeFromListinoUnita(unita)
  if (fromNx) {
    return { packSize: fromNx, source: 'unita_nx' }
  }

  if (isListinoCaseUnitFormat(unita)) {
    const caseMatch = unita?.match(/^[xX×]\s*(\d{1,3})/) ?? unita?.match(/^[xX×](\d{2,3})/)
    const caseSize = caseMatch ? parseInt(caseMatch[1]!, 10) : null
    if (caseSize && caseSize >= 2) {
      return { packSize: caseSize, source: 'unita_case' }
    }
  }

  const fromSlash = parseSlashPackFromUnita(unita)
  if (fromSlash) {
    return { packSize: fromSlash, source: 'unita_slash' }
  }

  const fromName = inferPackCountFromProductName(prodotto)
  if (fromName) {
    return { packSize: fromName, source: 'product_name' }
  }

  return null
}

function nearRatio(value: number, target: number, tolerance = 0.35): boolean {
  if (!Number.isFinite(value) || !Number.isFinite(target) || target <= 0) return false
  return value >= target * (1 - tolerance) && value <= target * (1 + tolerance)
}

function shouldUsePackTotalPrice(
  displayPrice: number,
  packSize: number,
  hint: PackHint,
  peerUnitPrices: number[],
): boolean {
  const perPiece = roundMoney(displayPrice / packSize)
  if (perPiece <= 0 || perPiece >= displayPrice * 0.999) return false

  const peerMedian = medianPositive(peerUnitPrices)

  if (hint.source === 'unita_nx' || hint.source === 'unita_case') {
    if (peerMedian == null) {
      return displayPrice >= 15 && displayPrice / perPiece >= 2
    }
    if (nearRatio(displayPrice, peerMedian)) return false
    if (nearRatio(perPiece, peerMedian)) return true
    if (nearRatio(displayPrice, peerMedian * packSize, 0.25)) return true
    return displayPrice > peerMedian * 2.2
  }

  if (peerMedian == null) {
    return displayPrice >= 18 && displayPrice / perPiece >= 2.5
  }
  if (nearRatio(displayPrice, peerMedian)) return false
  if (nearRatio(perPiece, peerMedian)) return true
  if (nearRatio(displayPrice, peerMedian * packSize, 0.25)) return true
  return false
}

/**
 * Normalizza un prezzo listino a unità confrontabile (bottiglia/pezzo).
 * `peerUnitPrices` = altri prezzi unitari già stimati nella stessa ricerca (non lo storico grezzo).
 */
export function resolveComparableListinoPrice(
  opts: CompareNormalizeInput & {
    peerUnitPrices?: number[]
    searchMedianUnit?: number | null
  },
): ComparableListinoPrice {
  const parsed = parseListinoNoteParts(opts.note)
  const unita = parsed.unita?.trim() || null
  const display = listinoPackagePriceForCompare(
    opts.prezzo,
    opts.prodotto,
    opts.note,
    opts.otherPrices,
  )
  const peerUnitPrices =
    opts.peerUnitPrices ??
    (opts.searchMedianUnit != null && opts.searchMedianUnit > 0 ? [opts.searchMedianUnit] : [])

  const packHint = detectListinoPackHint(opts.note, opts.prodotto)
  if (packHint && shouldUsePackTotalPrice(display, packHint.packSize, packHint, peerUnitPrices)) {
    const perPiece = roundMoney(display / packHint.packSize)
    return {
      prezzo_listino: display,
      prezzo_confronto: perPiece,
      pack_size: packHint.packSize,
      unita,
      formato:
        packHint.source === 'unita_case' || isListinoCaseUnitFormat(unita)
          ? 'cassa'
          : 'confezione',
    }
  }

  return {
    prezzo_listino: display,
    prezzo_confronto: display,
    pack_size: null,
    unita,
    formato: 'singolo',
  }
}

/**
 * Normalizza un batch di risultati ricerca con convergenza sui prezzi unitari tra peer.
 */
export function normalizeCompareBatch(items: CompareNormalizeInput[]): ComparableListinoPrice[] {
  if (items.length === 0) return []

  let unitCandidates = items.map((item) => {
    const display = listinoPackagePriceForCompare(
      item.prezzo,
      item.prodotto,
      item.note,
      item.otherPrices,
    )
    const hint = detectListinoPackHint(item.note, item.prodotto)
    if (!hint) return display
    const perPiece = roundMoney(display / hint.packSize)
    if (hint.source === 'unita_nx' || hint.source === 'unita_case') {
      return perPiece
    }
    return display
  })

  for (let pass = 0; pass < 3; pass++) {
    const next: number[] = []
    for (let i = 0; i < items.length; i++) {
      const peers = unitCandidates.filter((_, j) => j !== i)
      const normalized = resolveComparableListinoPrice({
        ...items[i]!,
        peerUnitPrices: peers,
      })
      next.push(normalized.prezzo_confronto)
    }
    const changed = next.some((v, i) => Math.abs(v - unitCandidates[i]!) > 0.009)
    unitCandidates = next
    if (!changed) break
  }

  return items.map((item, i) => {
    const peers = unitCandidates.filter((_, j) => j !== i)
    return resolveComparableListinoPrice({
      ...item,
      peerUnitPrices: peers,
    })
  })
}

export type CompareRowDisplay = {
  prezzo_confezione: number
  prezzo_kg: number | null
  peso_kg: number | null
  prezzo_unita: number
  pack_size: number | null
  formato: ComparableListinoPrice['formato']
}

/** Peso confezione in kg da nome prodotto, unità o nota (es. 3kg, 250g, per 5kg). */
export function parseProductWeightKg(
  prodotto: string,
  unita?: string | null,
  note?: string | null,
): number | null {
  const parsedNote = parseListinoNoteParts(note)
  const sources = [
    prodotto,
    unita ?? '',
    parsedNote.unita ?? '',
    parsedNote.humanTail ?? '',
  ].filter((s) => s.trim().length > 0)

  for (const source of sources) {
    const kgMatch = source.match(/\b(\d+(?:[.,]\d+)?)\s*kg\b/i)
    if (kgMatch) {
      const kg = parseFloat(kgMatch[1]!.replace(',', '.'))
      if (kg > 0 && kg <= 1000) return roundMoney(kg)
    }

    const gMatch = source.match(/\b(\d+(?:[.,]\d+)?)\s*g(?:r|rams?)?\b/i)
    if (gMatch) {
      const grams = parseFloat(gMatch[1]!.replace(',', '.'))
      if (grams > 0 && grams <= 500_000) return roundMoney(grams / 1000)
    }
  }

  return null
}

function isRetailWeightPack(pesoKg: number, listino: number): boolean {
  return pesoKg > 0 && pesoKg <= 2 && listino >= 0.5 && listino <= 120
}

function resolveWeightBasedPrices(
  listino: number,
  pesoKg: number,
  peerKgPrices: number[],
): { prezzo_confezione: number; prezzo_kg: number } {
  const perKgFromPack = roundMoney(listino / pesoKg)
  const peer = medianPositive(peerKgPrices)

  if (isRetailWeightPack(pesoKg, listino)) {
    return { prezzo_confezione: listino, prezzo_kg: perKgFromPack }
  }

  if (peer != null) {
    if (nearRatio(perKgFromPack, peer)) {
      return { prezzo_confezione: listino, prezzo_kg: perKgFromPack }
    }
    if (nearRatio(listino, peer)) {
      return {
        prezzo_confezione: roundMoney(listino * pesoKg),
        prezzo_kg: listino,
      }
    }
    if (
      perKgFromPack >= 2 &&
      perKgFromPack <= 150 &&
      listino >= perKgFromPack * pesoKg * 0.85
    ) {
      return { prezzo_confezione: listino, prezzo_kg: perKgFromPack }
    }
    if (listino >= peer * pesoKg * 0.55) {
      return { prezzo_confezione: listino, prezzo_kg: perKgFromPack }
    }
    return {
      prezzo_confezione: roundMoney(listino * pesoKg),
      prezzo_kg: listino,
    }
  }

  if (listino >= 1.5 || pesoKg >= 0.2) {
    return { prezzo_confezione: listino, prezzo_kg: perKgFromPack }
  }

  return {
    prezzo_confezione: roundMoney(listino * pesoKg),
    prezzo_kg: listino,
  }
}

function detectPackSizeFromCompareRow(row: {
  unita: string | null | undefined
  prodotto: string
  prezzo_listino?: number
  prezzo_attuale?: number
  pack_size?: number | null
}): number | null {
  if (row.pack_size && row.pack_size >= 2) return row.pack_size
  const fromUnita = parsePackSizeFromListinoUnita(row.unita)
  if (fromUnita) return fromUnita
  const listino = row.prezzo_listino ?? row.prezzo_attuale ?? 0
  if (listino >= 18) return inferPackCountFromProductName(row.prodotto)
  return null
}

/** Prezzi da mostrare in tabella confronto (anche se l'API non ha normalizzato). */
export function displayCompareRowPrices(
  row: {
    prodotto: string
    prezzo_listino?: number
    prezzo_confronto?: number
    prezzo_attuale?: number
    unita?: string | null
    note?: string | null
    pack_size?: number | null
    formato?: ComparableListinoPrice['formato']
  },
  peerComparePrices: number[] = [],
): CompareRowDisplay {
  const rawListino = row.prezzo_listino ?? row.prezzo_attuale ?? 0
  const listino = listinoPackagePriceForCompare(
    rawListino,
    row.prodotto,
    row.note,
    [],
  )
  const unit = row.prezzo_confronto ?? row.prezzo_attuale ?? listino
  const peerMedian = medianPositive(peerComparePrices)

  const pesoKg = parseProductWeightKg(row.prodotto, row.unita, row.note)
  if (pesoKg && pesoKg > 0 && listino > 0) {
    const weightPrices = resolveWeightBasedPrices(listino, pesoKg, peerComparePrices)
    return {
      prezzo_confezione: weightPrices.prezzo_confezione,
      prezzo_kg: weightPrices.prezzo_kg,
      peso_kg: pesoKg,
      prezzo_unita: weightPrices.prezzo_kg,
      pack_size: null,
      formato: 'singolo',
    }
  }

  if (
    row.formato &&
    row.formato !== 'singolo' &&
    row.prezzo_confronto != null &&
    row.prezzo_confronto < listino * 0.9
  ) {
    return {
      prezzo_confezione: listino,
      prezzo_kg: null,
      peso_kg: null,
      prezzo_unita: row.prezzo_confronto,
      pack_size: row.pack_size ?? detectPackSizeFromCompareRow({ ...row, unita: row.unita ?? null }),
      formato: row.formato,
    }
  }

  const packSize = detectPackSizeFromCompareRow({
    unita: row.unita ?? null,
    prodotto: row.prodotto,
    prezzo_listino: listino,
    prezzo_attuale: row.prezzo_attuale,
    pack_size: row.pack_size,
  })

  if (packSize && packSize >= 2 && listino > 0) {
    const perUnit = roundMoney(listino / packSize)
    const looksLikePackTotal =
      listino >= 18 &&
      listino >= perUnit * 1.8 &&
      (peerMedian == null || listino > peerMedian * 1.6 || nearRatio(perUnit, peerMedian))

    if (looksLikePackTotal) {
      return {
        prezzo_confezione: listino,
        prezzo_kg: null,
        peso_kg: null,
        prezzo_unita: perUnit,
        pack_size: packSize,
        formato: isListinoCaseUnitFormat(row.unita) ? 'cassa' : 'confezione',
      }
    }
  }

  if (peerMedian != null && unit > peerMedian * 2.2 && packSize && packSize >= 2) {
    const perUnit = roundMoney(listino / packSize)
    if (nearRatio(perUnit, peerMedian)) {
      return {
        prezzo_confezione: listino,
        prezzo_kg: null,
        peso_kg: null,
        prezzo_unita: perUnit,
        pack_size: packSize,
        formato: 'confezione',
      }
    }
  }

  return {
    prezzo_confezione: listino,
    prezzo_kg: null,
    peso_kg: null,
    prezzo_unita: unit,
    pack_size: null,
    formato: 'singolo',
  }
}

export function normalizeCompareDisplayRows<
  T extends {
    prodotto: string
    prezzo_listino?: number
    prezzo_confronto?: number
    prezzo_attuale?: number
    unita?: string | null
    note?: string | null
    pack_size?: number | null
    formato?: ComparableListinoPrice['formato']
  },
>(rows: T[]): Array<T & CompareRowDisplay> {
  const tentativeCompare = rows.map((row) => displayCompareRowPrices(row).prezzo_unita)

  for (let pass = 0; pass < 3; pass++) {
    const next: number[] = []
    for (let i = 0; i < rows.length; i++) {
      const peers = tentativeCompare.filter((_, j) => j !== i)
      next.push(displayCompareRowPrices(rows[i]!, peers).prezzo_unita)
    }
    const changed = next.some((v, i) => Math.abs(v - tentativeCompare[i]!) > 0.009)
    tentativeCompare.splice(0, tentativeCompare.length, ...next)
    if (!changed) break
  }

  return rows.map((row, index) => {
    const peers = tentativeCompare.filter((_, j) => j !== index)
    const display = displayCompareRowPrices(row, peers)
    return { ...row, ...display }
  })
}

export function compareDisplayPrice(row: CompareRowDisplay): number {
  return row.prezzo_kg ?? row.prezzo_unita
}

export function formatCompareWeightLabel(pesoKg: number | null | undefined): string | null {
  if (!pesoKg || pesoKg <= 0) return null
  if (pesoKg >= 1) {
    const rounded = roundMoney(pesoKg)
    return Number.isInteger(rounded) ? `${rounded} kg` : `${rounded} kg`
  }
  return `${Math.round(pesoKg * 1000)} g`
}

/** Pattern per pesi (550gr, 250g, 1kg) e formati confezione (24X, X6, 6x75cl). */
const DISPLAY_WEIGHT_PATTERN = /\b(\d+(?:[.,]\d+)?)\s*(kg|g|gr|grams?)\b|\b\d+\s*[xX×]\s*\d*\b|\bX\d+\b/gi

/**
 * Rimuove il token peso dal nome prodotto per la visualizzazione (es. "ALICI MARINATE RENNA 550gr (FH022)"
 * → "ALICI MARINATE RENNA (FH022)"). Usato per raggruppare prodotti con nomi simili.
 */
export function stripDisplayProductWeight(prodotto: string): string {
  return prodotto.replace(DISPLAY_WEIGHT_PATTERN, '').replace(/\s+/g, ' ').trim()
}

/**
 * Raggruppa un array di trend per nome prodotto normalizzato (senza peso).
 * Quando due trend hanno lo stesso nome normalizzato, vengono fusi.
 */
export function mergeTrendsByNormalizedName<T extends { prodotto: string }>(trends: T[]): T[] {
  const map = new Map<string, T>()
  for (const t of trends) {
    const key = stripDisplayProductWeight(t.prodotto).toLowerCase()
    const existing = map.get(key)
    if (!existing) {
      map.set(key, { ...t, prodotto: stripDisplayProductWeight(t.prodotto) })
    }
  }
  return Array.from(map.values())
}
