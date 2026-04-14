import AppShell from '@/components/AppShell'
import { getAppMeShellResult } from '@/lib/me-server'
import { getCookieStore } from '@/lib/locale-server'

const SUPPORTED = ['it', 'en', 'fr', 'de', 'es']

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await getCookieStore()
  const raw = cookieStore.get('app-locale')?.value ?? 'en'
  const initialLocale = SUPPORTED.includes(raw) ? raw : 'en'

  const meRes = await getAppMeShellResult()
  const initialMe = meRes.ok ? meRes.me : null

  return (
    <AppShell initialLocale={initialLocale} initialMe={initialMe}>
      {children}
    </AppShell>
  )
}
