'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  UserCheck,
  Tag,
  FileText,
  RotateCw,
  Ban,
  CheckCircle,
  ExternalLink,
  Save,
  Archive,
  ShoppingCart,
  Package,
  CreditCard,
  MessageSquare,
  List,
  AlertTriangle,
  ArrowLeft,
} from 'lucide-react'
import type { CommandId } from '@/lib/command-system/types'
import { actionIdsForOrigine } from '@/lib/document-actions-applicable'
import { progressStepsForAction } from '@/lib/document-action-progress-steps'
import type { DocumentActionResult } from '@/lib/document-action-result'
import { useT } from '@/lib/use-t'
import { useMe } from '@/lib/me-context'
import type { Translations } from '@/lib/translations'

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

export type DocumentAction = {
  id: CommandId
  label: string
  descrizione: string
  icona: React.ReactNode
  gruppo: 'tipo' | 'fornitore' | 'stato' | 'documento' | 'pericolose'
  pericolosa?: boolean
}

function buildAllActions(t: Translations): DocumentAction[] {
  const d = t.documentActions
  return [
    // ── Tipo documento ──
    { id: 'documento.finalizza_come_fattura', label: d.actRegisterFatturaLabel, descrizione: d.actRegisterFatturaDesc, icona: <FileText className="h-4 w-4" />, gruppo: 'tipo' },
    { id: 'documento.finalizza_come_bolla', label: d.actRegisterBollaLabel, descrizione: d.actRegisterBollaDesc, icona: <Package className="h-4 w-4" />, gruppo: 'tipo' },
    { id: 'documento.finalizza_come_nota_credito', label: d.actRegisterNotaLabel, descrizione: d.actRegisterNotaDesc, icona: <CreditCard className="h-4 w-4" />, gruppo: 'tipo' },
    { id: 'documento.finalizza_come_statement', label: d.actArchiveStatementLabel, descrizione: d.actArchiveStatementDesc, icona: <List className="h-4 w-4" />, gruppo: 'tipo' },
    { id: 'documento.finalizza_come_ordine', label: d.actRegisterOrdineLabel, descrizione: d.actRegisterOrdineDesc, icona: <ShoppingCart className="h-4 w-4" />, gruppo: 'tipo' },
    { id: 'documento.finalizza_come_comunicazione', label: d.actArchiveCommunicationLabel, descrizione: d.actArchiveCommunicationDesc, icona: <MessageSquare className="h-4 w-4" />, gruppo: 'tipo' },
    { id: 'documento.finalizza_come_listino', label: d.actRegisterListinoLabel, descrizione: d.actRegisterListinoDesc, icona: <List className="h-4 w-4" />, gruppo: 'tipo' },
    // ── Fornitore ──
    { id: 'documento.associa', label: d.actAssociateSupplierLabel, descrizione: d.actAssociateSupplierDesc, icona: <UserCheck className="h-4 w-4" />, gruppo: 'fornitore' },
    { id: 'documento.aggiorna_categoria', label: d.actChangeCategoryLabel, descrizione: d.actChangeCategoryDesc, icona: <Tag className="h-4 w-4" />, gruppo: 'fornitore' },
    // ── Stato ──
    { id: 'documento.scarta', label: d.actDiscardLabel, descrizione: d.actDiscardDesc, icona: <Ban className="h-4 w-4" />, gruppo: 'stato', pericolosa: true },
    { id: 'documento.scarta_fattura', label: d.actDiscardInvoiceLabel, descrizione: d.actDiscardInvoiceDesc, icona: <Ban className="h-4 w-4" />, gruppo: 'stato', pericolosa: true },
    { id: 'documento.rianalizza_ocr', label: d.actReanalyzeOcrLabel, descrizione: d.actReanalyzeOcrDesc, icona: <RotateCw className="h-4 w-4" />, gruppo: 'stato' },
    { id: 'documento.ignora_mittente', label: d.actIgnoreSenderLabel, descrizione: d.actIgnoreSenderDesc, icona: <Ban className="h-4 w-4" />, gruppo: 'stato', pericolosa: true },
    { id: 'fattura.approva', label: d.actApproveInvoiceLabel, descrizione: d.actApproveInvoiceDesc, icona: <CheckCircle className="h-4 w-4" />, gruppo: 'stato' },
    { id: 'fattura.rifiuta', label: d.actRejectInvoiceLabel, descrizione: d.actRejectInvoiceDesc, icona: <AlertTriangle className="h-4 w-4" />, gruppo: 'stato', pericolosa: true },
    { id: 'fattura.resetta_approvazione', label: d.actResetApprovalLabel, descrizione: d.actResetApprovalDesc, icona: <RotateCw className="h-4 w-4" />, gruppo: 'stato' },
    { id: 'statement.segna_come_ok', label: d.actMarkVerifiedLabel, descrizione: d.actMarkVerifiedDesc, icona: <CheckCircle className="h-4 w-4" />, gruppo: 'stato' },
    { id: 'statement.assegna_fattura', label: d.actAssignInvoiceLabel, descrizione: d.actAssignInvoiceDesc, icona: <FileText className="h-4 w-4" />, gruppo: 'stato' },
    // ── Documento ──
    { id: 'documento.apri', label: d.actOpenDocumentLabel, descrizione: d.actOpenDocumentDesc, icona: <ExternalLink className="h-4 w-4" />, gruppo: 'documento' },
    // ── Bolla ──
    { id: 'bolla.rianalizza_ocr', label: d.actBollaReanalyzeOcrLabel, descrizione: d.actBollaReanalyzeOcrDesc, icona: <RotateCw className="h-4 w-4" />, gruppo: 'stato' },
    { id: 'bolla.converti_in_fattura', label: d.actBollaConvertLabel, descrizione: d.actBollaConvertDesc, icona: <Save className="h-4 w-4" />, gruppo: 'tipo' },
    { id: 'statement.converti_in_fattura', label: d.actBollaConvertLabel, descrizione: d.actBollaConvertDesc, icona: <Save className="h-4 w-4" />, gruppo: 'tipo' },
    { id: 'bolla.cambia_fornitore', label: d.actBollaChangeSupplierLabel, descrizione: d.actBollaChangeSupplierDesc, icona: <UserCheck className="h-4 w-4" />, gruppo: 'fornitore' },
    { id: 'bolla.elimina', label: d.actBollaDeleteLabel, descrizione: d.actBollaDeleteDesc, icona: <Archive className="h-4 w-4" />, gruppo: 'pericolose', pericolosa: true },
  ]
}

