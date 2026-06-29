import { parseListinoNoteParts } from '@/lib/listino-display'

/** Aliquota IVA standard per sede quando non indicata in fattura/nota. */
const STANDARD_VAT_PERCENT_BY_COUNTRY: Record<string, number> = {
  UK: 20,
  GB: 20,
  IT: 22,
  FR: 20,
  DE: 19,
  ES: 21,
}

const ALCOHOL_PRODUCT_REGEX =
  /\b(?:prosecco|spumante|champagne|cava|wine|vino|beer|lager|ale|cider|spirit|vodka|gin|whisky|whiskey|rum|brandy|liqueur|vermouth|sherry|port|amaro|grappa|brut|docg?|igt|igp)\b/i

const ZERO_RATED_FOOD_REGEX =
  /\b(?:prosciutto|prosc\.?|ham|salame|salami|mortadella|pancetta|speck|bresaola|carne|meat|beef|pork|lamb|veal|chicken|pollo|tacchino|turkey|manzo|maiale|agnello|vitello|formaggio|cheese|mozzarella|burro|butter|latte|milk|uova|eggs|farina|flour|riso|rice|pasta|pane|bread|verdura|vegetable|fruit|frutta|pesce|fish|salmone|salmon|tonno|tuna|pomodor|tomato|patate|potato|funghi|mushroom|olio|olive|yogurt|yoghurt|panna|cream|negrini|rigatoni|linguine|paccheri|spaghetti|penne|fettuccine|tagliatelle|fusilli|lasagne|tortellini|ravioli|gnocchi|maccheroni|conchiglie|farfalle|de cecco|dalla costa|fratelli|pastaio)\b/i

/** Legge l'aliquota IVA salvata in nota listino (`IVA: 0%`, `VAT: 20`, …). */
export function parseListinoVatRatePercent(note: string | null | undefined): number | null {
  if (!note?.trim()) return null
  const ivaMatch = note.match(/\b(?:IVA|VAT|TVA|MwSt|USt)\s*:\s*(\d+(?:[.,]\d+)?)\s*%?/i)
  if (ivaMatch) {
    const n = parseFloat(ivaMatch[1]!.replace(',', '.'))
    if (Number.isFinite(n) && n >= 0 && n <= 100) return n
  }
  const machineMatch = note.match(/\|listino_vat:(\d+(?:\.\d+)?)\|/i)
  if (machineMatch) {
    const n = parseFloat(machineMatch[1]!)
    if (Number.isFinite(n) && n >= 0 && n <= 100) return n
  }
  if (/\b(?:zero\s*rated|zero-rated|ZR|esente|exempt|vat\s*free|iva\s*0)\b/i.test(note)) {
    return 0
  }
  return null
}

export function formatListinoVatNote(aliquotaIva: number | null | undefined): string | null {
  if (aliquotaIva == null || !Number.isFinite(aliquotaIva)) return null
  if (aliquotaIva < 0 || aliquotaIva > 100) return null
  return `IVA: ${Math.round(aliquotaIva * 100) / 100}%`
}

/** Bevande alcoliche / vino — di solito IVA piena (UK 20%). */
export function isAlcoholListinoProduct(prodotto: string): boolean {
  const name = prodotto.trim()
  if (!name) return false
  if (ALCOHOL_PRODUCT_REGEX.test(name)) return true
  if (/\d+\s*[xX×/]\s*\d+\s*cl\b/i.test(name) && /\b(?:75|70|37\.?5|50)\s*cl\b/i.test(name)) {
    return true
  }
  return false
}

/**
 * Alimenti di base / carne / formaggio venduti a peso — spesso IVA 0% su fatture UK wholesale.
 * Esclude alcol e bevande analcoliche confezionate.
 */
