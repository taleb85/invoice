'use client'

import { useLocale } from './locale-context'
import type { Translations } from './translations'

/** Same `t` as {@link LocaleProvider} — avoids cookie-only drift from `useT`. */
export function useT(): Translations {
  const { t } = useLocale()
  return t
}

/** Alias di {@link useT} — stesso hook; non re-esportare da `translations.ts` (ciclo SSR con `locale-context`). */
export const useTranslations = useT
