import { type Locale } from './translations'

export const LOCALE_COOKIE = 'app-locale'
export const CURRENCY_COOKIE = 'app-currency'
export const TIMEZONE_COOKIE = 'app-timezone'

export function formatDate(
  d: string,
  locale: Locale = 'it',
  timezone = 'Europe/Rome',
  opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }
) {
  const parsed = new Date(d)
  if (!Number.isFinite(parsed.getTime())) return ''
  const intlLocale =
    locale === 'it' ? 'it-IT'
    : locale === 'en' ? 'en-GB'
    : locale === 'es' ? 'es-ES'
    : locale === 'fr' ? 'fr-FR'
    : 'de-DE'
  let out = new Intl.DateTimeFormat(intlLocale, { ...opts, timeZone: timezone }).format(parsed)
  if (locale === 'it') {
    out = out.toLocaleLowerCase('it-IT')
  }
  return out
}

export function formatCurrency(amount: number, currencyCode = 'EUR', locale: Locale = 'it') {
  const intlLocale =
    locale === 'it' ? 'it-IT'
    : locale === 'en' ? 'en-GB'
    : locale === 'es' ? 'es-ES'
    : locale === 'fr' ? 'fr-FR'
    : 'de-DE'
  return new Intl.NumberFormat(intlLocale, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
  }).format(amount)
}
