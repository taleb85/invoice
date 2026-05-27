/**
 * Heuristics per scartare prezzi listino da OCR che confondono quantità / unitario
 * con prezzo cassa (es. Minestrone £0.75 = qty, Menabrea £7 = casse).
 */

function median(values: number[]): number {
  const cleaned = values.filter((v) => Number.isFinite(v) && v > 0)
  if (cleaned.length === 0) return 0
  const sorted = [...cleaned].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

/**
 * `true` se il prezzo candidato è plausibile rispetto allo storico dello stesso prodotto.
 * Con meno di 2 letture precedenti non filtra (serve storico minimo).
 */
export function isPlausibleListinoPrice(candidate: number, existingPrices: number[]): boolean {
  if (!Number.isFinite(candidate) || candidate <= 0) return false

  const hist = existingPrices.filter((p) => Number.isFinite(p) && p > 0)
  if (hist.length < 2) return true

  const med = median(hist)
  if (med <= 0) return true

  const minP = Math.min(...hist)
  const maxP = Math.max(...hist)

  // Prodotto venduto a cassa (decine di £): valori < £1 sono quasi sempre qty/unitario OCR.
  if (med >= 10 && candidate < 1) return false

  // Scostamento estremo verso il basso rispetto al cluster abituale (qty al posto del prezzo).
  if (med >= 5 && candidate < med * 0.25) return false

  // Serie bimodale (mix unitario + cassa): il candidato deve stare in un cluster esistente.
  if (minP > 0 && maxP / minP > 2.5) {
    const highCutoff = maxP * 0.5
    if (candidate >= highCutoff) return true
    const lo = med * 0.5
    const hi = med * 1.5
    return candidate >= lo && candidate <= hi
  }

  // Serie omogenea: banda ampia ma non assurda.
  return candidate >= med * 0.15 && candidate <= med * 3
}

export type ListinoPriceRejectReason = 'price_outlier_likely_qty'

export function rejectReasonForListinoPrice(
  candidate: number,
  existingPrices: number[],
): ListinoPriceRejectReason | null {
  return isPlausibleListinoPrice(candidate, existingPrices) ? null : 'price_outlier_likely_qty'
}

/** Prezzo più frequente nello storico (approssimato al centesimo). */
function dominantListinoPrice(hist: number[]): number {
  const buckets = new Map<number, number>()
  for (const p of hist) {
    const b = Math.round(p * 100) / 100
    buckets.set(b, (buckets.get(b) ?? 0) + 1)
  }
  let best = median(hist)
  let maxCount = 0
  for (const [price, count] of buckets) {
    if (count > maxCount) {
      maxCount = count
      best = price
    }
  }
  return best
}

/**
 * Più restrittivo di `isPlausibleListinoPrice`: solo pattern tipici qty OCR
 * (0.75, 7 casse, …), non prezzi unitari bottiglia legittimi (£1.48, £8.36).
 */
export function isLikelyQtyOcrPrice(candidate: number, existingPrices: number[]): boolean {
  const hist = existingPrices.filter((p) => Number.isFinite(p) && p > 0)
  if (hist.length < 2) return false

  const med = median(hist)
  if (med <= 0) return false

  // Quantità frazionaria (0.75 casse / kg) scambiata per prezzo
  if (med >= 10 && candidate < 1) return true

  const wholeQty = Math.abs(candidate - Math.round(candidate)) < 0.001
  if (!wholeQty || candidate < 1 || candidate > 24) return false

  const dominant = dominantListinoPrice(hist)
  // Intero 1–24 ben sotto il prezzo listino ricorrente (es. 7 casse vs £8.53/cassa)
  if (dominant >= 5 && candidate < dominant * 0.85) return true

  return false
}
