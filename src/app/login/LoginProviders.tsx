'use client'

import type { ReactNode } from 'react'
import { LocaleProvider } from '@/lib/locale-context'
import { UserProvider, type MeData } from '@/lib/me-context'

export default function LoginProviders({
  initialLocale,
  initialMe = null,
  children,
}: {
  initialLocale?: string
  initialMe?: MeData | null
  children: ReactNode
}) {
  return (
    <LocaleProvider initialLocale={initialLocale}>
      <UserProvider initialMe={initialMe}>{children}</UserProvider>
    </LocaleProvider>
  )
}
