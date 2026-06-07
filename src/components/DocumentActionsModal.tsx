'use client'

import { useMemo, useState } from 'react'
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
import { useT } from '@/lib/use-t'
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
    { id: 'bolla.cambia_fornitore', label: d.actBollaChangeSupplierLabel, descrizione: d.actBollaChangeSupplierDesc, icona: <UserCheck className="h-4 w-4" />, gruppo: 'fornitore' },
    { id: 'bolla.elimina', label: d.actBollaDeleteLabel, descrizione: d.actBollaDeleteDesc, icona: <Archive className="h-4 w-4" />, gruppo: 'pericolose', pericolosa: true },
  ]
}

type DocumentActionsModalProps = {
  open: boolean
  item: DocumentActionItem | null
  onClose: () => void
  onExecute: (item: DocumentActionItem, actionId: CommandId) => Promise<void>
  eseguendoId?: string | null
}

export default function DocumentActionsModal({
  open,
  item,
  onClose,
  onExecute,
  eseguendoId,
}: DocumentActionsModalProps) {
  const t = useT()
  const d = t.documentActions
  const allActions = useMemo(() => buildAllActions(t), [t])
  const actionsById = useMemo(
    () => new Map(allActions.map((a) => [a.id, a])),
    [allActions],
  )
  const visible = useMemo(() => {
    if (!item) return []
    return actionIdsForOrigine(item.origine)
      .map((id) => actionsById.get(id))
      .filter((a): a is DocumentAction => Boolean(a))
  }, [item, actionsById])
  const [confermaId, setConfermaId] = useState<string | null>(null)
  const [selettoreCategoria, setSelettoreCategoria] = useState(false)

  if (!open || !item) return null

  const isLoading = (id: string) => eseguendoId === `${item.id}_${id}`
  const inConferma = (id: string) => confermaId === id

  const handleClick = async (action: DocumentAction) => {
    // "Cambia categoria" apre il selettore inline
    if (action.id === 'documento.aggiorna_categoria') {
      setSelettoreCategoria(true)
      return
    }
    if (action.pericolosa && !inConferma(action.id)) {
      setConfermaId(action.id)
      return
    }
    setConfermaId(null)
    await onExecute(item, action.id)
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

  const handleCategorySelect = async (id: CommandId) => {
    setSelettoreCategoria(false)
    await onExecute(item, id)
    onClose()
  }

  const gruppi = ['tipo', 'fornitore', 'stato', 'documento', 'pericolose'] as const
  const etichette: Record<string, string> = {
    tipo: d.groupTipo,
    fornitore: d.groupFornitore,
    stato: d.groupStato,
    documento: d.groupDocumento,
    pericolose: d.groupPericolose,
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
      role="presentation"
      onClick={onClose}
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
              {d.title}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-app-fg-muted">
              {item.fornitore_nome ?? d.noSupplier}
              {item.numero_documento && ` · ${item.numero_documento}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-2 rounded-lg p-1.5 text-app-fg-muted transition-colors hover:bg-app-line-10 hover:text-app-fg"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Corpo azioni */}
        {selettoreCategoria ? (
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
                  onClick={() => handleCategorySelect(opt.id)}
                  disabled={isLoading(opt.id)}
                  className="flex items-center gap-2.5 rounded-lg border border-app-line-28 bg-app-line-5 px-3 py-3 text-left transition-colors hover:bg-cyan-500/10 hover:border-cyan-500/30 disabled:opacity-40"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400">
                    {isLoading(opt.id) ? (
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
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
                      disabled={isLoading(action.id)}
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
                        {isLoading(action.id) ? (
                          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
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

        {/* Footer */}
        <div className="border-t border-app-line-28 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg border border-app-line-28 px-4 py-2 text-xs font-semibold text-app-fg transition-colors hover:bg-app-line-10"
          >
            {d.closeBtn}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
