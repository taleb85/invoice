'use client'

import Link from 'next/link'

import { OpenDocumentInAppButton } from '@/components/OpenDocumentInAppButton'
import type { EmailActivityOpenTarget } from '@/lib/email-activity-day'

type Props = {
  label: string
  href: string | null
  docOpen?: EmailActivityOpenTarget
  /** Stile link testo (lista mobile vs tabella desktop). */
  variant: 'mobile' | 'table'
}

export function LogActivityDocumentLink({ label, href, docOpen, variant }: Props) {
  const textClass =
    variant === 'mobile'
      ? 'inline-block text-xs font-medium text-app-cyan-500 hover:text-app-fg-muted hover:underline'
      : 'font-medium text-app-cyan-500 hover:text-app-fg-muted hover:underline'

  if (docOpen?.fileUrl?.trim()) {
    const u = docOpen.fileUrl.trim()
    if (docOpen.kind === 'fattura') {
      return (
        <OpenDocumentInAppButton fatturaId={docOpen.id} fileUrl={u} className={textClass} title={label}>
          {label}
        </OpenDocumentInAppButton>
      )
    }
    if (docOpen.kind === 'bolla') {
      return (
        <OpenDocumentInAppButton bollaId={docOpen.id} fileUrl={u} className={textClass} title={label}>
          {label}
        </OpenDocumentInAppButton>
      )
    }
    return (
      <OpenDocumentInAppButton documentoId={docOpen.id} fileUrl={u} className={textClass} title={label}>
        {label}
      </OpenDocumentInAppButton>
    )
  }

  if (href) {
    return (
      <Link href={href} className={textClass}>
        {label}
      </Link>
    )
  }

  return <span className="text-app-fg-muted">—</span>
}
