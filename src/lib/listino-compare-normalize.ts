import {
  isListinoCaseUnitFormat,
  parseListinoNoteParts,
  parsePackSizeFromListinoUnita,
} from '@/lib/listino-display'
import { resolveListinoUnitPriceForDisplay } from '@/lib/listino-invoice-line-normalize'

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
  const display = resolveListinoUnitPriceForDisplay(opts.prezzo, opts.note, opts.otherPrices)
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
    const display = resolveListinoUnitPriceForDisplay(item.prezzo, item.note, item.otherPrices)
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
