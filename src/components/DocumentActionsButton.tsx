'use client'

import { type DocumentActionItem } from '@/components/DocumentActionsModal'
import { useDocumentActions } from '@/lib/document-actions-context'
import { MoreHorizontal } from 'lucide-react'

type Props = {
  item: DocumentActionItem
  className?: string
}

export default function DocumentActionsButton({ item, className = '' }: Props) {
  const { openActions } = useDocumentActions()

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        openActions(item)
      }}
      className={`inline-flex items-center justify-center rounded-lg p-1.5 text-app-fg-muted transition-colors hover:bg-app-line-15 hover:text-app-fg ${className}`}
      title="Azioni documento"
    >
      <MoreHorizontal className="h-4 w-4" />
    </button>
  )
}
