'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
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
import NavigationTopProgress, {
  APP_DESKTOP_HEADER_NAV_PROGRESS_ANCHOR_ID,
} from '@/components/NavigationTopProgress'
import { DesktopHeaderActionsStrip, SidebarRailBrand } from '@/components/SidebarBrandHeader'
import { DesktopHeaderPageActionsProvider } from '@/components/DesktopHeaderPageActions'
import BranchSessionGate from '@/components/BranchSessionGate'

const SidebarController = dynamic(() => import('./SidebarController'), { ssr: false })
const Sidebar = dynamic(() => import('./Sidebar'), { ssr: false })
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
  return 'text-app-fg'
}

function AppShellMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const normalized = normalizeAppPath(pathname ?? '')
  const hub = showsMobileBottomBar()
  const { me, loading } = useMe()
  const { activeOperator } = useActiveOperator()
  const headerToastBanner = useDesktopHeaderToastBanner()
  const headerNavBarSurface = desktopHeaderBarSurfaceClass(headerToastBanner)
  /** Toast success/error: superficie opaca. Altrimenti trasparente su md (gradiente sul contenitore griglia). */
  const desktopHeaderCanvas =
    headerToastBanner && headerToastBanner.type !== 'info'
      ? headerNavBarSurface
      : 'md:bg-transparent md:shadow-none [color:var(--app-fg-body)]'
  const headerBannerTextCls = desktopToastBannerTextClass(headerToastBanner)
  const [desktopNavHost, setDesktopNavHost] = useState<HTMLDivElement | null>(null)
  const bindDesktopNavHost = useCallback((el: HTMLDivElement | null) => {
    setDesktopNavHost(el)
  }, [])
  /** Dock compatto (solo icone) per operatore hub; dock più alto con riga operatore per admin e scheda fornitore. */
  const tallMobileDock =
    (loading && !me) ||
    effectiveIsMasterAdminPlane(me, activeOperator) ||
    isFornitoreProfileRoute(normalized)
  const hubBottomPad = tallMobileDock
    ? 'pb-[calc(10.5rem+env(safe-area-inset-bottom,0px))]'
    : 'pb-[calc(7.25rem+env(safe-area-inset-bottom,0px))]'
  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-slate-950">
      <DesktopHeaderPageActionsProvider>
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[var(--app-layout-max-width)] flex-col">
        {/*
          Desktop: griglia a una riga — (1) `aside` unico: brand + `Sidebar`;
          (2) colonna destra unica: `#app-desktop-header-nav-progress` + `main` nello stesso contenitore flex.
        */}
        <div className="app-shell-workspace-canvas flex min-h-0 min-w-0 flex-1 flex-col md:grid md:min-h-0 md:grid-cols-[13rem_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)] lg:grid-cols-[14rem_minmax(0,1fr)]">
          <SidebarController />
          <aside
            suppressHydrationWarning
            aria-label="Navigazione principale"
            className={[
              'app-sidebar-aside app-shell-rail-clear hidden min-h-0 w-full min-w-0 shrink-0 md:col-start-1 md:row-start-1 md:flex md:h-full md:min-h-0 md:flex-col md:self-stretch md:overflow-visible md:relative md:z-auto',
            ].join(' ')}
          >
            <div className="app-shell-rail-panel flex shrink-0 border-b border-app-line-25 md:min-h-[48px]">
              <SidebarRailBrand />
            </div>
            <Sidebar />
          </aside>
          <div
            data-app-desktop-canvas
            className="flex min-h-0 min-w-0 flex-1 flex-col bg-transparent md:col-start-2 md:row-start-1 md:h-full md:min-h-0 md:overflow-hidden"
          >
            <div
              ref={bindDesktopNavHost}
              id={APP_DESKTOP_HEADER_NAV_PROGRESS_ANCHOR_ID}
              className={`relative z-30 hidden min-h-0 min-w-0 shrink-0 overflow-visible border-b border-app-line-25 transition-[background,box-shadow] duration-300 md:flex md:min-h-[48px] md:w-full ${desktopHeaderCanvas}`}
            >
              <div className="relative z-20 flex min-h-[48px] min-w-0 flex-1 items-stretch overflow-visible">
                <DesktopHeaderActionsStrip />
              </div>
              {headerToastBanner ? (
                <div
                  className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center px-28 sm:px-36"
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
            </div>
            <main
              id="app-main"
              data-app-main-scroll
              className={`app-main-workspace-scroll flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto ps-[env(safe-area-inset-left,0px)] pe-[env(safe-area-inset-right,0px)] md:pt-0 ${
                normalized === '/bolle/new'
                  ? 'pt-0'
                  : 'pt-[calc(3.5rem+env(safe-area-inset-top,0px))]'
              } ${hub ? `${hubBottomPad} md:pb-0` : ''}`}
            >
              <Suspense fallback={null}>
                <NavigationTopProgress placement="belowMobileTopbar" desktopHost={desktopNavHost} />
              </Suspense>
              <EmailSyncProgressBar />
              <BranchSessionGate>{children}</BranchSessionGate>
            </main>
          </div>
        </div>
      </div>
      </DesktopHeaderPageActionsProvider>
    </div>
  )
}
