'use client'

import { useRef, useState } from 'react'
import { type DocumentActionItem } from '@/components/DocumentActionsModal'
import DocumentActionsDropdown from '@/components/DocumentActionsDropdown'
import { useDocumentActions } from '@/lib/document-actions-context'
import { useT } from '@/lib/use-t'
import { MoreHorizontal, SlidersHorizontal } from 'lucide-react'

type Props = {
  item: DocumentActionItem
  className?: string
  /** `link`: testo in footer modale; `icon`: tendina ancorata al pulsante in tabella. */
  variant?: 'icon' | 'link'
}

export default function DocumentActionsButton({ item, className = '', variant = 'icon' }: Props) {
  const { openActions, executeAction } = useDocumentActions()
  const t = useT()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const onLinkClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    openActions(item)
  }

  const onIconClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setDropdownOpen((prev) => !prev)
  }

  if (variant === 'link') {
    return (
      <button
        type="button"
        onClick={onLinkClick}
        className={`flex items-center gap-2 text-sm font-medium text-app-fg-muted transition-colors hover:text-app-fg ${className}`}
        title={t.documentActions.title}
      >
        <SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden />
        {t.documentActions.title}
      </button>
    )
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={onIconClick}
        aria-expanded={dropdownOpen}
        aria-haspopup="menu"
        className={`inline-flex items-center justify-center rounded-lg p-1.5 text-app-fg-muted transition-colors hover:bg-app-line-15 hover:text-app-fg ${className}`}
        title={t.documentActions.title}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </button>
      <DocumentActionsDropdown
        open={dropdownOpen}
        item={item}
        anchorRef={buttonRef}
        onClose={() => setDropdownOpen(false)}
        onExecute={executeAction}
      />
    </>
  )
}
