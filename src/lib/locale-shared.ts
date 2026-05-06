import { type Locale } from './translations'

export const LOCALE_COOKIE = 'app-locale'
export const CURRENCY_COOKIE = 'app-currency'
export const TIMEZONE_COOKIE = 'app-timezone'

const DEFAULT_DATE_DISPLAY_OPTS: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
}

/**
 * Data di calendario da Postgres (`date`) o serializzazioni «solo giorno» a mezzanotte UTC.
 * In questi casi `new Date(iso)` + fuso utente può mostrare il giorno sbagliato (es. americhe).
 */
function calendarYmdFromDbString(s: string): { y: number; m: number; d: number } | null {
  const t = s.trim()
  const plain = t.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (plain) {
    return { y: Number(plain[1]), m: Number(plain[2]), d: Number(plain[3]) }
  }
  const midnightUtc = t.match(/^(\d{4})-(\d{2})-(\d{2})T00:00:00(?:\.\d+)?(?:Z|[+-]00:00)?$/)
  if (midnightUtc) {
    return { y: Number(midnightUtc[1]), m: Number(midnightUtc[2]), d: Number(midnightUtc[3]) }
  }
  return null
}

export function formatDate(
  d: string,
  locale: Locale = 'it',
  timezone = 'Europe/Rome',
  opts?: Intl.DateTimeFormatOptions
) {
  const intlLocale =
    locale === 'it' ? 'it-IT'
    : locale === 'en' ? 'en-GB'
    : locale === 'es' ? 'es-ES'
    : locale === 'fr' ? 'fr-FR'
    : 'de-DE'
  const merged: Intl.DateTimeFormatOptions = { ...DEFAULT_DATE_DISPLAY_OPTS, ...opts }

  const cal = calendarYmdFromDbString(d)
  const parsed = cal
    ? new Date(Date.UTC(cal.y, cal.m - 1, cal.d, 12, 0, 0))
    : new Date(d)
  if (!Number.isFinite(parsed.getTime())) return ''

  const tz = cal ? 'UTC' : timezone
  let out = new Intl.DateTimeFormat(intlLocale, { ...merged, timeZone: tz }).format(parsed)
  if (locale === 'it' && merged.month === 'short') {
    out = out.toLocaleLowerCase('it-IT')
  }
  return out
}

/** Mese per esteso + anno, tutto in maiuscolo (es. it: «MARZO 2026»). */
export function formatMonthYearUppercase(
  d: string,
  locale: Locale = 'it',
  timezone = 'Europe/Rome'
): string {
  const cal = calendarYmdFromDbString(d)
  const parsed = cal
    ? new Date(Date.UTC(cal.y, cal.m - 1, cal.d, 12, 0, 0))
    : new Date(d)
  if (!Number.isFinite(parsed.getTime())) return ''
  const intlLocale =
    locale === 'it' ? 'it-IT'
    : locale === 'en' ? 'en-GB'
    : locale === 'es' ? 'es-ES'
    : locale === 'fr' ? 'fr-FR'
    : 'de-DE'
  const tz = cal ? 'UTC' : timezone
  const out = new Intl.DateTimeFormat(intlLocale, {
    month: 'long',
    year: 'numeric',
    timeZone: tz,
  }).format(parsed)
  return out.toLocaleUpperCase(intlLocale)
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
