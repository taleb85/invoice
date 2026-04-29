'use client'

import { useCallback, useEffect, useState } from 'react'

import { usePathname } from 'next/navigation'

import { useT } from '@/lib/use-t'
import { iconAccentClass as icon } from '@/lib/icon-accent-classes'

/** Stessa risoluzione dell’effect in `(app)/statements/layout.tsx` — `main`, non la finestra. */
export function resolveAppMainScrollEl(): HTMLElement | null {
  if (typeof document === 'undefined') return null
  return (
    document.querySelector<HTMLElement>('[data-app-main-scroll]') ??
    document.querySelector<HTMLElement>('main.overflow-y-auto')
  )
}

const SCROLL_THRESHOLD_PX = 400

export function AppMainScrollToTopFab() {
  const t = useT()
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)

  const sync = useCallback(() => {
    const main = resolveAppMainScrollEl()
    const y = main ? main.scrollTop : typeof window !== 'undefined' ? window.scrollY : 0
    setVisible(y > SCROLL_THRESHOLD_PX)
  }, [])

  useEffect(() => {
    sync()

    /** Primo layout: `<main>` potrebbe essere letto dopo il paint. */
    const tA = window.requestAnimationFrame(() => sync())

    window.addEventListener('scroll', sync, { capture: true, passive: true })

    let mainEl = resolveAppMainScrollEl()
    mainEl?.addEventListener('scroll', sync, { passive: true })

    const retries: number[] = [0, 50, 150, 400].map((delay) =>
      window.setTimeout(() => {
        const m = resolveAppMainScrollEl()
        if (m && !mainEl) {
          mainEl = m
          mainEl.addEventListener('scroll', sync, { passive: true })
        }
        sync()
      }, delay),
    )

    return () => {
      window.cancelAnimationFrame(tA)
      retries.forEach((id) => window.clearTimeout(id))
      window.removeEventListener('scroll', sync, { capture: true })
      mainEl?.removeEventListener('scroll', sync)
    }
    // pathname: dopo navigazione client lo scroll cambia ancora sulla stessa `<main>`
  }, [pathname, sync])

  const handleClick = () => {
    const main = resolveAppMainScrollEl()
    if (main) {
      main.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (!visible) return null

  return (
    <button
      type="button"
      onClick={handleClick}
      title={t.common.scrollToTop}
      aria-label={t.common.scrollToTop}
      className={
        `${icon.surface} fixed z-[42] inline-flex touch-manipulation ` +
        `h-11 w-11 items-center justify-center rounded-full shadow-[0_0_20px_-4px_rgba(34,211,238,0.35)] ` +
        `ring-2 ring-[rgba(34,211,238,0.2)] backdrop-blur-sm transition-colors ` +
        `hover:bg-app-line-12 hover:text-app-fg hover:ring-[rgba(34,211,238,0.35)] motion-safe:active:scale-95 ` +
        `bottom-[11rem] end-4 max-md:start-auto md:bottom-8 md:end-8`
      }
    >
      <svg className={`h-5 w-5 ${icon.cyanMuted}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
    </button>
  )
}
