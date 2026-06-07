'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import DocumentActionsPanelContent from '@/components/DocumentActionsPanelContent'
import type { DocumentActionItem } from '@/components/DocumentActionsModal'
import { useDocumentActionsPanel } from '@/lib/use-document-actions-panel'
import type { CommandId } from '@/lib/command-system/types'
import type { DocumentActionResult } from '@/lib/document-action-result'
import { useT } from '@/lib/use-t'

type Props = {
  open: boolean
  item: DocumentActionItem
  anchorRef: React.RefObject<HTMLElement | null>
  onClose: () => void
  onExecute: (item: DocumentActionItem, actionId: CommandId) => Promise<DocumentActionResult>
}

export default function DocumentActionsDropdown({
  open,
  item,
  anchorRef,
  onClose,
  onExecute,
}: Props) {
  const t = useT()
  const d = t.documentActions
  const panelRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)

  const panel = useDocumentActionsPanel({
    item,
    onExecute,
    onClose,
    resetKey: open,
  })

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    const gap = 4
    const panelWidth = 240
    let left = rect.right - panelWidth
    let top = rect.bottom + gap
    if (left < 8) left = 8
    if (left + panelWidth > window.innerWidth - 8) {
      left = window.innerWidth - panelWidth - 8
    }
    setPosition({ top, left })
  }, [anchorRef])

  useEffect(() => {
    if (!open) {
      setPosition(null)
      return
    }
    updatePosition()
  }, [open, updatePosition, item.id])

  useEffect(() => {
    if (!open) return
    const panelEl = panelRef.current
    if (!panelEl || !position) return
    const rect = panelEl.getBoundingClientRect()
    if (rect.bottom > window.innerHeight - 8) {
      const anchor = anchorRef.current
      if (anchor) {
        const anchorRect = anchor.getBoundingClientRect()
        const flippedTop = anchorRect.top - rect.height - 4
        if (flippedTop >= 8) {
          setPosition((prev) => (prev ? { ...prev, top: flippedTop } : prev))
        }
      }
    }
  }, [open, position, anchorRef, panel.execution, panel.selettoreCategoria])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !panel.isRunning) {
        e.preventDefault()
        onClose()
      }
    },
    [onClose, panel.isRunning],
  )

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (panel.isRunning) return
      if (panelRef.current?.contains(target)) return
      if (anchorRef.current?.contains(target)) return
      onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open, onClose, handleKeyDown, updatePosition, anchorRef, panel.isRunning])

  if (!open || !position || typeof document === 'undefined') return null

  return createPortal(
    <div
      ref={panelRef}
      style={{ top: position.top, left: position.left, width: 240 }}
      className="document-actions-dropdown-anchor fixed z-[9999]"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        role="menu"
        aria-label={d.title}
        data-fluxo-document-actions-dropdown
        className="document-actions-dropdown max-h-[min(70dvh,420px)] overflow-hidden overflow-y-auto rounded-lg border border-app-line-45 shadow-2xl ring-1 ring-black/30"
      >
        <div className="document-actions-dropdown-inner">
          <div className="border-b border-app-line-20 px-3 py-2">
            <p className="truncate text-[11px] font-semibold text-app-fg">
              {panel.execution ? d.execProgressTitle : d.title}
            </p>
            <p className="truncate text-[10px] text-app-fg-muted">
              {panel.execution
                ? panel.execution.actionLabel
                : (item.fornitore_nome ?? d.noSupplier)}
              {!panel.execution && item.numero_documento ? ` · ${item.numero_documento}` : null}
            </p>
          </div>
          <DocumentActionsPanelContent panel={panel} variant="compact" />
        </div>
      </div>
    </div>,
    document.body,
  )
}
