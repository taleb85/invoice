'use client'

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { createPortal } from 'react-dom'
import { usePathname, useSearchParams } from 'next/navigation'

/** Host barra navigazione: strip header (tablet / fallback). */
export const APP_DESKTOP_HEADER_NAV_PROGRESS_ANCHOR_ID = 'app-desktop-header-nav-progress'
/** Host barra navigazione: bordi sidebar (desktop lg+). */
export const APP_DESKTOP_SIDEBAR_NAV_PROGRESS_ANCHOR_ID = 'app-desktop-sidebar-nav-progress'

const LG_MIN_PX = 1024

function subscribeDesktopLgMedia(cb: () => void) {
  if (typeof window === 'undefined') return () => {}
  const mq = window.matchMedia(`(min-width: ${LG_MIN_PX}px)`)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}

function desktopLgMediaMatches() {
  return typeof window !== 'undefined' && window.matchMedia(`(min-width: ${LG_MIN_PX}px)`).matches
}

function desktopLgMediaMatchesServerSnapshot() {
  return false
}

const BUSY_CLEAR_MS = 14_000
const PROGRESS_TICK_MS = 280
const PROGRESS_CAP = 0.92
const FILL_DONE_MS = 280
/** Attesa dopo che l’URL (routeKey) si è aggiornato: evita il 100% sul primo tick se Next aggiorna path e query separatamente. */
const ROUTE_SETTLE_MS = 320

function isModifiedClick(e: MouseEvent): boolean {
  return e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0
}

/**
 * Barra fissa durante il passaggio tra le pagine (App Router).
 * Avanza in modo progressivo (stile NProgress) mentre Next carica il segmento successivo,
 * poi completa al 100% e scompare.
 *
 * Su **mobile** (`< md`): posizione da `placement` (default: bordo inferiore viewport).
 * Su **desktop** `lg+`: tratto **verticale** su **bordo sinistro e destro della sidebar** (rail sempre visibile).
 * Su **md** (sidebar overlay): barra **2px** sul bordo basso di `#app-desktop-header-nav-progress`.
 */
export type NavigationProgressPlacement = 'viewportTop' | 'belowMobileTopbar' | 'viewportBottom'

const placementClassName: Record<NavigationProgressPlacement, string> = {
  viewportTop: '',
  belowMobileTopbar: 'navigation-top-progress--below-mobile-topbar',
  viewportBottom: 'navigation-top-progress--viewport-bottom',
}

