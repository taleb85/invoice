'use client'

import { useRouter } from 'next/navigation'
import { useLocale } from '@/lib/locale-context'

/**
 * Logo FLUXO nella striscia unificata con `#app-desktop-header-nav-progress` (solo md+).
 */
export function SidebarBrandHeader({
  collapsed,
  onExpand,
}: {
  collapsed: boolean
  onExpand: () => void
}) {
  const router = useRouter()
  const { t } = useLocale()

  return (
    <div className="relative flex min-h-[50px] min-w-0 flex-1 items-center gap-1.5 px-2">
      <div
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2"
        onClick={() => {
          if (typeof window === 'undefined' || window.innerWidth < 768) return
          if (collapsed) {
            onExpand()
            return
          }
          router.push('/')
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return
          e.preventDefault()
          if (typeof window === 'undefined' || window.innerWidth < 768) return
          if (collapsed) onExpand()
          else router.push('/')
        }}
        title={collapsed ? t.ui.expandSidebar : undefined}
      >
        <svg viewBox="0 0 96 56" className="h-[30px] w-12 shrink-0" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <defs>
            <linearGradient id="fx-card-bg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1e3a5f"/>
              <stop offset="100%" stopColor="#172554"/>
            </linearGradient>
            <linearGradient id="fx-wave" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#5b7cf9"/>
              <stop offset="50%" stopColor="#38bdf8"/>
              <stop offset="100%" stopColor="#22d3ee"/>
            </linearGradient>
            <filter id="fx-wave-fluo" x="-60%" y="-60%" width="220%" height="220%" filterUnits="objectBoundingBox">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.2" result="b1" />
              <feGaussianBlur in="SourceGraphic" stdDeviation="4.5" result="b2" />
              <feMerge>
                <feMergeNode in="b2" />
                <feMergeNode in="b1" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <rect width="56" height="56" rx="13" fill="url(#fx-card-bg)"/>
          <path
            d="M7 28 C18 10, 34 10, 48 28 S72 46, 88 28"
            stroke="url(#fx-wave)"
            strokeWidth="3.5"
            fill="none"
            strokeLinecap="round"
            filter="url(#fx-wave-fluo)"
          />
          <circle cx="7"  cy="28" r="3.5" fill="#5b7cf9"/>
          <circle cx="48" cy="28" r="3.5" fill="#38bdf8"/>
          <circle cx="88" cy="28" r="3.5" fill="#22d3ee"/>
        </svg>

        <div className="min-w-0">
          <svg viewBox="0 0 130 32" className="h-auto w-[6rem] max-w-full" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <defs>
              <linearGradient id="fx-text" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#6b8ef5"/>
                <stop offset="100%" stopColor="#22d3ee"/>
              </linearGradient>
            </defs>
            <text x="0" y="24" fontFamily="Arial Black, Arial, sans-serif" fontWeight="900" fontSize="24" fill="url(#fx-text)">FLUXO</text>
          </svg>
          <p className="-mt-1 text-[9px] font-semibold uppercase tracking-wider text-white [text-shadow:0_0_18px_rgba(255,255,255,0.2)]">
            {t.ui.tagline}
          </p>
        </div>
      </div>
    </div>
  )
}
