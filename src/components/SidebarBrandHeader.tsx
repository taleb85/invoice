'use client'

import dynamic from 'next/dynamic'
import { usePathname, useRouter } from 'next/navigation'
import OperatorDesktopWorkspaceHeader from '@/components/OperatorDesktopWorkspaceHeader'
import { normalizeAppPath } from '@/lib/mobile-hub-routes'
import { SmartPairLogo } from '@/components/smart-pair-logo'
const ScanEmailButton = dynamic(() => import('@/components/ScanEmailButton'), { ssr: false, loading: () => null })
import { useDesktopHeaderPageActionsRegisterHost } from '@/components/DesktopHeaderPageActions'

/** Bersaglio portal per azioni pagina (es. dashboard) nella barra desktop sopra il main. */
export const DESKTOP_HEADER_PAGE_ACTIONS_ANCHOR_ID = 'desktop-header-page-actions'

/**
 * Fascia brand 40px (md+): logo, tagline (tap → home).
 * Fascia brand in cima al solo `aside` (colonna sinistra fissa) in `AppShell`.
 */
export function SidebarRailBrand() {
  const router = useRouter()
  const { t } = useLocale()

  return (
    <div className="app-shell-rail-panel flex h-full min-h-[40px] w-full shrink-0 flex-row items-center gap-1.5 px-2 text-app-fg lg:gap-2 lg:px-2.5">
      <div
        className="app-shell-rail-panel flex min-w-0 flex-1 cursor-pointer items-center gap-1.5"
        onClick={() => {
          if (typeof window === 'undefined' || window.innerWidth < 768) return
          router.push('/')
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return
          e.preventDefault()
          if (typeof window === 'undefined' || window.innerWidth < 768) return
          router.push('/')
        }}
      >
        <SmartPairLogo variant="full" size="sm" className="shrink-0" />
      </div>
    </div>
  )
}

/**
 * Fascia desktop sopra il main: portal azioni pagina + Sincronizza email.
 * Host per `NavigationTopProgress` (`desktopHost` in AppShell).
 */
export function DesktopHeaderActionsStrip() {
  const registerPageActionsHost = useDesktopHeaderPageActionsRegisterHost()
  const pathname = usePathname()
  /**
   * Sync email nel menu «Strumenti» (`DashboardHeaderSedeToolsMenu`) su quasi tutte le pagine.
   * Solo sotto `/fornitori` la strip operatore è nascosta: qui serve il pulsante dedicato in barra.
   */
  const showHeaderScanEmail = normalizeAppPath(pathname ?? '').startsWith('/fornitori')

  return (
    <div className="flex min-h-0 min-w-0 flex-1 items-center justify-end gap-1.5 self-stretch bg-transparent ps-1.5 pe-2 text-app-fg sm:gap-2 sm:pe-2.5">
      <div
        ref={registerPageActionsHost}
        id={DESKTOP_HEADER_PAGE_ACTIONS_ANCHOR_ID}
        data-fluxo-desktop-header-actions-host
        className="flex min-h-0 min-w-0 max-w-full flex-1 items-center justify-end gap-1.5 bg-transparent sm:gap-2"
      >
        <OperatorDesktopWorkspaceHeader />
      </div>
      {showHeaderScanEmail ? <ScanEmailButton placement="desktopHeader" /> : null}
    </div>
  )
}
