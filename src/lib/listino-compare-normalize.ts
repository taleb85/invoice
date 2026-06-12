import {
  isListinoCaseUnitFormat,
  listinoPerPiecePriceHint,
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

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

function median(values: number[]): number | null {
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

function pickPackSplitPrice(
  displayPrice: number,
  packSize: number,
  refUnit: number | null,
): number | null {
  if (packSize < 2 || !Number.isFinite(displayPrice) || displayPrice <= 0) return null
  const perPiece = roundMoney(displayPrice / packSize)
  if (perPiece <= 0 || perPiece >= displayPrice * 0.999) return null

  if (refUnit != null && refUnit > 0) {
    if (displayPrice >= refUnit * 0.85 && displayPrice <= refUnit * 1.25) {
      return displayPrice
    }
    if (perPiece >= refUnit * 0.55 && perPiece <= refUnit * 1.65) {
      return perPiece
    }
    return null
  }

  if (displayPrice >= 18 && perPiece <= displayPrice * 0.45) {
    return perPiece
  }
  return null
}

/**
 * Normalizza un prezzo listino a unità confrontabile (bottiglia/pezzo).
 * Usa nota, formato unità e contesto degli altri risultati della ricerca.
 */
export function resolveComparableListinoPrice(opts: {
  prezzo: number
  note: string | null | undefined
  prodotto: string
  otherPrices: number[]
  searchMedianUnit?: number | null
}): ComparableListinoPrice {
  const parsed = parseListinoNoteParts(opts.note)
  const unita = parsed.unita?.trim() || null
  const display = resolveListinoUnitPriceForDisplay(opts.prezzo, opts.note, opts.otherPrices)
  const refUnit = opts.searchMedianUnit ?? median(opts.otherPrices)

  const hint = listinoPerPiecePriceHint({
    displayUnitPrice: display,
    unita,
    otherPrices: opts.otherPrices,
  })
  if (hint) {
    return {
      prezzo_listino: display,
      prezzo_confronto: hint.perPiecePrice,
      pack_size: hint.packSize,
      unita,
      formato: isListinoCaseUnitFormat(unita) ? 'cassa' : 'confezione',
    }
  }

  const packFromUnita = parsePackSizeFromListinoUnita(unita)
  if (packFromUnita) {
    const split = pickPackSplitPrice(display, packFromUnita, refUnit)
    if (split != null && split < display * 0.95) {
      return {
        prezzo_listino: display,
        prezzo_confronto: split,
        pack_size: packFromUnita,
        unita,
        formato: 'confezione',
      }
    }
  }

  if (isListinoCaseUnitFormat(unita)) {
    const caseMatch = unita?.match(/^[xX×]\s*(\d{1,3})/) ?? unita?.match(/^[xX×](\d{2,3})/)
    const caseSize = caseMatch ? parseInt(caseMatch[1]!, 10) : null
    if (caseSize && caseSize >= 2) {
      const split = pickPackSplitPrice(display, caseSize, refUnit)
      if (split != null && split < display * 0.95) {
        return {
          prezzo_listino: display,
          prezzo_confronto: split,
          pack_size: caseSize,
          unita,
          formato: 'cassa',
        }
      }
    }
  }

  const packFromName = inferPackCountFromProductName(opts.prodotto)
  if (packFromName) {
    const split = pickPackSplitPrice(display, packFromName, refUnit)
    if (split != null && split < display * 0.95) {
      return {
        prezzo_listino: display,
        prezzo_confronto: split,
        pack_size: packFromName,
        unita,
        formato: 'confezione',
      }
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
