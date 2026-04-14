import AppShell from '@/components/AppShell'
import { getAppMeShellResult } from '@/lib/me-server'
import { getCookieStore } from '@/lib/locale-server'
import type { MeData } from '@/lib/me-context'

const SUPPORTED = ['it', 'en', 'fr', 'de', 'es']

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let initialLocale: string = 'en'
  let initialMe: MeData | null = null

  try {
    const cookieStore = await getCookieStore()
    const raw = cookieStore.get('app-locale')?.value ?? 'en'
    initialLocale = SUPPORTED.includes(raw) ? raw : 'en'
    const meRes = await getAppMeShellResult()
    initialMe = meRes.ok ? meRes.me : null
  } catch (e) {
    console.error('[AppLayout]', e)
  }

  return (
    <AppShell initialLocale={initialLocale} initialMe={initialMe}>
      {children}
    </AppShell>
  )
}
