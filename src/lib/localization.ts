/**
 * Localizzazione multi-paese per Fluxo.
 *
 * Mappa i codici paese ISO-2 alle etichette fiscali locali,
 * alla valuta corretta e al formato numerico.
 */

export type CountryCode = 'UK' | 'IT' | 'FR' | 'DE' | 'ES'

export interface CountryLocale {
  /** Abbreviazione imposta sul valore aggiunto locale (es. VAT, TVA, IVA) */
  vat: string
  /** Etichetta completa del numero fiscale IVA (es. "VAT No.", "P.IVA", "N° TVA") */
  vatLabel: string
  /** Etichetta per l'identificativo fiscale alternativo (es. UTR, SIRET, Steuernr.) */
  taxId: string
  /** Codice valuta ISO 4217 (es. GBP, EUR) */
  currency: string
  /** Locale BCP-47 per Intl.NumberFormat (es. "en-GB", "it-IT") */
  currencyLocale: string
  /** Emoji bandiera */
  flag: string
  /** Nome del paese in italiano */
  name: string
}

const LOCALES: Record<CountryCode, CountryLocale> = {
  UK: {
    vat:            'VAT',
    vatLabel:       'VAT No.',
    taxId:          'UTR',
    currency:       'GBP',
    currencyLocale: 'en-GB',
    flag:           '🇬🇧',
    name:           'Regno Unito',
  },
  IT: {
    vat:            'IVA',
    vatLabel:       'P.IVA',
    taxId:          'Cod. Fiscale',
    currency:       'EUR',
    currencyLocale: 'it-IT',
    flag:           '🇮🇹',
    name:           'Italia',
  },
  FR: {
    vat:            'TVA',
    vatLabel:       'N° TVA',
    taxId:          'SIRET',
    currency:       'EUR',
    currencyLocale: 'fr-FR',
    flag:           '🇫🇷',
    name:           'Francia',
  },
  DE: {
    vat:            'MwSt',
    vatLabel:       'USt-IdNr.',
    taxId:          'Steuernr.',
    currency:       'EUR',
    currencyLocale: 'de-DE',
    flag:           '🇩🇪',
    name:           'Germania',
  },
  ES: {
    vat:            'IVA',
    vatLabel:       'NIF/CIF',
    taxId:          'NIF',
    currency:       'EUR',
    currencyLocale: 'es-ES',
    flag:           '🇪🇸',
    name:           'Spagna',
  },
}

/** Restituisce il profilo locale per il codice paese fornito. Fallback: UK. */
export function getLocale(countryCode: string | null | undefined): CountryLocale {
  return LOCALES[(countryCode ?? 'UK') as CountryCode] ?? LOCALES.UK
}

/**
 * Formatta un importo nella valuta e nel formato del paese.
 *
 * @param amount        - Importo numerico
 * @param countryCode   - Codice paese ISO-2 usato per derivare locale e valuta di default
 * @param currencyOverride - Codice valuta ISO-4217 esplicito (sovrascrive quello derivato dal paese)
 */
export function formatCurrency(
  amount: number | null | undefined,
  countryCode: string | null | undefined,
  currencyOverride?: string | null,
): string {
  if (amount === null || amount === undefined) return '—'
  const loc = getLocale(countryCode)
  const currency = currencyOverride?.trim() || loc.currency
  try {
    return new Intl.NumberFormat(loc.currencyLocale, {
      style:    'currency',
      currency,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

/**
 * Formatta un numero rispettando il separatore decimale/migliaia del paese.
 * Utile quando si vuole mostrare un numero senza simbolo di valuta.
 */
export function formatNumber(
  amount: number | null | undefined,
  countryCode: string | null | undefined,
  decimals = 2,
): string {
  if (amount === null || amount === undefined) return '—'
  const loc = getLocale(countryCode)
  try {
    return new Intl.NumberFormat(loc.currencyLocale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount)
  } catch {
    return amount.toFixed(decimals)
  }
}

/** Elenco ordinato dei paesi supportati (per UI dropdown). */
export const COUNTRY_OPTIONS: { code: CountryCode; name: string; flag: string }[] = [
  { code: 'UK', name: 'Regno Unito', flag: '🇬🇧' },
  { code: 'IT', name: 'Italia',      flag: '🇮🇹' },
  { code: 'FR', name: 'Francia',     flag: '🇫🇷' },
  { code: 'DE', name: 'Germania',    flag: '🇩🇪' },
  { code: 'ES', name: 'Spagna',      flag: '🇪🇸' },
]
