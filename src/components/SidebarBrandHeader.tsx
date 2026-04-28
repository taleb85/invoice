'use client'

import { usePathname, useRouter } from 'next/navigation'
import useSWR from 'swr'
import OperatorDesktopWorkspaceHeader from '@/components/OperatorDesktopWorkspaceHeader'
import { normalizeAppPath } from '@/lib/mobile-hub-routes'
import EmailSyncToolbarStatus from '@/components/EmailSyncToolbarStatus'
import type { OperatorWorkspaceHeaderPayload } from '@/types/operator-workspace-header'
import { useDesktopHeaderPageActionsRegisterHost } from '@/components/DesktopHeaderPageActions'
import AppBuildInfo from '@/components/AppBuildInfo'

const operatorHeaderFetcher = (url: string): Promise<OperatorWorkspaceHeaderPayload | null> =>
  fetch(url).then((r) => (r.ok ? r.json() : null))

/**
 * Su `/fornitori/...` la strip operatore desktop è nascosta: mostra solo stato sync IMAP (cron).
 */
function FornitoreStripEmailSyncStatus() {
  const { data } = useSWR<OperatorWorkspaceHeaderPayload | null>('/api/operator-workspace-header', operatorHeaderFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 20_000,
    refreshInterval: 60_000,
  })
  if (!data?.operatorScoped) return null
  return (
    <span className="inline-flex max-w-[min(100%,300px)] items-center rounded-md border border-app-line-35 app-workspace-inset-bg px-2 py-1 shadow-sm">
      <EmailSyncToolbarStatus lastImapSyncAt={data.lastImapSyncAt ?? null} lastImapSyncError={data.lastImapSyncError ?? null} />
    </span>
  )
}

/** Bersaglio portal per azioni pagina (es. dashboard) nella barra desktop sopra il main. */
export const DESKTOP_HEADER_PAGE_ACTIONS_ANCHOR_ID = 'desktop-header-page-actions'

/**
 * Fascia brand 40px (md+): logo, tagline (tap → home).
 * Fascia brand in cima al solo `aside` (colonna sinistra fissa) in `AppShell`.
 */
export function SidebarRailBrand() {
  const router = useRouter()

  return (
    <div className="app-shell-rail-panel flex h-full min-h-[52px] w-full min-w-0 shrink-0 flex-row items-center gap-1.5 px-2 text-app-fg sm:gap-2 sm:px-3 lg:px-3.5">
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
        {/* Icon container — 28×28 */}
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#0f2a4a] ring-1 ring-[#22d3ee]/30">
          <svg width="16" height="16" viewBox="0 0 40 40" fill="none" aria-hidden>
            <path
              d="M4 20 L16 8 L16 15 L28 15 L28 20"
              stroke="#22d3ee"
              strokeWidth="4.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <path
              d="M36 20 L24 32 L24 25 L12 25 L12 20"
              stroke="#5b7cf9"
              strokeWidth="4.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* Wordmark */}
        <div className="min-w-0 flex items-baseline gap-1 leading-none">
          <span
            className="font-outfit text-[15px] tracking-tight"
            style={{ fontWeight: 600, color: '#22d3ee' }}
          >
            Smart
          </span>
          <span
            className="font-outfit text-[15px] tracking-tight"
            style={{ fontWeight: 300, color: 'rgb(255 255 255 / 0.85)' }}
          >
            Pair
          </span>
        </div>
      </div>
      <div className="flex h-full min-h-[52px] shrink-0 items-center">
        <AppBuildInfo variant="rail" />
      </div>
    </div>
  )
}

/**
 * Fascia desktop sopra il main: portal azioni pagina + stato sync email (cron).
 * Host per `NavigationTopProgress` (`desktopHost` in AppShell).
 */
export function DesktopHeaderActionsStrip() {
  const registerPageActionsHost = useDesktopHeaderPageActionsRegisterHost()
  const pathname = usePathname()
  /**
   * Host flex-1 per eventuali azioni di pagina (portal); duplicati / solleciti / sync email sono sulla strip come sibling fuori dall’host.
   * Solo sotto `/fornitori` la strip operatore è nascosta: qui si mostra lo stato IMAP.
   */
  const showHeaderScanEmail = normalizeAppPath(pathname ?? '').startsWith('/fornitori')

  return (
    <div className="flex min-h-0 min-w-0 flex-1 items-center justify-end gap-1.5 self-stretch bg-transparent ps-1.5 pe-2 text-app-fg sm:gap-2 sm:pe-2.5">
      <div
        ref={registerPageActionsHost}
        id={DESKTOP_HEADER_PAGE_ACTIONS_ANCHOR_ID}
        data-fluxo-desktop-header-actions-host
        className="flex min-h-0 min-w-0 max-w-full flex-1 items-center justify-end gap-1.5 bg-transparent sm:gap-2"
      />
      <OperatorDesktopWorkspaceHeader />
      {showHeaderScanEmail ? <FornitoreStripEmailSyncStatus /> : null}
    </div>
  )
}
