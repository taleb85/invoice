'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { readReturnToFromGetter } from '@/lib/return-navigation'

type BackButtonProps = {
  label?: string
  /** Destinazione di default se NON c’è `returnTo` in query (stesso schema di `DetailBackButton`). */
  href?: string
  className?: string
}

/**
 * Pulsante «indietro»: preferisce `returnTo` se presente nell’URL; altrimenti `href`; altrimenti `router.back()`.
 */
export function BackButton({ label = 'Indietro', href, className }: BackButtonProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  return (
    <button
      type="button"
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
      className={`mb-3 flex w-fit items-center gap-1 text-sm text-app-fg-muted transition-colors hover:text-app-fg ${className ?? ''}`}
    >
      <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
      {label}
    </button>
  )
}
