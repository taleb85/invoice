import type { CommandId } from '@/lib/command-system/types'

const BOLLA_ACTIONS: CommandId[] = [
  'bolla.converti_in_fattura',
  'documento.aggiorna_categoria',
  'documento.associa',
  'bolla.cambia_fornitore',
  'bolla.rianalizza_ocr',
  'documento.apri',
  'bolla.elimina',
]

const FATTURA_ACTIONS: CommandId[] = [
  'documento.finalizza_come_fattura',
  'documento.finalizza_come_nota_credito',
  'documento.aggiorna_categoria',
  'documento.associa',
  'fattura.approva',
  'fattura.rifiuta',
  'fattura.resetta_approvazione',
  'documento.scarta_fattura',
  'documento.apri',
]

const PENDING_ACTIONS: CommandId[] = [
  'documento.finalizza_come_fattura',
  'documento.finalizza_come_bolla',
  'documento.finalizza_come_nota_credito',
  'documento.finalizza_come_statement',
  'documento.finalizza_come_ordine',
  'documento.finalizza_come_comunicazione',
  'documento.finalizza_come_listino',
  'documento.associa',
  'documento.aggiorna_categoria',
  'documento.rianalizza_ocr',
  'documento.scarta',
  'documento.ignora_mittente',
  'documento.apri',
]

const STATEMENT_ROW_ACTIONS: CommandId[] = [
  'statement.segna_come_ok',
  'statement.assegna_fattura',
  'documento.associa',
  'documento.apri',
]

/** PDF estratto conto in inbox Verifica (header statement, non singola riga). */
const STATEMENT_INBOX_ACTIONS: CommandId[] = [
  'statement.converti_in_fattura',
  'documento.associa',
  'documento.apri',
]

const FALLBACK_ACTIONS: CommandId[] = ['documento.associa', 'documento.apri']

const BY_ORIGINE: Record<string, CommandId[]> = {
  bolla: BOLLA_ACTIONS,
  bolla_aperta: BOLLA_ACTIONS,
  fattura: FATTURA_ACTIONS,
  documento_da_processare: PENDING_ACTIONS,
  riga_statement: STATEMENT_ROW_ACTIONS,
  statement: STATEMENT_INBOX_ACTIONS,
  documento: FALLBACK_ACTIONS,
  conferma_ordine: ['documento.apri'],
}

/** Ordine stabile delle azioni mostrate in `DocumentActionsModal` per ogni origine. */
export function actionIdsForOrigine(origine: string): CommandId[] {
  return BY_ORIGINE[origine] ?? FALLBACK_ACTIONS
}

export function isActionApplicableForOrigine(actionId: CommandId, origine: string): boolean {
  return actionIdsForOrigine(origine).includes(actionId)
}
