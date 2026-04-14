import { cache } from 'react'
import { cookies } from 'next/headers'
import { type Locale, getTranslations } from './translations'

/** Evita letture ripetute di `cookies()` nella stessa richiesta RSC. */
export const getCookieStore = cache(async () => cookies())
import {
  LOCALE_COOKIE,
  CURRENCY_COOKIE,
  TIMEZONE_COOKIE,
  formatDate,
  formatCurrency,
} from './locale-shared'

export { LOCALE_COOKIE, CURRENCY_COOKIE, TIMEZONE_COOKIE, formatDate, formatCurrency }

export async function getLocale(): Promise<Locale> {
  const store = await getCookieStore()
  const raw = store.get(LOCALE_COOKIE)?.value
  const supported: Locale[] = ['it', 'en', 'fr', 'de', 'es']
  if (raw && supported.includes(raw as Locale)) return raw as Locale
  return 'en'
}

export async function getCurrency(): Promise<string> {
  const store = await getCookieStore()
  return store.get(CURRENCY_COOKIE)?.value ?? 'EUR'
}

export async function getTimezone(): Promise<string> {
  const store = await getCookieStore()
  return store.get(TIMEZONE_COOKIE)?.value ?? 'UTC'
}

export async function getT() {
  const locale = await getLocale()
  return getTranslations(locale)
}

/** Effective sede_id: solo per Admin Master usa il cookie `admin-sede-id`. */
export async function getEffectiveSedeId(userSedeId: string | null, isMasterAdmin: boolean): Promise<string | null> {
  if (!isMasterAdmin) return userSedeId
  const store = await getCookieStore()
  return store.get('admin-sede-id')?.value ?? null
}
