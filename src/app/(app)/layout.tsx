import { cookies } from 'next/headers'
import AppShell from "@/components/AppShell";

const SUPPORTED = ['it', 'en', 'fr', 'de', 'es']

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Legge il cookie lato server: locale coerente tra SSR e client sin dal primo render.
  const cookieStore = await cookies()
  const raw = cookieStore.get('app-locale')?.value ?? 'en'
  const initialLocale = SUPPORTED.includes(raw) ? raw : 'en'

  return <AppShell initialLocale={initialLocale}>{children}</AppShell>
}
