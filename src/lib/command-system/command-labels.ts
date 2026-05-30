import type { Translations } from '@/lib/translations/types'
import type { CommandId } from './types'

/** Etichetta localizzata per un comando della coda / centro controllo. */
export function commandLabel(
  t: Translations,
  azioneId: CommandId | string,
  fallback?: string,
): string {
  const a = t.apprendimento
  const d = t.documentActions
  const map: Record<string, string> = {
    'documento.scarta': a.actionDocumentoScarta,
    'documento.scarta_fattura': d.actDiscardInvoiceLabel,
    'documento.associa': a.actionDocumentoAssocia,
    'documento.finalizza_come_fattura': a.actionDocumentoFattura,
    'documento.finalizza_come_bolla': a.actionDocumentoBolla,
    'documento.finalizza_come_nota_credito': a.actionDocumentoNotaCredito,
    'documento.finalizza_come_statement': a.actionDocumentoStatement,
    'documento.finalizza_come_ordine': a.actionDocumentoOrdine,
    'documento.finalizza_come_comunicazione': a.actionDocumentoComunicazione,
    'documento.finalizza_come_listino': d.actRegisterListinoLabel,
    'documento.rianalizza_ocr': a.actionDocumentoRianalizzaOcr,
    'documento.ignora_mittente': a.actionDocumentoIgnoraMittente,
    'documento.apri': a.actionDocumentoApri,
    'documento.aggiorna_categoria': a.actionDocumentoAggiornaCategoria,
    'fattura.approva': a.actionFatturaApprova,
    'fattura.rifiuta': a.actionFatturaRifiuta,
    'fattura.resetta_approvazione': a.actionFatturaResetta,
    'statement.segna_come_ok': a.actionStatementOk,
    'statement.assegna_fattura': a.actionStatementAssegna,
    'statement.ricalcola': a.actionStatementRicalcola,
    'statement.associa_fornitore': a.actionDocumentoAssocia,
    'bolla.rianalizza_ocr': d.actBollaReanalyzeOcrLabel,
    'bolla.converti_in_fattura': d.actBollaConvertLabel,
    'bolla.cambia_fornitore': d.actBollaChangeSupplierLabel,
    'bolla.elimina': d.actBollaDeleteLabel,
  }
  return map[azioneId] ?? fallback ?? azioneId
}

/** Descrizione breve localizzata (palette comandi, tooltip). */
export function commandDescription(
  t: Translations,
  azioneId: CommandId | string,
  fallback?: string,
): string {
  const d = t.documentActions
  const map: Record<string, string> = {
    'documento.scarta': d.actDiscardDesc,
    'documento.scarta_fattura': d.actDiscardInvoiceDesc,
    'documento.associa': d.actAssociateSupplierDesc,
    'documento.finalizza_come_fattura': d.actRegisterFatturaDesc,
    'documento.finalizza_come_bolla': d.actRegisterBollaDesc,
    'documento.finalizza_come_nota_credito': d.actRegisterNotaDesc,
    'documento.finalizza_come_statement': d.actArchiveStatementDesc,
    'documento.finalizza_come_ordine': d.actRegisterOrdineDesc,
    'documento.finalizza_come_comunicazione': d.actArchiveCommunicationDesc,
    'documento.finalizza_come_listino': d.actRegisterListinoDesc,
    'documento.rianalizza_ocr': d.actReanalyzeOcrDesc,
    'documento.ignora_mittente': d.actIgnoreSenderDesc,
    'documento.apri': d.actOpenDocumentDesc,
    'documento.aggiorna_categoria': d.actChangeCategoryDesc,
    'fattura.approva': d.actApproveInvoiceDesc,
    'fattura.rifiuta': d.actRejectInvoiceDesc,
    'fattura.resetta_approvazione': d.actResetApprovalDesc,
    'statement.segna_come_ok': d.actMarkVerifiedDesc,
    'statement.assegna_fattura': d.actAssignInvoiceDesc,
    'statement.associa_fornitore': d.actAssociateSupplierDesc,
    'bolla.rianalizza_ocr': d.actBollaReanalyzeOcrDesc,
    'bolla.converti_in_fattura': d.actBollaConvertDesc,
    'bolla.cambia_fornitore': d.actBollaChangeSupplierDesc,
    'bolla.elimina': d.actBollaDeleteDesc,
  }
  return map[azioneId] ?? fallback ?? ''
}
