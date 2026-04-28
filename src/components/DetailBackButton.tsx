'use client'

import type { ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { navigateAfterDetailAction } from '@/lib/return-navigation-client'

type Props = {
  className?: string
  title?: string
  'aria-label'?: string
  children: ReactNode
}

/**
 * Indietro da pagine dettaglio full-screen: usa `returnTo` se presente, altrimenti history.back.
 */
export default function DetailBackButton({ className, title, 'aria-label': ariaLabel, children }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  return (
    <button
      type="button"
      title={title}
      aria-label={ariaLabel}
      className={className}
      onClick={() => navigateAfterDetailAction(router, searchParams)}
    >
      {children}
    </button>
  )
}
