'use client'

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { usePathname, useRouter } from 'next/navigation'
import { UserProvider, useMe, type MeData } from '@/lib/me-context'
import { LocaleProvider, useLocale } from '@/lib/locale-context'
import {
  ActiveOperatorProvider,
  useActiveOperator,
  FLUXO_ACTIVE_OPERATOR_KEY,
  FLUXO_ACTIVE_OPERATOR_USER_KEY,
} from '@/lib/active-operator-context'
import { effectiveIsMasterAdminPlane } from '@/lib/effective-operator-ui'
import {
  ToastProvider,
  desktopHeaderBarSurfaceClass,
  useDesktopHeaderToastBanner,
} from '@/lib/toast-context'
import { localeFromCountryCode, type Locale } from '@/lib/translations'
import DashboardMobileBottomNav from './DashboardMobileBottomNav'
import { AppActivitiesProvider } from '@/lib/app-activities-context'
import { EmailSyncProgressProvider } from './EmailSyncProgressProvider'
import EmailSyncProgressBar from './EmailSyncProgressBar'
import { isFornitoreProfileRoute, normalizeAppPath, showsMobileBottomBar } from '@/lib/mobile-hub-routes'
import { NetworkProvider } from '@/lib/network-context'
import ConnectionStatusDot from '@/components/ConnectionStatusDot'
import DesktopHeaderToolbar from '@/components/DesktopHeaderToolbar'
import AppShellActivityStrip from '@/components/AppShellActivityStrip'
import NavigationTopProgress, {
  APP_DESKTOP_HEADER_NAV_PROGRESS_ANCHOR_ID,
} from '@/components/NavigationTopProgress'
import { SidebarBrandHeader } from '@/components/SidebarBrandHeader'
import { useManualDeliverySede } from '@/lib/use-effective-sede-id'
import { useNotificationCounts } from '@/lib/use-notification-counts'

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

/**
 * L’operatore in localStorage è valido solo per l’account che ha inserito il PIN.
 * Senza questo, un nuovo login (es. Gustavo) mostrerebbe ancora TALEB dal browser precedente.
 */
function ActiveOperatorSessionReconcile() {
  const { me } = useMe()
  const { clearActiveOperator } = useActiveOperator()

  useEffect(() => {
    const uid = me?.user?.id?.trim()
    if (!uid) return
    try {
      const raw = localStorage.getItem(FLUXO_ACTIVE_OPERATOR_KEY)
      const bound = localStorage.getItem(FLUXO_ACTIVE_OPERATOR_USER_KEY)
      if (!raw) {
        if (bound) localStorage.removeItem(FLUXO_ACTIVE_OPERATOR_USER_KEY)
        return
      }
      if (!bound || bound !== uid) {
        clearActiveOperator()
      }
    } catch {
      /* ignore */
    }
  }, [me?.user?.id, clearActiveOperator])

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
          <ActiveOperatorSessionReconcile />
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

function desktopToastBannerTextClass(
  banner: ReturnType<typeof useDesktopHeaderToastBanner>
): string {
  if (!banner) return ''
  if (banner.type === 'success') return 'text-emerald-50'
  if (banner.type === 'error') return 'text-red-50'
  return 'text-slate-100'
}

function AppShellMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const normalized = normalizeAppPath(pathname ?? '')
  const hub = showsMobileBottomBar()
  const { me, loading } = useMe()
  const { activeOperator } = useActiveOperator()
  const { effectiveSedeId } = useManualDeliverySede()
  const isAdmin = Boolean(me?.is_admin)
  const { badgeCount: headerNotificationBadgeCount } = useNotificationCounts({
    isAdmin,
    effectiveSedeId,
    initialAdminErrors: 0,
    initialOperatorPending: 0,
    initialOperatorLogErrors: 0,
  })
  const headerToastBanner = useDesktopHeaderToastBanner()
  const headerNavBarSurface = desktopHeaderBarSurfaceClass(headerToastBanner)
  const headerBannerTextCls = desktopToastBannerTextClass(headerToastBanner)
  const [desktopNavHost, setDesktopNavHost] = useState<HTMLDivElement | null>(null)
  const bindDesktopNavHost = useCallback((el: HTMLDivElement | null) => {
    setDesktopNavHost(el)
  }, [])
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  /** Dock compatto (solo icone) per operatore hub; dock più alto con riga operatore per admin e scheda fornitore. */
  const tallMobileDock =
    (loading && !me) ||
    effectiveIsMasterAdminPlane(me, activeOperator) ||
    isFornitoreProfileRoute(normalized)
  const hubBottomPad = tallMobileDock
    ? 'pb-[calc(10.5rem+env(safe-area-inset-bottom,0px))]'
    : 'pb-[calc(7.25rem+env(safe-area-inset-bottom,0px))]'
  return (
    <div className="flex h-full flex-col">
      {/* Desktop: un’unica striscia — brand sidebar | attività / toast / rete */}
      <div
        ref={bindDesktopNavHost}
        id={APP_DESKTOP_HEADER_NAV_PROGRESS_ANCHOR_ID}
        className={`relative z-30 hidden w-full shrink-0 items-stretch overflow-visible backdrop-blur-sm transition-[background,box-shadow,border-color] duration-300 md:flex md:min-h-[50px] ${headerNavBarSurface}`}
      >
        <div className="relative z-20 w-56 shrink-0 overflow-x-hidden">
          <div className="flex h-full min-h-[50px] min-w-0 items-stretch">
            <SidebarBrandHeader
              collapsed={sidebarCollapsed}
              onExpand={() => setSidebarCollapsed(false)}
            />
          </div>
        </div>
        <div className="relative z-10 flex min-h-[50px] min-w-0 flex-1 items-center gap-3 overflow-visible px-3 py-2.5">
          <div className="relative z-[2] min-w-0 flex-1 overflow-hidden">
            <AppShellActivityStrip />
          </div>
          {headerToastBanner ? (
            <div
              className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center px-28 sm:px-36"
              aria-live="polite"
              role="status"
            >
              <span
                className={`max-w-full truncate text-center text-sm font-semibold leading-tight ${headerBannerTextCls}`}
              >
                {headerToastBanner.message}
              </span>
            </div>
          ) : null}
          <div className="relative z-[2] flex shrink-0 items-center gap-2">
            <DesktopHeaderToolbar workspaceAlert={headerNotificationBadgeCount > 0} />
            <ConnectionStatusDot />
          </div>
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1">
        <SidebarController
          sidebarCollapsed={sidebarCollapsed}
          onSidebarCollapsedChange={setSidebarCollapsed}
        />
        <main
          data-app-main-scroll
          className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-gradient-to-br from-zinc-600 via-zinc-700 to-zinc-800 text-slate-100 md:pt-0 ${
            normalized === '/bolle/new' ? 'pt-0' : 'pt-14'
          } ${hub ? `${hubBottomPad} md:pb-0` : ''}`}
        >
          <NavigationTopProgress placement="belowMobileTopbar" desktopHost={desktopNavHost} />
          <EmailSyncProgressBar />
          {children}
        </main>
      </div>
    </div>
  )
}