export default function NavigationTopProgress({
  placement = 'viewportBottom',
  desktopHost,
  desktopSidebarHost,
}: {
  placement?: NavigationProgressPlacement
  /** Desktop tablet: `#app-desktop-header-nav-progress`. */
  desktopHost: HTMLElement | null
  /** Desktop lg+: `#app-desktop-sidebar-nav-progress` (overlay sui bordi della sidebar). */
  desktopSidebarHost?: HTMLElement | null
}) {
  const perimeterGradId = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const useSidebarDesktopHost = useSyncExternalStore(
    subscribeDesktopLgMedia,
    desktopLgMediaMatches,
    desktopLgMediaMatchesServerSnapshot
  )
  const pathname = usePathname() ?? ''
  const searchParams = useSearchParams()
  const routeKey = `${pathname}?${searchParams?.toString() ?? ''}`
  const firstNavRef = useRef(true)
  const isLoadingRef = useRef(false)
  const routeKeyAtClickRef = useRef<string | null>(null)
  const latestRouteKeyRef = useRef(routeKey)
  latestRouteKeyRef.current = routeKey
  const settleCompleteTimerRef = useRef<number | null>(null)
  const fillDoneTimerRef = useRef<number | null>(null)
  const busyTimerRef = useRef<number | null>(null)
  const progressIntervalRef = useRef<number | null>(null)

  const [visible, setVisible] = useState(false)
  const [progress, setProgress] = useState(0)
  const [portalsReady, setPortalsReady] = useState(false)

  const onLoginRoute =
    pathname === '/login' ||
    pathname.startsWith('/login/') ||
    pathname === '/accesso' ||
    pathname.startsWith('/accesso/')

  useLayoutEffect(() => {
    setPortalsReady(true)
  }, [])

  const clearProgressLoop = () => {
    if (progressIntervalRef.current !== null) {
      window.clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }
  }

  const clearBusyTimer = () => {
    if (busyTimerRef.current !== null) {
      window.clearTimeout(busyTimerRef.current)
      busyTimerRef.current = null
    }
  }

  const clearSettleTimer = () => {
    if (settleCompleteTimerRef.current !== null) {
      window.clearTimeout(settleCompleteTimerRef.current)
      settleCompleteTimerRef.current = null
    }
  }

  const clearFillDoneTimer = () => {
    if (fillDoneTimerRef.current !== null) {
      window.clearTimeout(fillDoneTimerRef.current)
      fillDoneTimerRef.current = null
    }
  }

  const finishBar = useCallback(() => {
    if (!isLoadingRef.current) return
    isLoadingRef.current = false
    routeKeyAtClickRef.current = null
    clearBusyTimer()
    clearProgressLoop()
    clearSettleTimer()
    clearFillDoneTimer()

    setProgress(1)

    fillDoneTimerRef.current = window.setTimeout(() => {
      fillDoneTimerRef.current = null
      setVisible(false)
      window.setTimeout(() => setProgress(0), 220)
    }, FILL_DONE_MS)
  }, [])

  useEffect(() => {
    if (onLoginRoute) return

    if (firstNavRef.current) {
      firstNavRef.current = false
      return
    }

    if (!isLoadingRef.current) return

    const atClick = routeKeyAtClickRef.current
    if (atClick === null) return
    if (routeKey === atClick) return

    clearSettleTimer()
    settleCompleteTimerRef.current = window.setTimeout(() => {
      settleCompleteTimerRef.current = null
      if (!isLoadingRef.current) return
      const startKey = routeKeyAtClickRef.current
      if (startKey === null) return
      if (latestRouteKeyRef.current === startKey) return
      finishBar()
    }, ROUTE_SETTLE_MS)

    return () => {
      clearSettleTimer()
    }
  }, [routeKey, onLoginRoute, finishBar])

  useEffect(() => {
    if (onLoginRoute) return

    const onLinkClick = (e: MouseEvent) => {
      if (isModifiedClick(e)) return
      const el = e.target as HTMLElement | null
      const a = el?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return
      const href = a.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return
      try {
        const u = new URL(href, window.location.origin)
        if (u.origin !== window.location.origin) return
        if (u.pathname === window.location.pathname && u.search === window.location.search) return
      } catch {
        return
      }

      clearProgressLoop()
      clearBusyTimer()
      clearSettleTimer()
      clearFillDoneTimer()

      routeKeyAtClickRef.current = latestRouteKeyRef.current
      isLoadingRef.current = true
      setVisible(true)
      setProgress(0.06)

      progressIntervalRef.current = window.setInterval(() => {
        setProgress((p) => {
          if (p >= PROGRESS_CAP) return p
          const room = PROGRESS_CAP - p
          return p + Math.max(0.003, room * (0.06 + Math.random() * 0.11))
        })
      }, PROGRESS_TICK_MS)

      busyTimerRef.current = window.setTimeout(() => {
        busyTimerRef.current = null
        if (!isLoadingRef.current) return
        isLoadingRef.current = false
        routeKeyAtClickRef.current = null
        clearSettleTimer()
        clearProgressLoop()
        setVisible(false)
        setProgress(0)
      }, BUSY_CLEAR_MS)
    }

    document.addEventListener('click', onLinkClick, true)
    return () => {
      document.removeEventListener('click', onLinkClick, true)
      clearBusyTimer()
      clearSettleTimer()
      clearFillDoneTimer()
      clearProgressLoop()
    }
  }, [onLoginRoute])

  if (onLoginRoute) return null

  if (!portalsReady) return null

  const mobilePlaceCls = placementClassName[placement]
  const visCls = visible ? ' navigation-top-progress--visible' : ''
  const fillStyle = { transform: `scaleX(${progress})` } as const

  const sidebarAsDesktopHost =
    useSidebarDesktopHost && desktopSidebarHost != null ? desktopSidebarHost : null
  const headerAsDesktopHost = desktopHost
  const desktopPortalTarget = sidebarAsDesktopHost ?? headerAsDesktopHost

  const mobileTrack = (
    <div
      className={`navigation-top-progress${mobilePlaceCls ? ` ${mobilePlaceCls}` : ''} md:hidden${visCls}`}
      aria-hidden
      role="presentation"
    >
      <div className="navigation-top-progress__fill" style={fillStyle} />
    </div>
  )

  const desktopHeaderTrack = (
    <div
      className={`navigation-top-progress--desktop-bar${visCls}`}
      aria-hidden
      role="presentation"
    >
      <div className="navigation-top-progress__fill" style={fillStyle} />
    </div>
  )

  const inset = 1
  const dashOffset = 1 - progress
  /** Due verticali: sinistra alto→basso, destra basso→alto. */
  const desktopSidebarPerimeterD = `M ${inset} ${inset} L ${inset} ${100 - inset} M ${100 - inset} ${100 - inset} L ${100 - inset} ${inset}`

  const desktopSidebarTrack = (
    <div
      className={`navigation-top-progress--desktop-sidebar-perimeter${visCls}`}
      aria-hidden
      role="presentation"
    >
      <svg
        className="navigation-top-progress__sidebar-perimeter-svg"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={perimeterGradId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
        </defs>
        <path
          d={desktopSidebarPerimeterD}
          fill="none"
          stroke={`url(#${perimeterGradId})`}
          strokeWidth={1}
          vectorEffect="nonScalingStroke"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={dashOffset}
          strokeLinecap="butt"
        />
      </svg>
    </div>
  )

  const desktopTrack = sidebarAsDesktopHost ? desktopSidebarTrack : desktopHeaderTrack

  return (
    <>
      {createPortal(mobileTrack, document.body)}
      {desktopPortalTarget ? createPortal(desktopTrack, desktopPortalTarget) : null}
    </>
  )
}
