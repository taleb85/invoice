import { cookies } from 'next/headers'
import { type Locale, getTranslations } from './translations'

export const LOCALE_COOKIE = 'app-locale'
export const CURRENCY_COOKIE = 'app-currency'
export const TIMEZONE_COOKIE = 'app-timezone'

export async function getLocale(): Promise<Locale> {
  const store = await cookies()
  return (store.get(LOCALE_COOKIE)?.value as Locale) ?? 'it'
}

export async function getCurrency(): Promise<string> {
  const store = await cookies()
  return store.get(CURRENCY_COOKIE)?.value ?? 'EUR'
}

export async function getTimezone(): Promise<string> {
  const store = await cookies()
  return store.get(TIMEZONE_COOKIE)?.value ?? 'Europe/Rome'
}

export async function getT() {
  const locale = await getLocale()
  return getTranslations(locale)
}

export function formatDate(
  d: string,
  locale: Locale = 'it',
  timezone = 'Europe/Rome',
  opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }
) {
  const intlLocale =
    locale === 'it' ? 'it-IT'
    : locale === 'en' ? 'en-GB'
    : locale === 'es' ? 'es-ES'
    : locale === 'fr' ? 'fr-FR'
    : 'de-DE'
  return new Intl.DateTimeFormat(intlLocale, { ...opts, timeZone: timezone }).format(new Date(d))
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