export function isLikelyZeroRatedFoodListinoProduct(
  prodotto: string,
  unita?: string | null,
): boolean {
  const name = prodotto.trim()
  if (!name || isAlcoholListinoProduct(name)) return false
  if (/\b(?:soft\s*drink|soda|cola|energy\s*drink|juice\s*drink)\b/i.test(name)) return false

  const parsedUnita = unita?.trim() || ''
  const isWeightUnit =
    /^kg$/i.test(parsedUnita) ||
    /\bkg\b/i.test(name) ||
    /\b\d+\s*kg\b/i.test(name) ||
    /\b1\s*\/\s*2\s*\d*\s*kg\b/i.test(name)

  if (!isWeightUnit && !ZERO_RATED_FOOD_REGEX.test(name)) return false
  return ZERO_RATED_FOOD_REGEX.test(name) || (isWeightUnit && !/\b(?:wine|beer|water)\b/i.test(name))
}

export function standardListinoVatPercent(countryCode: string | null | undefined): number {
  const cc = (countryCode ?? '').trim().toUpperCase()
  return STANDARD_VAT_PERCENT_BY_COUNTRY[cc] ?? 0
}

/** Aliquota effettiva per una riga listino (nota fattura > euristica prodotto > default sede). */
export function resolveListinoVatRatePercent(
  countryCode: string | null | undefined,
  opts?: { note?: string | null; prodotto?: string; unita?: string | null },
): number {
  const fromNote = parseListinoVatRatePercent(opts?.note)
  if (fromNote != null) return fromNote

  const cc = (countryCode ?? '').trim().toUpperCase()
  const standard = standardListinoVatPercent(cc)
  if (standard <= 0) return 0

  const prodotto = opts?.prodotto?.trim() ?? ''
  const unita = opts?.unita?.trim() || parseListinoNoteParts(opts?.note).unita

  if (cc === 'UK' || cc === 'GB') {
    if (prodotto && isAlcoholListinoProduct(prodotto)) return 20
    if (prodotto && isLikelyZeroRatedFoodListinoProduct(prodotto, unita)) return 0
  }

  return standard
}

export function listinoVatMultiplier(countryCode: string | null | undefined): number {
  const rate = standardListinoVatPercent(countryCode)
  if (rate <= 0) return 1
  return 1 + rate / 100
}

export function listinoVatMultiplierForRow(
  countryCode: string | null | undefined,
  opts?: { note?: string | null; prodotto?: string; unita?: string | null },
): number {
  const rate = resolveListinoVatRatePercent(countryCode, opts)
  if (rate <= 0) return 1
  return Math.round((1 + rate / 100) * 10000) / 10000
}

export function listinoPricesIncludeVat(countryCode: string | null | undefined): boolean {
  return standardListinoVatPercent(countryCode) > 0
}

export function listinoRowShowsVatInDisplay(
  countryCode: string | null | undefined,
  opts?: { note?: string | null; prodotto?: string; unita?: string | null },
): boolean {
  return listinoVatMultiplierForRow(countryCode, opts) > 1.001
}

export function finalizeListinoImportVatRate(
  line: { prodotto: string; unita?: string | null; aliquota_iva?: number | null },
  countryCode: string | null | undefined,
): number | null {
  const n = line.aliquota_iva
  if (n == null || !Number.isFinite(n) || n < 0 || n > 100) return null
  void countryCode
  return Math.round(n * 100) / 100
}

export type ListinoVatRowContext = {
  note?: string | null
  prodotto?: string
  unita?: string | null
}

export function applyListinoVatForDisplay(
  price: number,
  countryCode: string | null | undefined,
  opts?: ListinoVatRowContext,
): number {
  if (!Number.isFinite(price)) return price
  const mult = listinoVatMultiplierForRow(countryCode, opts)
  if (mult <= 1) return price
  return Math.round(price * mult * 100) / 100
}

export function listinoVatMultiplierForRowFromNote(opts?: ListinoVatRowContext): number {
  const rate = parseListinoVatRatePercent(opts?.note)
  if (rate == null || rate <= 0) return 1
  return Math.round((1 + rate / 100) * 10000) / 10000
}

export function listinoRowShowsVatInDisplayFromNote(opts?: ListinoVatRowContext): boolean {
  return listinoVatMultiplierForRowFromNote(opts) > 1.001
}

export function applyListinoVatForDisplayFromNote(price: number, opts?: ListinoVatRowContext): number {
  if (!Number.isFinite(price)) return price
  const mult = listinoVatMultiplierForRowFromNote(opts)
  if (mult <= 1) return price
  return Math.round(price * mult * 100) / 100
}
