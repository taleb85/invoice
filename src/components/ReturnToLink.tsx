'use client'

import Link from 'next/link'
import type { ComponentProps, MouseEvent } from 'react'
import { hrefWithReturnTo } from '@/lib/return-navigation'
import { saveScrollForListPath } from '@/lib/return-navigation-client'

type LinkProps = ComponentProps<typeof Link>

/**
 * Link verso un dettaglio / form con `returnTo` e salvataggio scroll della lista `from` in sessionStorage.
 */
export function ReturnToLink({
  to,
  from,
  onClick,
  ...rest
}: Omit<LinkProps, 'href'> & {
  to: string
  /** Path lista corrente (pathname + query), es. `/bolle?tutte=1` */
  from: string
}) {
  const href = hrefWithReturnTo(to, from)
  return (
    <Link
      {...rest}
      href={href}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        saveScrollForListPath(from)
        onClick?.(e)
      }}
    />
  )
}
