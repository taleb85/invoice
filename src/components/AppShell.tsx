'use client'

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { usePathname, useRouter } from 'next/navigation'
import { UserProvider, useMe, type MeData } from '@/lib/me-context'
import { LocaleProvider, useLocale } from '@/lib/locale-context'
import { ActiveOperatorProvider, useActiveOperator } from '@/lib/active-operator-context'
import { ToastProvider } from '@/lib/toast-context'
import { localeFromCountryCode, type Locale } from '@/lib/translations'
import DashboardMobileBottomNav from './DashboardMobileBottomNav'
import { AppActivitiesProvider } from '@/lib/app-activities-context'
import { EmailSyncProgressProvider } from './EmailSyncProgressProvider'
import EmailSyncProgressBar from './EmailSyncProgressBar'
import { isFornitoreProfileRoute, normalizeAppPath, showsMobileBottomBar } from '@/lib/mobile-hub-routes'
import { NetworkProvider } from '@/lib/network-context'
import ConnectionStatusDot from '@/components/ConnectionStatusDot'
import AppShellActivityStrip from '@/components/AppShellActivityStrip'
import NavigationTopProgress, {
  APP_DESKTOP_HEADER_NAV_PROGRESS_ANCHOR_ID,
} from '@/components/NavigationTopProgress'

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

function readBrowserCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return m ? decodeURIComponent(m[1]) : ''
}

/**
 * Dopo il PIN operatore, `fluxo-acting-role` e `admin-sede-id` devono restare allineati
 * a `activeOperator` (persistito in localStorage). Se il cookie acting viene azzerato
 * (es. cambio sede) ma l’operatore resta in memoria, il server mostra il banner cyan
 * mentre la UI è ancora “da operatore”.
 */
function AdminActingRoleCookieSync() {
  const { me } = useMe()
  const { activeOperator } = useActiveOperator()
  const router = useRouter()

  useEffect(() => {
    if (!me?.is_admin || !activeOperator?.sede_id) return
    if (readBrowserCookie('fluxo-acting-role')) return
    const ar = activeOperator.role === 'admin_sede' ? 'admin_sede' : 'operatore'
    document.cookie = `admin-sede-id=${encodeURIComponent(activeOperator.sede_id)}; path=/; SameSite=Strict`
    document.cookie = `fluxo-acting-role=${encodeURIComponent(ar)}; path=/; SameSite=Strict`
    router.refresh()
  }, [me?.is_admin, activeOperator?.id, activeOperator?.sede_id, activeOperator?.role, router])

  return null
}

export default function AppShell({
  children,
  initialLocale,
  initialMe,
}: {
  children: React.ReactNode
  initialLocale?: string
  initialMe?: MeData | null
}) {
  return (
    <LocaleProvider initialLocale={initialLocale}>
      <UserProvider initialMe={initialMe}>
        <NetworkProvider>
        <LocaleSyncFromSede />
        <ActiveOperatorProvider>
          <AdminActingRoleCookieSync />
          <ToastProvider>
            <EmailSyncProgressProvider>
              <AppActivitiesProvider>
                <AppShellMain>{children}</AppShellMain>
              </AppActivitiesProvider>
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
  const { me, loading } = useMe()
  const [desktopNavHost, setDesktopNavHost] = useState<HTMLDivElement | null>(null)
  const bindDesktopNavHost = useCallback((el: HTMLDivElement | null) => {
    setDesktopNavHost(el)
  }, [])
  /** Dock compatto (solo icone) per operatore hub; dock più alto con riga operatore per admin e scheda fornitore. */
  const tallMobileDock =
    (loading && !me) || me?.is_admin || isFornitoreProfileRoute(normalized)
  const hubBottomPad = tallMobileDock
    ? 'pb-[calc(10.5rem+env(safe-area-inset-bottom,0px))]'
    : 'pb-[calc(7.25rem+env(safe-area-inset-bottom,0px))]'
  return (
    <div className="h-full flex">
      <SidebarController />
      <main
        className={`flex min-h-0 flex-1 flex-col overflow-y-auto bg-gradient-to-br from-[#020817] via-[#0f172a] to-[#0a1628] text-slate-200 md:pt-0 ${
          normalized === '/bolle/new' ? 'pt-0' : 'pt-14'
        } ${hub ? `${hubBottomPad} md:pb-0` : ''}`}
      >
        {/* Desktop: sotto l’area header layout. Mobile: stato rete è in `MobileTopbar`. */}
        <div className="relative hidden w-full min-w-0 shrink-0 items-center gap-3 border-b border-slate-800/30 bg-slate-950/40 px-3 py-2.5 backdrop-blur-sm md:flex md:min-h-[50px] md:sticky md:top-0 md:z-[30]">
          <div className="min-w-0 flex-1">
            <AppShellActivityStrip />
          </div>
          <div className="shrink-0">
            <ConnectionStatusDot />
          </div>
          <div
            ref={bindDesktopNavHost}
            id={APP_DESKTOP_HEADER_NAV_PROGRESS_ANCHOR_ID}
            className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 overflow-hidden"
            aria-hidden
          />
        </div>
        <NavigationTopProgress desktopHost={desktopNavHost} />
        <EmailSyncProgressBar />
        {children}
      </main>
    </div>
  )
}
