import type { ReactNode } from 'react'
import {
  AlertTriangle,
  Archive,
  Ban,
  CheckCircle,
  CreditCard,
  ExternalLink,
  FileText,
  List,
  MessageSquare,
  Package,
  RotateCw,
  Save,
  ShoppingCart,
  Tag,
  UserCheck,
} from 'lucide-react'
import type { CommandId } from '@/lib/command-system/types'
import type { Translations } from '@/lib/translations'

export type DocumentAction = {
  id: CommandId
  label: string
  descrizione: string
  icona: ReactNode
  gruppo: 'tipo' | 'fornitore' | 'stato' | 'documento' | 'pericolose'
  pericolosa?: boolean
}

export function buildAllDocumentActions(t: Translations): DocumentAction[] {
  const d = t.documentActions
  return [
    { id: 'documento.finalizza_come_fattura', label: d.actRegisterFatturaLabel, descrizione: d.actRegisterFatturaDesc, icona: <FileText className="h-4 w-4" />, gruppo: 'tipo' },
    { id: 'documento.finalizza_come_bolla', label: d.actRegisterBollaLabel, descrizione: d.actRegisterBollaDesc, icona: <Package className="h-4 w-4" />, gruppo: 'tipo' },
    { id: 'documento.finalizza_come_nota_credito', label: d.actRegisterNotaLabel, descrizione: d.actRegisterNotaDesc, icona: <CreditCard className="h-4 w-4" />, gruppo: 'tipo' },
    { id: 'documento.finalizza_come_statement', label: d.actArchiveStatementLabel, descrizione: d.actArchiveStatementDesc, icona: <List className="h-4 w-4" />, gruppo: 'tipo' },
    { id: 'documento.finalizza_come_ordine', label: d.actRegisterOrdineLabel, descrizione: d.actRegisterOrdineDesc, icona: <ShoppingCart className="h-4 w-4" />, gruppo: 'tipo' },
    { id: 'documento.finalizza_come_comunicazione', label: d.actArchiveCommunicationLabel, descrizione: d.actArchiveCommunicationDesc, icona: <MessageSquare className="h-4 w-4" />, gruppo: 'tipo' },
    { id: 'documento.finalizza_come_listino', label: d.actRegisterListinoLabel, descrizione: d.actRegisterListinoDesc, icona: <List className="h-4 w-4" />, gruppo: 'tipo' },
    { id: 'documento.associa', label: d.actAssociateSupplierLabel, descrizione: d.actAssociateSupplierDesc, icona: <UserCheck className="h-4 w-4" />, gruppo: 'fornitore' },
    { id: 'documento.aggiorna_categoria', label: d.actChangeCategoryLabel, descrizione: d.actChangeCategoryDesc, icona: <Tag className="h-4 w-4" />, gruppo: 'fornitore' },
    { id: 'documento.scarta', label: d.actDiscardLabel, descrizione: d.actDiscardDesc, icona: <Ban className="h-4 w-4" />, gruppo: 'stato', pericolosa: true },
    { id: 'documento.scarta_fattura', label: d.actDiscardInvoiceLabel, descrizione: d.actDiscardInvoiceDesc, icona: <Ban className="h-4 w-4" />, gruppo: 'stato', pericolosa: true },
    { id: 'documento.rianalizza_ocr', label: d.actReanalyzeOcrLabel, descrizione: d.actReanalyzeOcrDesc, icona: <RotateCw className="h-4 w-4" />, gruppo: 'stato' },
    { id: 'documento.ignora_mittente', label: d.actIgnoreSenderLabel, descrizione: d.actIgnoreSenderDesc, icona: <Ban className="h-4 w-4" />, gruppo: 'stato', pericolosa: true },
    { id: 'fattura.approva', label: d.actApproveInvoiceLabel, descrizione: d.actApproveInvoiceDesc, icona: <CheckCircle className="h-4 w-4" />, gruppo: 'stato' },
    { id: 'fattura.rifiuta', label: d.actRejectInvoiceLabel, descrizione: d.actRejectInvoiceDesc, icona: <AlertTriangle className="h-4 w-4" />, gruppo: 'stato', pericolosa: true },
    { id: 'fattura.resetta_approvazione', label: d.actResetApprovalLabel, descrizione: d.actResetApprovalDesc, icona: <RotateCw className="h-4 w-4" />, gruppo: 'stato' },
    { id: 'statement.segna_come_ok', label: d.actMarkVerifiedLabel, descrizione: d.actMarkVerifiedDesc, icona: <CheckCircle className="h-4 w-4" />, gruppo: 'stato' },
    { id: 'statement.assegna_fattura', label: d.actAssignInvoiceLabel, descrizione: d.actAssignInvoiceDesc, icona: <FileText className="h-4 w-4" />, gruppo: 'stato' },
    { id: 'documento.apri', label: d.actOpenDocumentLabel, descrizione: d.actOpenDocumentDesc, icona: <ExternalLink className="h-4 w-4" />, gruppo: 'documento' },
    { id: 'bolla.rianalizza_ocr', label: d.actBollaReanalyzeOcrLabel, descrizione: d.actBollaReanalyzeOcrDesc, icona: <RotateCw className="h-4 w-4" />, gruppo: 'stato' },
    { id: 'bolla.converti_in_fattura', label: d.actBollaConvertLabel, descrizione: d.actBollaConvertDesc, icona: <Save className="h-4 w-4" />, gruppo: 'tipo' },
    { id: 'statement.converti_in_fattura', label: d.actBollaConvertLabel, descrizione: d.actBollaConvertDesc, icona: <Save className="h-4 w-4" />, gruppo: 'tipo' },
    { id: 'bolla.cambia_fornitore', label: d.actBollaChangeSupplierLabel, descrizione: d.actBollaChangeSupplierDesc, icona: <UserCheck className="h-4 w-4" />, gruppo: 'fornitore' },
    { id: 'bolla.elimina', label: d.actBollaDeleteLabel, descrizione: d.actBollaDeleteDesc, icona: <Archive className="h-4 w-4" />, gruppo: 'pericolose', pericolosa: true },
  ]
}

export const DOCUMENT_ACTION_GROUPS = ['tipo', 'fornitore', 'stato', 'documento', 'pericolose'] as const
