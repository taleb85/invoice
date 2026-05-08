import type { Locale, Translations } from './translations/types'

export type { Locale, Translations } from './translations/types'
export {
  COUNTRY_TO_LOCALE,
  localeFromCountryCode,
  LOCALES,
  CURRENCIES,
  TIMEZONES,
} from './translations/types'

export async function getTranslations(locale: Locale = 'en'): Promise<Translations> {
  const mod = await import(`./translations/${locale}`)
  return mod.default
}
