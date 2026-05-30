import type { Translations } from '@/lib/translations/types'

/** Codici errore stabili da POST `/api/documenti-da-processare`. */
export type DocumentiDaProcessareErrorCode =
  | 'invoice_number_required'
  | 'associate_supplier_first'
  | 'invalid_doc_kind'
  | 'listino_stays_in_queue'
  | 'doc_already_processed'
  | 'doc_not_found'
  | 'invalid_kind'

const ITALIAN_ERROR_CODE: Record<string, DocumentiDaProcessareErrorCode> = {
  'Numero fattura non rilevato. Inseriscilo manualmente prima di confermare.': 'invoice_number_required',
  'Associa un fornitore prima di finalizzare.': 'associate_supplier_first',
  'Imposta il tipo di documento (estratto, bolla, fattura, nota credito, comunicazione, listino o ordine).':
    'invalid_doc_kind',
  'Listino prezzi: rimane in coda documenti. Apri il link e consulta il PDF direttamente.':
    'listino_stays_in_queue',
  'Documento già processato': 'doc_already_processed',
  'Documento non trovato': 'doc_not_found',
  'kind non valido': 'invalid_kind',
}

export function documentiDaProcessareErrorCode(
  message: string | undefined | null,
): DocumentiDaProcessareErrorCode | null {
  if (!message) return null
  const trimmed = message.trim()
  return ITALIAN_ERROR_CODE[trimmed] ?? null
}

/** Messaggio API → testo UI nella lingua corrente. */
export function translateDocumentiDaProcessareError(
  message: string | undefined | null,
  t: Translations,
): string {
  if (!message?.trim()) return t.documentActions.errGenericFinalize
  const code = documentiDaProcessareErrorCode(message)
  const d = t.documentActions
  switch (code) {
    case 'invoice_number_required':
      return d.errInvoiceNumberRequired
    case 'associate_supplier_first':
      return d.errAssociateSupplierFirst
    case 'invalid_doc_kind':
      return d.errInvalidDocKind
    case 'listino_stays_in_queue':
      return d.errListinoStaysInQueue
    case 'doc_already_processed':
      return d.errDocAlreadyProcessed
    case 'doc_not_found':
      return d.errDocNotFound
    case 'invalid_kind':
      return d.errInvalidKind
    default:
      return message
  }
}
