'use client'

import { useEffect } from 'react'
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { UserProvider, useMe } from '@/lib/me-context'
import { LocaleProvider, useLocale } from '@/lib/locale-context'
import { ActiveOperatorProvider } from '@/lib/active-operator-context'
import { ToastProvider } from '@/lib/toast-context'
import { localeFromCountryCode, type Locale } from '@/lib/translations'
import DashboardMobileBottomNav from './DashboardMobileBottomNav'
import { EmailSyncProgressProvider } from './EmailSyncProgressProvider'
import EmailSyncProgressBar from './EmailSyncProgressBar'
import { normalizeAppPath, showsMobileBottomBar } from '@/lib/mobile-hub-routes'
import { NetworkProvider } from '@/lib/network-context'
import ConnectionStatusDot from '@/components/ConnectionStatusDot'

const SidebarController   = dynamic(() => import('./SidebarController'),    { ssr: false })
const OperatorSwitchModal = dynamic(() => import('./OperatorSwitchModal'), { ssr: false })

/**
 * Syncs locale, currency and timezone from the active sede when the user
 * has no explicit cookie preference (first session or sede change).
 */
function LocaleSyncFromSede() {
  const { me } = useMe()
  const { setLocale, setCurrency, setTimezone } = useLocale()

  useEffect(() => {
    if (!me) return

    const cookieVal = (name: string) => {
      if (typeof document === 'undefined') return ''
      const m = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'))
      return m ? decodeURIComponent(m[1]) : ''
    }

    // UI language: only auto-set from sede if the user has NEVER chosen
    // a language explicitly (no cookie). A manual choice from the sidebar
    // or Settings always takes priority and is never overridden here.
    if (me.country_code && !cookieVal('app-locale')) {
      setLocale(localeFromCountryCode(me.country_code) as Locale)
    }

    // Currency: sync from sede only if no user override
    if (me.currency && !cookieVal('app-currency')) {
      setCurrency(me.currency)
    }

    // Timezone: sync from sede only if no user override
    if (me.timezone && !cookieVal('app-timezone')) {
      setTimezone(me.timezone)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.country_code, me?.currency, me?.timezone])

  return null
}

export default function AppShell({ children, initialLocale }: { children: React.ReactNode; initialLocale?: string }) {
  return (
    <LocaleProvider initialLocale={initialLocale}>
      <UserProvider>
        <NetworkProvider>
        <LocaleSyncFromSede />
        <ActiveOperatorProvider>
          <ToastProvider>
            <EmailSyncProgressProvider>
              <AppShellMain>{children}</AppShellMain>
            </EmailSyncProgressProvider>
            <DashboardMobileBottomNav />
            <OperatorSwitchModal />
          </ToastProvider>
        </ActiveOperatorProvider>
        </NetworkProvider>
      </UserProvider>
    </LocaleProvider>
  )
}

function AppShellMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const normalized = normalizeAppPath(pathname ?? '')
  const hub = showsMobileBottomBar(normalized)
  /** Spazio sotto il contenuto: allineato all’altezza di `DashboardMobileBottomNav` (padding + area sicura). */
  const hubBottomPad = 'pb-[calc(8.5rem+env(safe-area-inset-bottom,0px))]'
  return (
    <div className="h-full flex">
      <SidebarController />
      <main
        className={`flex min-h-0 flex-1 flex-col overflow-y-auto bg-gradient-to-br from-[#020817] via-[#0f172a] to-[#0a1628] pt-14 text-slate-200 md:pt-0 ${
          hub ? `${hubBottomPad} md:pb-0` : ''
        }`}
      >
        <div className="flex shrink-0 items-center justify-end border-b border-slate-800/30 bg-slate-950/40 px-3 py-1.5 backdrop-blur-sm md:sticky md:top-0 md:z-[30]">
          <ConnectionStatusDot />
        </div>
        <EmailSyncProgressBar />
        {children}
      </main>
    </div>
  )
}
