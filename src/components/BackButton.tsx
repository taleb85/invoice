'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { readReturnToFromGetter } from '@/lib/return-navigation'

type BackButtonProps = {
  label?: string
  /** Destinazione di default se NON c’è `returnTo` in query (stesso schema di `DetailBackButton`). */
  href?: string
  className?: string
  /** Solo icona 〈; `label` resta per `aria-label` (accessibilità). */
  iconOnly?: boolean
}

/**
 * Pulsante «indietro»: preferisce `returnTo` se presente nell’URL; altrimenti `href`; altrimenti `router.back()`.
 */
export function BackButton({ label = 'Indietro', href, className, iconOnly }: BackButtonProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  /** `iconOnly`: target ~stessa scala dell’icona sezione nello strip (h-14 / sm:h-16 nel contenitore vicino). */
  const baseClass = iconOnly
    ? 'mb-0 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-app-fg-muted transition-colors hover:bg-white/[0.06] hover:text-app-fg sm:h-12 sm:w-12'
    : 'mb-3 flex w-fit items-center gap-1 text-sm text-app-fg-muted transition-colors hover:text-app-fg'

  return (
    <button
      type="button"
      {...(iconOnly ? { 'aria-label': label } : {})}
      onClick={() => {
        const r = readReturnToFromGetter((k) => searchParams.get(k))
        if (r) {
          router.push(r)
          return
        }
        if (href) {
          router.push(href)
          return
        }
        router.back()
      }}
      className={`${baseClass} ${className ?? ''}`}
    >
      <ChevronLeft className={`shrink-0 ${iconOnly ? 'h-5 w-5 sm:h-6 sm:w-6' : 'h-4 w-4'}`} aria-hidden />
      {!iconOnly ? label : null}
    </button>
  )
}
