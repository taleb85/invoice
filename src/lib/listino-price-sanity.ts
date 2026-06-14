/**
 * Heuristics per scartare prezzi listino da OCR che confondono quantità / unitario
 * con prezzo cassa (es. Minestrone £0.75 = qty, Menabrea £7 = casse) o il totale riga
 * al posto del prezzo unitario (es. £45.68 = 6 × £7.61).
 */

/** Confezioni tipiche wholesale (casse × unitario). */
const CASE_PACK_SIZES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 18, 20, 24] as const

/** IVA UK standard — per normalizzare un listino storico es-IVA. */
const UK_VAT_MULTIPLIER = 1.2

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

export type ListinoPriceRejectReason = 'price_outlier_ocr'

export function rejectReasonForListinoPrice(
  candidate: number,
  existingPrices: number[],
): ListinoPriceRejectReason | null {
  return isBadListinoOcrPrice(candidate, existingPrices) ? 'price_outlier_ocr' : null
}

/**
 * Prezzo da rimuovere o ignorare: qty OCR, unitario bottiglia, colonna sbagliata, ecc.
 */
export function isLikelyLineTotalOcrPrice(candidate: number, existingPrices: number[]): boolean {
  return inferUnitPriceFromLineTotal(candidate, existingPrices) != null
}

/**
 * Riferimento storico per inferire totale riga → unitario.
 * Con cluster bimodale (es. £3,12 qty OCR + £37,44 cassa) usa il cluster alto,
 * non il minimo che farebbe dividere un prezzo-cassa valido per 12.
 */
export function listinoHistRefForLineInference(existingPrices: number[]): number {
  const hist = existingPrices.filter((p) => Number.isFinite(p) && p > 0)
  if (hist.length === 0) return 0
  if (hist.length === 1) return hist[0]!
  const max = Math.max(...hist)
  const dom = dominantListinoPrice(hist)
  if (max > dom * 1.12) return max
  const min = Math.min(...hist)
  if (min > 0 && max / min >= 3.5) return max
  return dom
}

/**
 * Totale riga OCR ≈ qty × prezzo unitario abituale (es. £45.68 = 6 × £7.61).
 * Usa un riferimento robusto sullo storico e sceglie la confezione con
 * unitario più vicino a quel riferimento.
 */
export function inferUnitPriceFromLineTotal(
  candidate: number,
  existingPrices: number[],
): number | null {
  if (!Number.isFinite(candidate) || candidate <= 0) return null
  const hist = existingPrices.filter((p) => Number.isFinite(p) && p > 0)
  if (hist.length < 2) return null

  const maxHist = Math.max(...hist)
  if (maxHist > 0 && candidate >= maxHist * 0.88 && candidate <= maxHist * 1.15) {
    return null
  }

  const ref = listinoHistRefForLineInference(hist)
  if (ref <= 0 || candidate <= ref * 1.12) return null
  if (candidate / ref < 1.75) return null

  let bestUnit: number | null = null
  let bestDist = Infinity
  for (const qty of CASE_PACK_SIZES) {
    const unit = candidate / qty
    const dist = Math.abs(unit - ref)
    if (dist < bestDist) {
      bestDist = dist
      bestUnit = unit
    }
  }
  if (bestUnit == null || bestDist / ref > 0.1) return null
  return Math.round(bestUnit * 100) / 100
}

/**
 * Prezzo IVA inclusa letto al posto dell’esente (≈ ×1,2 rispetto allo storico).
 */
export function inferExVatUnitPrice(candidate: number, existingPrices: number[]): number | null {
  if (!Number.isFinite(candidate) || candidate <= 0) return null
  const hist = existingPrices.filter((p) => Number.isFinite(p) && p > 0)
  if (hist.length < 2) return null

  const ref = dominantListinoPrice(hist)
  if (ref <= 0 || candidate <= ref * 1.05) return null

  const exVat = candidate / UK_VAT_MULTIPLIER
  if (exVat >= ref * 0.92 && exVat <= ref * 1.08) {
    return Math.round(exVat * 100) / 100
  }
  return null
}

/** Prezzo unitario da mostrare / confrontare, corretto da OCR se possibile. */
export function resolveEffectiveListinoUnitPrice(
  prezzo: number,
  otherPrices: number[],
  opts?: { skipLineTotalInfer?: boolean },
): number {
  if (!Number.isFinite(prezzo) || prezzo <= 0) return prezzo
  const hist = otherPrices.filter((p) => Number.isFinite(p) && p > 0)
  const maxHist = hist.length > 0 ? Math.max(...hist) : 0

  // Prezzo già allineato al listino recente (es. £22,84 dopo £15,23): non correggere al ribasso.
  if (maxHist > 0 && prezzo >= maxHist * 0.88 && prezzo <= maxHist * 1.35) {
    return prezzo
  }

  const lineUnit = opts?.skipLineTotalInfer
    ? null
    : inferUnitPriceFromLineTotal(prezzo, otherPrices)
  if (lineUnit != null) {
    if (maxHist > 0 && lineUnit < maxHist * 0.92 && prezzo >= maxHist * 0.88) {
      return prezzo
    }
    return lineUnit
  }
  const exVat = inferExVatUnitPrice(prezzo, otherPrices)
  if (exVat != null) {
    if (maxHist > 0 && exVat < maxHist * 0.92 && prezzo >= maxHist * 0.88) {
      return prezzo
    }
    return exVat
  }
  return prezzo
}

export function isBadListinoOcrPrice(candidate: number, existingPrices: number[]): boolean {
  if (isLikelyQtyOcrPrice(candidate, existingPrices)) return true
  if (isLikelyLineTotalOcrPrice(candidate, existingPrices)) return true
  const hist = existingPrices.filter((p) => Number.isFinite(p) && p > 0)
  if (hist.length === 0) return false
  if (hist.length === 1) {
    const peer = hist[0]!
    if (peer >= 10 && candidate < 1) return true
    // Un solo peer: solo outlier estremi (es. qty 1,77 vs cassa 63,66).
    if (peer >= 15 && candidate < peer * 0.15) return true
    return false
  }
  return !isPlausibleListinoPrice(candidate, hist)
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
