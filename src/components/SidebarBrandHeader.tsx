'use client'

import dynamic from 'next/dynamic'
import { usePathname, useRouter } from 'next/navigation'
import OperatorDesktopWorkspaceHeader from '@/components/OperatorDesktopWorkspaceHeader'
import { normalizeAppPath } from '@/lib/mobile-hub-routes'
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

  return (
    <div className="app-shell-rail-panel flex h-full min-h-[40px] w-full shrink-0 flex-row items-center px-3 text-app-fg lg:px-3.5">
      <div
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5"
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
        {/* Inline icon — 30×30, two arrows */}
        <svg
          viewBox="0 0 72 72"
          className="h-[30px] w-[30px] shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          <rect width="72" height="72" rx="16" fill="#0f2a4a" />
          <path d="M24 50 L30 18 L36 50 L33 50 L33 56 L27 56 L27 50 Z" fill="#22d3ee" />
          <path d="M36 22 L42 54 L48 22 L45 22 L45 16 L39 16 L39 22 Z" fill="#5b7cf9" />
        </svg>

        {/* Wordmark — HTML text so page fonts apply */}
        <div className="min-w-0 leading-none">
          <div className="flex items-baseline gap-[3px]">
            <span
              className="text-[13px] tracking-tight lg:text-[14px]"
              style={{ fontWeight: 600, color: '#22d3ee' }}
            >
              Smart
            </span>
            <span
              className="text-[13px] tracking-tight lg:text-[14px]"
              style={{ fontWeight: 300, color: '#ecfeff' }}
            >
              Pair
            </span>
          </div>
        </div>
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
