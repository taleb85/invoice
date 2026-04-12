'use client'

/**
 * Locale Context — auto-detection + reactive i18n + reactive currency/timezone.
 *
 * Priority for locale:
 *  1. Saved cookie  `app-locale`   (user's explicit preference)
 *  2. navigator.language            (browser/OS language)
 *  3. Fallback 'en'
 *
 * Priority for currency/timezone:
 *  1. Saved cookie  `app-currency` / `app-timezone`
 *  2. Derived from `me.currency` / `me.timezone`  (set by AppShell)
 *  3. Hard defaults ('GBP', 'Europe/London')
 *
 * Separate from country/fiscal terms (localization.ts) which follow the
 * sede's country_code for VAT/TVA/IVA labels.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react'
import { type Locale, getTranslations, type Translations } from './translations'

/* ─── Supported locales ─────────────────────────────────────────────── */
const SUPPORTED: Locale[] = ['it', 'en', 'fr', 'de', 'es']
const LOCALE_COOKIE   = 'app-locale'
const CURRENCY_COOKIE = 'app-currency'
const TIMEZONE_COOKIE = 'app-timezone'
const COOKIE_MAX_AGE  = 60 * 60 * 24 * 365 // 1 year

/* ─── navigator.language → Locale mapping ──────────────────────────── */
const LANG_MAP: Record<string, Locale> = {
  it: 'it', 'it-IT': 'it', 'it-CH': 'it',
  en: 'en', 'en-GB': 'en', 'en-US': 'en', 'en-AU': 'en', 'en-CA': 'en',
  fr: 'fr', 'fr-FR': 'fr', 'fr-BE': 'fr', 'fr-CH': 'fr', 'fr-CA': 'fr',
  de: 'de', 'de-DE': 'de', 'de-AT': 'de', 'de-CH': 'de',
  es: 'es', 'es-ES': 'es', 'es-MX': 'es', 'es-AR': 'es',
}

function detectLocaleFromBrowser(): Locale {
  if (typeof navigator === 'undefined') return 'en'
  const langs = navigator.languages?.length ? [...navigator.languages] : [navigator.language]
  for (const lang of langs) {
    if (LANG_MAP[lang]) return LANG_MAP[lang]
    const base = lang.split('-')[0]
    if (SUPPORTED.includes(base as Locale)) return base as Locale
  }
  return 'en'
}

function readCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return m ? decodeURIComponent(m[1]) : ''
}

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
}

/* ─── Context types ─────────────────────────────────────────────────── */
interface LocaleContextValue {
  locale:      Locale
  t:           Translations
  setLocale:   (l: Locale) => void
  /** ISO 4217 currency code (reactive, stored in cookie) */
  currency:    string
  setCurrency: (c: string) => void
  /** IANA timezone (reactive, stored in cookie) */
  timezone:    string
  setTimezone: (tz: string) => void
  /** true only on the very first render (SSR safe) */
  isFirstSession: boolean
}

const LocaleContext = createContext<LocaleContextValue>({
  locale:      'en',
  t:           getTranslations('en'),
  setLocale:   () => {},
  currency:    'GBP',
  setCurrency: () => {},
  timezone:    'UTC',
  setTimezone: () => {},
  isFirstSession: false,
})

/* ─── Provider ──────────────────────────────────────────────────────── */
export function LocaleProvider({ children, initialLocale }: { children: ReactNode; initialLocale?: string }) {
  const resolvedInitial: Locale =
    initialLocale && SUPPORTED.includes(initialLocale as Locale)
      ? (initialLocale as Locale)
      : 'en'

  const [locale, setLocaleState]     = useState<Locale>(resolvedInitial)
  const [currency, setCurrencyState] = useState<string>('GBP')
  const [timezone, setTimezoneState] = useState<string>('UTC')
  const [isFirstSession, setIsFirstSession] = useState(false)

  useEffect(() => {
    // Locale
    const saved = readCookie(LOCALE_COOKIE) as Locale
    if (!saved || !SUPPORTED.includes(saved)) {
      const detected = detectLocaleFromBrowser()
      setLocaleState(detected)
      writeCookie(LOCALE_COOKIE, detected)
      setIsFirstSession(true)
    }

    // Currency
    const savedCurrency = readCookie(CURRENCY_COOKIE)
    if (savedCurrency) setCurrencyState(savedCurrency)

    // Timezone
    const savedTz = readCookie(TIMEZONE_COOKIE)
    if (savedTz) setTimezoneState(savedTz)
  }, [])

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l)
    writeCookie(LOCALE_COOKIE, l)
    setIsFirstSession(false)
    // Notify listeners that only subscribe to the custom event (legacy)
    window.dispatchEvent(new CustomEvent('fluxo:locale', { detail: l }))
  }, [])

  const setCurrency = useCallback((c: string) => {
    setCurrencyState(c)
    writeCookie(CURRENCY_COOKIE, c)
  }, [])

  const setTimezone = useCallback((tz: string) => {
    setTimezoneState(tz)
    writeCookie(TIMEZONE_COOKIE, tz)
  }, [])

  return (
    <LocaleContext.Provider value={{
      locale, t: getTranslations(locale), setLocale,
      currency, setCurrency,
      timezone, setTimezone,
      isFirstSession,
    }}>
      {children}
    </LocaleContext.Provider>
  )
}

/* ─── Consumer hook ─────────────────────────────────────────────────── */
export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext)
}
