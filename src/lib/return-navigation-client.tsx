'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useLayoutEffect } from 'react'
import {
  buildListLocationPath,
  readReturnToFromGetter,
  scrollStorageKeyForListPath,
} from '@/lib/return-navigation'

function appMainScrollEl(): HTMLElement | null {
  if (typeof document === 'undefined') return null
  return document.getElementById('app-main')
}

export function saveScrollForListPath(fullPath: string) {
  if (typeof window === 'undefined') return
  const el = appMainScrollEl()
  const y = el ? el.scrollTop : window.scrollY
  try {
    sessionStorage.setItem(scrollStorageKeyForListPath(fullPath), String(Math.round(y)))
  } catch {
    /* quota / private mode */
  }
}

export function restoreScrollForListPath(fullPath: string) {
  if (typeof window === 'undefined') return
  const key = scrollStorageKeyForListPath(fullPath)
  let raw: string | null = null
  try {
    raw = sessionStorage.getItem(key)
  } catch {
    return
  }
  if (raw == null) return
  try {
    sessionStorage.removeItem(key)
  } catch {
    /* ignore */
  }
  const y = parseInt(raw, 10)
  if (!Number.isFinite(y)) return
  requestAnimationFrame(() => {
    const el = appMainScrollEl()
    if (el) el.scrollTop = y
    else window.scrollTo(0, y)
  })
}

/** Dopo un'azione su dettaglio: `returnTo` → push; altrimenti `router.back()`. */
export function navigateAfterDetailAction(
  router: { push: (href: string) => void; back: () => void },
  searchParams: { get: (name: string) => string | null },
) {
  const r = readReturnToFromGetter((k) => searchParams.get(k))
  if (r) {
    router.push(r)
    return
  }
  router.back()
}

/**
 * Ripristina lo scroll salvato per `pathname`+search quando si torna da un dettaglio.
 * Montare una sola volta nel guscio app (es. dentro `AppShell`).
 */
export function AppMainScrollRestoration() {
  const pathname = usePathname() ?? ''
  const sp = useSearchParams()
  const full = buildListLocationPath(pathname, sp)

  useLayoutEffect(() => {
    restoreScrollForListPath(full)
  }, [full])

  return null
}
