'use client'

/**
 * Locale Context — auto-detection + reactive i18n
 *
 * Priority:
 *  1. Saved cookie  `app-locale`  (user's explicit preference)
 *  2. navigator.language           (browser/OS language)
 *  3. Fallback 'en'
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

/* ─── Supported locales ────────────────────────────────────────────── */
const SUPPORTED: Locale[] = ['it', 'en', 'fr', 'de', 'es']
const COOKIE_NAME = 'app-locale'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

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
  const langs = navigator.languages?.length
    ? [...navigator.languages]
    : [navigator.language]

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

/* ─── Context types ────────────────────────────────────────────────── */
interface LocaleContextValue {
  locale: Locale
  t: Translations
  setLocale: (l: Locale) => void
  /** true only on the very first render (SSR safe) */
  isFirstSession: boolean
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: 'en',
  t: getTranslations('en'),
  setLocale: () => {},
  isFirstSession: false,
})

/* ─── Provider ─────────────────────────────────────────────────────── */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en') // SSR-safe default
  const [isFirstSession, setIsFirstSession] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const saved = readCookie(COOKIE_NAME) as Locale
    let detected: Locale

    if (saved && SUPPORTED.includes(saved)) {
      detected = saved
    } else {
      detected = detectLocaleFromBrowser()
      setIsFirstSession(true) // first time — came from browser detection
    }

    setLocaleState(detected)
    writeCookie(COOKIE_NAME, detected)
    setMounted(true)
  }, [])

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l)
    writeCookie(COOKIE_NAME, l)
    setIsFirstSession(false)
  }, [])

  if (!mounted) {
    /* Render children without translations (avoids hydration mismatch).
       Components that read `t` should only render labels after mount. */
    return (
      <LocaleContext.Provider value={{ locale: 'en', t: getTranslations('en'), setLocale, isFirstSession: false }}>
        {children}
      </LocaleContext.Provider>
    )
  }

  return (
    <LocaleContext.Provider value={{ locale, t: getTranslations(locale), setLocale, isFirstSession }}>
      {children}
    </LocaleContext.Provider>
  )
}

/* ─── Consumer hook ────────────────────────────────────────────────── */
export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext)
}
