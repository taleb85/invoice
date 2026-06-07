'use client'

import {
  ArrowLeft,
  CheckCircle,
  CreditCard,
  FileText,
  List,
  MessageSquare,
  Package,
  ShoppingCart,
} from 'lucide-react'
import type { CommandId } from '@/lib/command-system/types'
import { DOCUMENT_ACTION_GROUPS } from '@/lib/document-actions-catalog'
import type { useDocumentActionsPanel } from '@/lib/use-document-actions-panel'

type PanelState = ReturnType<typeof useDocumentActionsPanel>

function ActionSpinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}

const CATEGORY_OPTIONS: { id: CommandId; labelKey: keyof PanelState['d']; icon: React.ReactNode }[] = [
  { id: 'documento.finalizza_come_fattura', labelKey: 'catFattura', icon: <FileText className="h-4 w-4" /> },
  { id: 'documento.finalizza_come_bolla', labelKey: 'catBolla', icon: <Package className="h-4 w-4" /> },
  { id: 'documento.finalizza_come_nota_credito', labelKey: 'catNotaCredito', icon: <CreditCard className="h-4 w-4" /> },
  { id: 'documento.finalizza_come_statement', labelKey: 'catStatement', icon: <List className="h-4 w-4" /> },
  { id: 'documento.finalizza_come_ordine', labelKey: 'catOrdine', icon: <ShoppingCart className="h-4 w-4" /> },
  { id: 'documento.finalizza_come_comunicazione', labelKey: 'catComunicazione', icon: <MessageSquare className="h-4 w-4" /> },
  { id: 'documento.finalizza_come_listino', labelKey: 'catListino', icon: <List className="h-4 w-4" /> },
]

type Props = {
  panel: PanelState
  /** `compact`: solo etichetta in tendina; `full`: include descrizione (modale). */
  variant?: 'compact' | 'full'
}

export default function DocumentActionsPanelContent({ panel, variant = 'full' }: Props) {
  const {
    d,
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
  } = panel

  if (execution) {
    return (
      <div
        className="px-3 py-3"
        role="status"
        aria-live="polite"
        aria-busy={execution.phase === 'running'}
      >
        <ol className="space-y-1.5">
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
                className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 ${
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
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
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
                    <CheckCircle className="h-3 w-3" aria-hidden />
                  ) : active ? (
                    <ActionSpinner className="h-3 w-3" />
                  ) : (
                    index + 1
                  )}
                </span>
                <p
                  className={`min-w-0 flex-1 text-[11px] font-semibold leading-snug ${
                    failed ? 'text-rose-200' : done ? 'text-emerald-100' : active ? 'text-cyan-100' : 'text-app-fg-muted'
                  }`}
                >
                  {step}
                </p>
              </li>
            )
          })}
        </ol>

        {execution.phase === 'success' ? (
          <p className="mt-3 text-center text-[11px] font-semibold text-emerald-300">{d.execSuccess}</p>
        ) : null}

        {execution.phase === 'error' ? (
          <div className="mt-3 space-y-2">
            <p
              className={`text-center text-[11px] font-semibold ${
                execution.informational ? 'text-amber-200' : 'text-rose-300'
              }`}
            >
              {execution.error ?? d.execError}
            </p>
            <button
              type="button"
              onClick={() => setExecution(null)}
              className="w-full rounded-lg border border-app-line-28 px-3 py-1.5 text-[11px] font-semibold text-app-fg transition-colors hover:bg-app-line-10"
            >
              {d.execBackToActions}
            </button>
          </div>
        ) : null}
      </div>
    )
  }

  if (selettoreCategoria) {
    return (
      <div className="px-2 py-2">
        <div className="mb-2 flex items-center gap-2 px-1">
          <button
            type="button"
            onClick={() => setSelettoreCategoria(false)}
            className="rounded p-1 text-app-fg-muted transition-colors hover:bg-app-line-10 hover:text-app-fg"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <p className="text-[11px] font-semibold text-app-fg">{d.selectCorrectType}</p>
        </div>
        {variant === 'full' ? (
          <p className="mb-2 px-1 text-[10px] text-app-fg-muted">{d.correctionAiTraining}</p>
        ) : null}
        <div className={variant === 'full' ? 'grid grid-cols-2 gap-2 px-1' : 'space-y-0.5'}>
          {CATEGORY_OPTIONS.map((opt) => {
            const label = d[opt.labelKey]
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleCategorySelect(opt.id, label)}
                disabled={isRunning}
                className={
                  variant === 'full'
                    ? 'flex items-center gap-2 rounded-lg border border-app-line-28 bg-app-line-5 px-2.5 py-2.5 text-left transition-colors hover:border-cyan-500/30 hover:bg-cyan-500/10 disabled:opacity-40'
                    : 'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors hover:bg-app-line-15 disabled:opacity-40'
                }
              >
                <span
                  className={
                    variant === 'full'
                      ? 'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400'
                      : 'w-4 shrink-0 text-app-fg-muted'
                  }
                >
                  {actionIsLoading(opt.id) ? <ActionSpinner /> : opt.icon}
                </span>
                <span className="truncate text-xs font-semibold text-app-fg">{label}</span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="py-1">
      {DOCUMENT_ACTION_GROUPS.map((grp) => {
        const azioni = visible.filter((a) => a.gruppo === grp)
        if (!azioni.length) return null
        return (
          <div key={grp} className="mb-0.5 last:mb-0">
            <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-app-fg-subtle">
              {groupLabels[grp] ?? grp}
            </p>
            {azioni.map((action) => (
              <button
                key={action.id}
                type="button"
                role="menuitem"
                onClick={() => handleClick(action)}
                disabled={isRunning}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] transition-colors disabled:opacity-40 ${
                  action.pericolosa
                    ? 'text-rose-400 hover:bg-rose-950/40 hover:text-rose-300'
                    : 'text-app-fg hover:bg-app-line-15'
                } ${variant === 'full' ? 'rounded-lg px-3 py-2.5' : ''}`}
              >
                <span
                  className={
                    variant === 'full'
                      ? `flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          action.pericolosa ? 'bg-rose-500/10 text-rose-400' : 'bg-cyan-500/10 text-cyan-400'
                        }`
                      : 'w-4 shrink-0'
                  }
                >
                  {actionIsLoading(action.id) ? <ActionSpinner /> : action.icona}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`truncate font-medium ${action.pericolosa ? 'text-rose-300' : ''}`}>
                    {inConferma(action.id) ? d.confirmInline.replace('{label}', action.label) : action.label}
                  </p>
                  {variant === 'full' && !inConferma(action.id) ? (
                    <p className="mt-0.5 text-[11px] text-app-fg-muted">{action.descrizione}</p>
                  ) : null}
                  {inConferma(action.id) ? (
                    <p className="mt-0.5 text-[10px] text-rose-400">{d.clickAgainToConfirm}</p>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        )
      })}
    </div>
  )
}
