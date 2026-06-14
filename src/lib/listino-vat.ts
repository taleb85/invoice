/**
 * IVA standard per sede — i prezzi listino da fattura B2B UK/EU sono quasi sempre
 * netti (esente); in UI mostriamo il costo effettivo IVA inclusa.
 */
const VAT_MULTIPLIER_BY_COUNTRY: Record<string, number> = {
  UK: 1.2,
  GB: 1.2,
  IT: 1.22,
  FR: 1.2,
  DE: 1.19,
  ES: 1.21,
}

export function listinoVatMultiplier(countryCode: string | null | undefined): number {
  const cc = (countryCode ?? '').trim().toUpperCase()
  return VAT_MULTIPLIER_BY_COUNTRY[cc] ?? 1
}

export function listinoPricesIncludeVat(countryCode: string | null | undefined): boolean {
  return listinoVatMultiplier(countryCode) > 1
}

export function applyListinoVatForDisplay(
  price: number,
  countryCode: string | null | undefined,
): number {
  if (!Number.isFinite(price)) return price
  const mult = listinoVatMultiplier(countryCode)
  if (mult <= 1) return price
  return Math.round(price * mult * 100) / 100
}
