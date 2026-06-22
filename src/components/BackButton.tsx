'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { readReturnToFromGetter } from '@/lib/return-navigation'

type BackButtonProps = {
  label?: string
  /** Destinazione quando non si usa la cronologia (vedi `historyFirst`). */
  href?: string
  className?: string
  /**
   * Solo icona 〈 (default). `label` resta per `aria-label`.
   * @deprecated Preferire `showLabel` per il testo visibile; `iconOnly={false}` equivale a `showLabel`.
   */
  iconOnly?: boolean
  /** Mostra etichetta testuale accanto alla freccia (es. form «← Fornitori»). */
  showLabel?: boolean
  /**
   * Se true (default in modalità icona): dopo `returnTo` si usa la cronologia (`router.back()`), poi eventuale `href`.
   * Se false (con `showLabel`): dopo `returnTo` si usa `href`, poi `router.back()`.
   */
  historyFirst?: boolean
}

function resolveBackNavigation(
  router: { push: (href: string) => void; back: () => void },
  opts: {
    returnToPath: string | null
    href?: string
    historyFirst: boolean
  },
) {
  const { returnToPath, href, historyFirst } = opts

  if (returnToPath) {
    router.push(returnToPath)
    return
  }

  if (historyFirst) {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
      return
    }
    if (href) {
      router.push(href)
      return
    }
    router.back()
    return
  }

  if (href) {
    router.push(href)
    return
  }
  router.back()
}

/**
 * Pulsante «indietro»: preferisce `returnTo` nell’URL; poi in base a `historyFirst` cronologia vs `href` (come `navigateAfterDetailAction` sullo strip).
 */
export function BackButton({
  label = 'Indietro',
  href,
  className,
  iconOnly,
  showLabel,
  historyFirst,
}: BackButtonProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const compact = !showLabel && iconOnly !== false
  const preferHistoryFirst = historyFirst ?? compact

  /** Compatta nello strip header: solo freccia, area tap 40×40. */
  const baseClass = compact
    ? 'mb-0 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-app-fg-muted transition-colors hover:bg-white/[0.06] hover:text-app-fg sm:h-10 sm:w-10'
    : 'mb-3 flex w-fit items-center gap-1 text-sm text-app-fg-muted transition-colors hover:text-app-fg'

  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => {
        const returnToPath = readReturnToFromGetter((k) => searchParams.get(k))
        resolveBackNavigation(router, {
          returnToPath,
          href,
          historyFirst: preferHistoryFirst,
        })
      }}
      className={`${baseClass} ${className ?? ''}`}
    >
      <ChevronLeft className="h-5 w-5 shrink-0" strokeWidth={compact ? 2.25 : 2} aria-hidden />
      {!compact ? label : null}
    </button>
  )
}