type ExecutionPhase = 'running' | 'success' | 'error'

type ExecutionState = {
  actionId: CommandId
  actionLabel: string
  steps: string[]
  currentStep: number
  phase: ExecutionPhase
  error?: string
  informational?: boolean
}

function ActionSpinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  )
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
  const t = useT()
  const { me } = useMe()
  const canAdminDocActions = Boolean(me?.is_admin || me?.is_admin_sede)
  const d = t.documentActions
  const allActions = useMemo(() => buildAllActions(t), [t])
  const actionsById = useMemo(
    () => new Map(allActions.map((a) => [a.id, a])),
    [allActions],
  )
  const visible = useMemo(() => {
    if (!item) return []
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
  }, [item, actionsById, canAdminDocActions])
  const [confermaId, setConfermaId] = useState<string | null>(null)
  const [selettoreCategoria, setSelettoreCategoria] = useState(false)
  const [execution, setExecution] = useState<ExecutionState | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!open) {
      setConfermaId(null)
      setSelettoreCategoria(false)
      setExecution(null)
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current)
        closeTimerRef.current = null
      }
    }
  }, [open])

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

  if (!open || !item) return null

  const isRunning = execution?.phase === 'running'
  const inConferma = (id: string) => confermaId === id

  const finishExecution = (result: DocumentActionResult, actionId: CommandId, actionLabel: string) => {
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
        onClose()
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
  }

  const runAction = async (actionId: CommandId, actionLabel: string) => {
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
  }

  const handleClick = async (action: DocumentAction) => {
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
  }

  const handleCategorySelect = async (id: CommandId, label: string) => {
    if (isRunning) return
    await runAction(id, label)
  }

  const handleClose = () => {
    if (isRunning) return
    onClose()
  }

  const CATEGORY_OPTIONS: { id: CommandId; label: string; icona: React.ReactNode }[] = [
    { id: 'documento.finalizza_come_fattura', label: d.catFattura, icona: <FileText className="h-4 w-4" /> },
    { id: 'documento.finalizza_come_bolla', label: d.catBolla, icona: <Package className="h-4 w-4" /> },
    { id: 'documento.finalizza_come_nota_credito', label: d.catNotaCredito, icona: <CreditCard className="h-4 w-4" /> },
    { id: 'documento.finalizza_come_statement', label: d.catStatement, icona: <List className="h-4 w-4" /> },
    { id: 'documento.finalizza_come_ordine', label: d.catOrdine, icona: <ShoppingCart className="h-4 w-4" /> },
    { id: 'documento.finalizza_come_comunicazione', label: d.catComunicazione, icona: <MessageSquare className="h-4 w-4" /> },
    { id: 'documento.finalizza_come_listino', label: d.catListino, icona: <List className="h-4 w-4" /> },
  ]

  const gruppi = ['tipo', 'fornitore', 'stato', 'documento', 'pericolose'] as const
  const etichette: Record<string, string> = {
    tipo: d.groupTipo,
    fornitore: d.groupFornitore,
    stato: d.groupStato,
    documento: d.groupDocumento,
    pericolose: d.groupPericolose,
  }

  const actionIsLoading = (id: CommandId) => isRunning && execution?.actionId === id

  return createPortal(
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
        {/* Header */}
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

        {execution ? (
          <div
            className="min-h-0 flex-1 overflow-y-auto px-5 py-4"
            role="status"
            aria-live="polite"
            aria-busy={execution.phase === 'running'}
          >
            <ol className="space-y-2">
              {execution.steps.map((step, index) => {
                const done =
                  execution.phase === 'success' ||
                  (execution.phase === 'running' && index < execution.currentStep) ||
                  (execution.phase === 'error' && index < execution.currentStep)
                const active = execution.phase === 'running' && index === execution.currentStep
                const failed = execution.phase === 'error' && index === execution.currentStep
                return (
                  <li
                    key={`${step}-${index}`}
                    className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 ${
                      failed
                        ? 'border-rose-500/30 bg-rose-500/10'
                        : done
                          ? 'border-emerald-500/25 bg-emerald-500/8'
                          : active
                            ? 'border-cyan-500/35 bg-cyan-500/10'
                            : 'border-app-line-28 bg-app-line-5'
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                        failed
                          ? 'bg-rose-500/20 text-rose-300'
                          : done
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : active
                              ? 'bg-cyan-500/20 text-cyan-300'
                              : 'bg-app-line-15 text-app-fg-subtle'
                      }`}
                    >
                      {done ? (
                        <CheckCircle className="h-3.5 w-3.5" aria-hidden />
                      ) : active ? (
                        <ActionSpinner className="h-3.5 w-3.5" />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-xs font-semibold ${
                          failed ? 'text-rose-200' : done ? 'text-emerald-100' : active ? 'text-cyan-100' : 'text-app-fg-muted'
                        }`}
                      >
                        {step}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ol>

            {execution.phase === 'success' ? (
              <p className="mt-4 text-center text-xs font-semibold text-emerald-300">{d.execSuccess}</p>
            ) : null}

            {execution.phase === 'error' ? (
              <div className="mt-4 space-y-3">
                <p
                  className={`text-center text-xs font-semibold ${
                    execution.informational ? 'text-amber-200' : 'text-rose-300'
                  }`}
                >
                  {execution.error ?? d.execError}
                </p>
                <button
                  type="button"
                  onClick={() => setExecution(null)}
                  className="w-full rounded-lg border border-app-line-28 px-4 py-2 text-xs font-semibold text-app-fg transition-colors hover:bg-app-line-10"
                >
                  {d.execBackToActions}
                </button>
              </div>
            ) : null}
          </div>
        ) : selettoreCategoria ? (
          <div className="px-3 py-4">
            <div className="mb-3 flex items-center gap-2 px-2">
              <button
                type="button"
                onClick={() => setSelettoreCategoria(false)}
                className="rounded p-1 text-app-fg-muted transition-colors hover:bg-app-line-10 hover:text-app-fg"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <p className="text-xs font-semibold text-app-fg">{d.selectCorrectType}</p>
            </div>
            <p className="mb-3 px-2 text-[11px] text-app-fg-muted">
              {d.correctionAiTraining}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORY_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleCategorySelect(opt.id, opt.label)}
                  disabled={isRunning}
                  className="flex items-center gap-2.5 rounded-lg border border-app-line-28 bg-app-line-5 px-3 py-3 text-left transition-colors hover:bg-cyan-500/10 hover:border-cyan-500/30 disabled:opacity-40"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400">
                    {actionIsLoading(opt.id) ? (
                      <ActionSpinner />
                    ) : (
                      opt.icona
                    )}
                  </span>
                  <span className="text-xs font-semibold text-app-fg">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {gruppi.map((grp) => {
            const azioni = visible.filter((a) => a.gruppo === grp)
            if (!azioni.length) return null
            return (
              <div key={grp} className="mb-3 last:mb-0">
                <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-app-fg-subtle">
                  {etichette[grp] ?? grp}
                </p>
                <div className="space-y-0.5">
                  {azioni.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => handleClick(action)}
                      disabled={isRunning}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                        action.pericolosa
                          ? 'hover:bg-rose-500/10 active:bg-rose-500/15'
                          : 'hover:bg-white/[0.06] active:bg-white/[0.09]'
                      } disabled:opacity-40`}
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          action.pericolosa
                            ? 'bg-rose-500/10 text-rose-400'
                            : 'bg-cyan-500/10 text-cyan-400'
                        }`}
                      >
                        {actionIsLoading(action.id) ? (
                          <ActionSpinner />
                        ) : (
                          action.icona
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-xs font-semibold ${
                            action.pericolosa ? 'text-rose-300' : 'text-app-fg'
                          }`}
                        >
                          {inConferma(action.id) ? d.confirmInline.replace('{label}', action.label) : action.label}
                        </p>
                        {!inConferma(action.id) && (
                          <p className="mt-0.5 text-[11px] text-app-fg-muted">{action.descrizione}</p>
                        )}
                        {inConferma(action.id) && (
                          <p className="mt-0.5 text-[11px] text-rose-400">{d.clickAgainToConfirm}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        )}

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
    </div>,
    document.body,
  )
}
