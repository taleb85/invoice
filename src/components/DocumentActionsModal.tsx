'use client'

import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import type { CommandId } from '@/lib/command-system/types'
import type { DocumentActionResult } from '@/lib/document-action-result'
import { useDocumentActionsPanel } from '@/lib/use-document-actions-panel'
import DocumentActionsPanelContent from '@/components/DocumentActionsPanelContent'

export type DocumentActionItem = {
  id: string
  origine: string
  fornitore_id?: string | null
  fornitore_nome?: string | null
  sede_id?: string | null
  numero_documento?: string | null
  file_url?: string | null
  pending_kind?: string
  importo?: number | null
  mittente?: string | null
  oggetto_mail?: string | null
  data_doc?: string | null
}

type DocumentActionsModalProps = {
  open: boolean
  item: DocumentActionItem | null
  onClose: () => void
  onExecute: (item: DocumentActionItem, actionId: CommandId) => Promise<DocumentActionResult>
}

export default function DocumentActionsModal({
  open,
  item,
  onClose,
  onExecute,
}: DocumentActionsModalProps) {
  if (!open || !item) return null

  return createPortal(
    <DocumentActionsModalInner item={item} onClose={onClose} onExecute={onExecute} />,
    document.body,
  )
}

function DocumentActionsModalInner({
  item,
  onClose,
  onExecute,
}: {
  item: DocumentActionItem
  onClose: () => void
  onExecute: (item: DocumentActionItem, actionId: CommandId) => Promise<DocumentActionResult>
}) {
  const panel = useDocumentActionsPanel({
    item,
    onExecute,
    onClose,
    resetKey: item.id,
  })
  const { d, execution, isRunning } = panel

  const handleClose = () => {
    if (isRunning) return
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
      role="presentation"
      onClick={handleClose}
    >
      <div
        className="document-actions-modal-panel relative mx-auto flex max-h-[min(90dvh,calc(100dvh-2rem))] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-app-line-45 shadow-2xl shadow-black/55 ring-1 ring-cyan-400/25"
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-actions-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-app-line-28 px-5 py-3.5">
          <div className="min-w-0 flex-1">
            <p id="document-actions-modal-title" className="text-sm font-semibold text-app-fg">
              {execution ? d.execProgressTitle : d.title}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-app-fg-muted">
              {execution ? execution.actionLabel : (item.fornitore_nome ?? d.noSupplier)}
              {!execution && item.numero_documento && ` · ${item.numero_documento}`}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isRunning}
            className="ml-2 rounded-lg p-1.5 text-app-fg-muted transition-colors hover:bg-app-line-10 hover:text-app-fg disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <DocumentActionsPanelContent panel={panel} variant="full" />
        </div>

        {!execution ? (
          <div className="border-t border-app-line-28 px-5 py-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={isRunning}
              className="w-full rounded-lg border border-app-line-28 px-4 py-2 text-xs font-semibold text-app-fg transition-colors hover:bg-app-line-10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {d.closeBtn}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
