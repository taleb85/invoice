'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useT } from '@/lib/use-t'
import { useManualDeliverySede } from '@/lib/use-effective-sede-id'
import HubScannerIcon from '@/components/HubScannerIcon'
import { SCANNER_FLOW_MOBILE_TITLE_FRAME } from '@/lib/scanner-flow-title-frame'

/** CTA Scanner AI sopra le icone del glass dock (solo home + sede operativa). */
export default function DashboardHomeScannerDockCta() {
  const pathname = usePathname() ?? ''
  const t = useT()
  const { visible } = useManualDeliverySede()
  if (pathname !== '/' && pathname !== '') return null
  if (!visible) return null

  return (
    <div className="w-full shrink-0 border-b border-app-line-15 pb-2.5 pt-0.5">
      <div className="flex justify-center px-1">
        <Link
          href="/bolle/new"
          prefetch={false}
          aria-label={`${t.nav.bottomNavScannerAi}. ${t.dashboard.scannerMobileTileTap}`}
          className="group flex w-full max-w-[min(100%,20rem)] touch-manipulation rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400/55 active:scale-[0.985]"
        >
          <div
            className={`dashboard-scanner-mobile-tile-pulse m-0 flex w-full min-w-[14rem] min-h-[40px] flex-row flex-nowrap items-center justify-start gap-2 px-3.5 py-1.5 text-left font-normal transition-all duration-200 sm:min-h-[44px] sm:gap-2.5 sm:px-4 sm:py-2 ${SCANNER_FLOW_MOBILE_TITLE_FRAME} group-hover:border-cyan-400/40 group-hover:from-app-line-20 group-hover:to-cyan-500/10 group-hover:shadow-[0_0_28px_-6px_rgba(34,211,238,0.5)] group-hover:ring-white/15`}
          >
            <HubScannerIcon
              className="h-5 w-5 shrink-0 text-app-fg-muted drop-shadow-[0_0_10px_rgba(34,211,238,0.45)] transition-all duration-200 group-hover:scale-105 group-hover:text-cyan-100 sm:h-6 sm:w-6"
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate text-left text-[11px] font-semibold leading-tight text-app-fg transition-colors group-hover:text-white sm:text-xs">
              {t.nav.bottomNavScannerAi}
            </span>
          </div>
        </Link>
      </div>
    </div>
  )
}
