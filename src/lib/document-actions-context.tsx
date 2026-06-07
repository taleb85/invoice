'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import DocumentActionsModal, { type DocumentActionItem } from '@/components/DocumentActionsModal'
import type { CommandId } from '@/lib/command-system/types'
import type { DocumentActionResult } from '@/lib/document-action-result'

type ActionsContextValue = {
  openActions: (item: DocumentActionItem) => void
  closeActions: () => void
  executeAction: (item: DocumentActionItem, actionId: CommandId) => Promise<DocumentActionResult>
}

const ActionsContext = createContext<ActionsContextValue>({
  openActions: () => {},
  closeActions: () => {},
  executeAction: async () => ({ ok: false, error: 'Not initialized' }),
})

export function useDocumentActions() {
  return useContext(ActionsContext)
}

export function DocumentActionsProvider({
  children,
  onExecute,
}: {
  children: ReactNode
  onExecute: (item: DocumentActionItem, actionId: CommandId) => Promise<DocumentActionResult>
}) {
  const [actionsItem, setActionsItem] = useState<DocumentActionItem | null>(null)

  const openActions = useCallback((item: DocumentActionItem) => {
    setActionsItem(item)
  }, [])

  const closeActions = useCallback(() => {
    setActionsItem(null)
  }, [])

  const executeAction = useCallback(
    (item: DocumentActionItem, actionId: CommandId) => onExecute(item, actionId),
    [onExecute],
  )

  return (
    <ActionsContext.Provider value={{ openActions, closeActions, executeAction }}>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <DocumentActionsModal
            open={!!actionsItem}
            item={actionsItem}
            onClose={closeActions}
            onExecute={onExecute}
          />,
          document.body,
        )}
    </ActionsContext.Provider>
  )
}
