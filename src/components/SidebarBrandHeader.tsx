'use client'

import { usePathname, useRouter } from 'next/navigation'
import OperatorDesktopWorkspaceHeader from '@/components/OperatorDesktopWorkspaceHeader'
import { useLocale } from '@/lib/locale-context'
import { normalizeAppPath } from '@/lib/mobile-hub-routes'
import ScanEmailButton from '@/components/ScanEmailButton'
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
        <svg
          viewBox="0 0 96 56"
          className="h-[26px] w-[2.65rem] shrink-0 lg:h-[28px] lg:w-[2.9rem]"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          <defs>
            <linearGradient id="fx-rail-card-bg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1e3a5f" />
              <stop offset="100%" stopColor="#172554" />
            </linearGradient>
            <linearGradient id="fx-rail-wave" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#5b7cf9" />
              <stop offset="50%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#22d3ee" />
            </linearGradient>
            <filter id="fx-rail-wave-fluo" x="-60%" y="-60%" width="220%" height="220%" filterUnits="objectBoundingBox">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.2" result="b1" />
              <feGaussianBlur in="SourceGraphic" stdDeviation="4.5" result="b2" />
              <feMerge>
                <feMergeNode in="b2" />
                <feMergeNode in="b1" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <rect width="56" height="56" rx="13" fill="url(#fx-rail-card-bg)" />
          <path
            d="M7 28 C18 10, 34 10, 48 28 S72 46, 88 28"
            stroke="url(#fx-rail-wave)"
            strokeWidth="3.5"
            fill="none"
            strokeLinecap="round"
            filter="url(#fx-rail-wave-fluo)"
          />
          <circle cx="7" cy="28" r="3.5" fill="#5b7cf9" />
          <circle cx="48" cy="28" r="3.5" fill="#38bdf8" />
          <circle cx="88" cy="28" r="3.5" fill="#22d3ee" />
        </svg>

        <div className="app-shell-rail-panel min-w-0">
          <svg
            viewBox="0 0 130 32"
            className="h-auto max-w-[min(100%,5.25rem)] w-[4.75rem] lg:w-[5.6rem]"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
          >
            <defs>
              <linearGradient id="fx-rail-text" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#6b8ef5" />
                <stop offset="100%" stopColor="#22d3ee" />
              </linearGradient>
            </defs>
            <text
              x="0"
              y="24"
              fontFamily="Arial Black, Arial, sans-serif"
              fontWeight="900"
              fontSize="24"
              fill="url(#fx-rail-text)"
            >
              FLUXO
            </text>
          </svg>
          <p className="-mt-0.5 truncate text-[8px] font-semibold uppercase tracking-wider text-app-fg-muted lg:text-[9px]">
            {t.ui.tagline}
          </p>
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
