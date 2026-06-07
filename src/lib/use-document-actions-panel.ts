'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CommandId } from '@/lib/command-system/types'
import { actionIdsForOrigine } from '@/lib/document-actions-applicable'
import { progressStepsForAction } from '@/lib/document-action-progress-steps'
import type { DocumentActionResult } from '@/lib/document-action-result'
import { buildAllDocumentActions, type DocumentAction } from '@/lib/document-actions-catalog'
import { useT } from '@/lib/use-t'
import { useMe } from '@/lib/me-context'
import type { DocumentActionItem } from '@/components/DocumentActionsModal'

type ExecutionPhase = 'running' | 'success' | 'error'

export type DocumentActionsExecutionState = {
  actionId: CommandId
  actionLabel: string
  steps: string[]
  currentStep: number
  phase: ExecutionPhase
  error?: string
  informational?: boolean
}

export function useDocumentActionsPanel({
  item,
  onExecute,
  onClose,
  resetKey,
}: {
  item: DocumentActionItem
  onExecute: (item: DocumentActionItem, actionId: CommandId) => Promise<DocumentActionResult>
  onClose?: () => void
  /** Quando cambia, resetta conferma / esecuzione (es. chiusura dropdown). */
  resetKey?: string | number | boolean
}) {
  const t = useT()
  const { me } = useMe()
  const d = t.documentActions
  const canAdminDocActions = Boolean(me?.is_admin || me?.is_admin_sede)
  const allActions = useMemo(() => buildAllDocumentActions(t), [t])
  const actionsById = useMemo(
    () => new Map(allActions.map((a) => [a.id, a])),
    [allActions],
  )
  const visible = useMemo(() => {
    return actionIdsForOrigine(item.origine)
      .filter((id) => {
        if (
          (id === 'statement.converti_in_fattura' || id === 'bolla.converti_in_fattura') &&
          !canAdminDocActions
        ) {
          return false
        }
        return true
      })
      .map((id) => actionsById.get(id))
      .filter((a): a is DocumentAction => Boolean(a))
  }, [item.origine, actionsById, canAdminDocActions])

  const [confermaId, setConfermaId] = useState<string | null>(null)
  const [selettoreCategoria, setSelettoreCategoria] = useState(false)
  const [execution, setExecution] = useState<DocumentActionsExecutionState | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setConfermaId(null)
    setSelettoreCategoria(false)
    setExecution(null)
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [resetKey, item.id])

  useEffect(() => {
    if (!execution || execution.phase !== 'running' || execution.steps.length <= 1) return
    const maxAnimated = execution.steps.length - 2
    if (execution.currentStep >= maxAnimated) return
    const timer = setTimeout(() => {
      setExecution((prev) => {
        if (!prev || prev.phase !== 'running') return prev
        return { ...prev, currentStep: Math.min(prev.currentStep + 1, maxAnimated) }
      })
    }, 1100)
    return () => clearTimeout(timer)
  }, [execution])

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [])

  const isRunning = execution?.phase === 'running'
  const inConferma = (id: string) => confermaId === id

  const finishExecution = useCallback(
    (result: DocumentActionResult, actionId: CommandId, actionLabel: string) => {
      if (result.ok) {
        setExecution((prev) => {
          const steps = prev?.steps ?? progressStepsForAction(actionId, t)
          return {
            actionId,
            actionLabel,
            steps,
            currentStep: steps.length - 1,
            phase: 'success',
          }
        })
        closeTimerRef.current = setTimeout(() => {
          onClose?.()
        }, 1400)
        return
      }
      setExecution((prev) => {
        const steps = prev?.steps ?? progressStepsForAction(actionId, t)
        return {
          actionId,
          actionLabel,
          steps,
          currentStep: prev?.currentStep ?? 0,
          phase: 'error',
          error: result.error ?? d.execError,
          informational: result.informational,
        }
      })
    },
    [d.execError, onClose, t],
  )

  const runAction = useCallback(
    async (actionId: CommandId, actionLabel: string) => {
      const steps = progressStepsForAction(actionId, t)
      setExecution({
        actionId,
        actionLabel,
        steps,
        currentStep: 0,
        phase: 'running',
      })
      setConfermaId(null)
      setSelettoreCategoria(false)
      const result = await onExecute(item, actionId)
      finishExecution(result, actionId, actionLabel)
    },
    [finishExecution, item, onExecute, t],
  )

  const handleClick = useCallback(
    async (action: DocumentAction) => {
      if (isRunning) return
      if (action.id === 'documento.aggiorna_categoria') {
        setSelettoreCategoria(true)
        return
      }
      if (action.pericolosa && !inConferma(action.id)) {
        setConfermaId(action.id)
        return
      }
      await runAction(action.id, action.label)
    },
    [inConferma, isRunning, runAction],
  )

  const handleCategorySelect = useCallback(
    async (id: CommandId, label: string) => {
      if (isRunning) return
      await runAction(id, label)
    },
    [isRunning, runAction],
  )

  const actionIsLoading = (id: CommandId) => isRunning && execution?.actionId === id

  const groupLabels: Record<string, string> = {
    tipo: d.groupTipo,
    fornitore: d.groupFornitore,
    stato: d.groupStato,
    documento: d.groupDocumento,
    pericolose: d.groupPericolose,
  }

  return {
    d,
    item,
    visible,
    execution,
    selettoreCategoria,
    setSelettoreCategoria,
    isRunning,
    inConferma,
    handleClick,
    handleCategorySelect,
    actionIsLoading,
    groupLabels,
    setExecution,
  }
}
