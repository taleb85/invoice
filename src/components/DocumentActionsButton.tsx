'use client'

import { type DocumentActionItem } from '@/components/DocumentActionsModal'
import { useDocumentActions } from '@/lib/document-actions-context'
import { useT } from '@/lib/use-t'
import { MoreHorizontal, SlidersHorizontal } from 'lucide-react'

type Props = {
  item: DocumentActionItem
  className?: string
  /** `link`: testo in footer modale; `icon`: solo icona in tabella. */
  variant?: 'icon' | 'link'
}

export default function DocumentActionsButton({ item, className = '', variant = 'icon' }: Props) {
  const { openActions } = useDocumentActions()
  const t = useT()

  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    openActions(item)
  }

  if (variant === 'link') {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`flex items-center gap-2 text-sm font-medium text-app-fg-muted transition-colors hover:text-app-fg ${className}`}
        title={t.documentActions.title}
      >
        <SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden />
        {t.documentActions.title}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded-lg p-1.5 text-app-fg-muted transition-colors hover:bg-app-line-15 hover:text-app-fg ${className}`}
      title={t.documentActions.title}
    >
      <MoreHorizontal className="h-4 w-4" aria-hidden />
    </button>
  )
}
