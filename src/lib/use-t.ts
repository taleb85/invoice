'use client'

import { useState, useEffect } from 'react'
import { getTranslations, type Translations } from './translations'

type Locale = Parameters<typeof getTranslations>[0]

function readLocaleCookie(): Locale {
  const match = document.cookie.match(/(?:^|;\s*)app-locale=([^;]*)/)
  return (match ? match[1] : 'it') as Locale
}

// Always start with 'it' so server and client first render match,
// then switch to the real locale after hydration.
export function useT(): Translations {
  const [t, setT] = useState<Translations>(() => getTranslations('it'))

  useEffect(() => {
    const locale = readLocaleCookie()
    setT(getTranslations(locale))
  }, [])

  return t
}
