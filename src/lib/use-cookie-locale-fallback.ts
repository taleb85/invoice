'use client'

import { useSyncExternalStore } from 'react'
import type { Locale } from '@/lib/translations'

const SUPPORTED: Locale[] = ['it', 'en', 'fr', 'de', 'es']
const COOKIE = 'app-locale'

function readLocaleFromCookie(): Locale {
  if (typeof document === 'undefined') return 'en'
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]*)`))
  const raw = m ? decodeURIComponent(m[1]) : ''
  return SUPPORTED.includes(raw as Locale) ? (raw as Locale) : 'en'
}

/**
 * Locale from `app-locale` cookie for surfaces outside LocaleProvider
 * (e.g. root error boundaries). Server snapshot and unknown cookie → `en`.
 */
export function useCookieLocaleFallback(): Locale {
  return useSyncExternalStore(
    () => () => {},
    readLocaleFromCookie,
    () => 'en'
  )
}
