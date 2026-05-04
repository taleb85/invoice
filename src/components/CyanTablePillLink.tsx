import Link from 'next/link'
import type { ReactNode } from 'react'
import { BTN_SIZE_SM } from '@/lib/button-size-tokens'

/** Classi condivise con `OpenDocumentInAppButton` (stesso aspetto del pill in tabella). */
export const CYAN_TABLE_PILL_LINK_CLASSNAME =
  `inline-flex items-center gap-1.5 bg-app-line-15 font-medium text-app-fg-muted transition-colors hover:bg-app-line-25 ${BTN_SIZE_SM}`

const pillClass = CYAN_TABLE_PILL_LINK_CLASSNAME

/** Stile pill cyan come «Vedi documento» nelle tabelle (bolle / fatture). */
export function CyanTablePillLink({
  href,
  children,
  external,
}: {
  href: string
  children: ReactNode
  /** Apre in nuova scheda (`<a>`) invece di navigazione client. */
  external?: boolean
}) {
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={pillClass}>
        {children}
      </a>
    )
  }
  return (
    <Link href={href} className={pillClass}>
      {children}
    </Link>
  )
}
