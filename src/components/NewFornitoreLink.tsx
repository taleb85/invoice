'use client'

import type { ComponentProps } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { appendReturnToNewFornitoreHref } from '@/lib/safe-internal-return-path'

export type NewFornitoreLinkProps = Omit<ComponentProps<typeof Link>, 'href'> & {
  /**
   * Solo path e query di prefill (`/fornitori/new?...`) — non includere `return_to` qui:
   * viene aggiunto dalla pagina corrente.
   */
  href: string
  /**
   * Override raro: dove tornare dopo salvataggio se diverso dalla route attuale.
   * Default: pathname + search correnti.
   */
  returnTo?: string | null
}

/** Link a creazione fornitore con `return_to` sicuro verso la pagina da cui si naviga. */
export function NewFornitoreLink({ href, returnTo, ...rest }: NewFornitoreLinkProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const autoReturn = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`
  const resolvedHref = appendReturnToNewFornitoreHref(href, returnTo ?? autoReturn)

  return <Link href={resolvedHref} {...rest} />
}
